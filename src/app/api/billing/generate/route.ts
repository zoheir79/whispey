import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

interface BillingItem {
  agent_id: string
  agent_name: string
  platform_mode: 'dedicated' | 'pag' | 'hybrid'
  billing_cycle: 'monthly' | 'annual'
  
  // Usage totals
  total_calls: number
  total_minutes: number
  total_stt_minutes: number
  total_tts_words: number
  total_llm_tokens: number
  
  // Costs breakdown
  stt_cost: number
  tts_cost: number
  llm_cost: number
  agent_cost: number
  s3_cost: number
  total_cost: number
  
  // Monthly consumption details
  consumption_details: {
    stt_dedicated_monthly?: number
    tts_dedicated_monthly?: number
    llm_dedicated_monthly?: number
    stt_pag_usage?: number
    tts_pag_usage?: number
    llm_pag_usage?: number
  }
}

interface BillingInvoice {
  workspace_id: string
  period_start: string
  period_end: string
  billing_cycle: 'monthly' | 'annual'
  items: BillingItem[]
  total_amount: number
  status: 'draft' | 'sent' | 'paid'
  currency: 'USD'
}

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    if (userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can generate billing' }, { status: 403 });
    }

    const body = await request.json()
    const { workspace_id, period_start, period_end, billing_cycle = 'monthly', preview = false } = body

    if (!workspace_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'workspace_id, period_start, and period_end are required' },
        { status: 400 }
      )
    }

    // Get global pricing settings
    const pricingSettingsResult = await query(`
      SELECT key, value FROM settings_global 
      WHERE key IN ('pricing_rates_dedicated', 'pricing_rates_pag', 's3_config')
    `)
    
    const settings: Record<string, any> = {}
    for (const row of pricingSettingsResult.rows) {
      try {
        // Ensure row.value is a string and not [object Object]
        if (typeof row.value === 'string') {
          settings[row.key] = JSON.parse(row.value)
        } else if (typeof row.value === 'object' && row.value !== null) {
          // If it's already an object, use it directly
          settings[row.key] = row.value
        } else {
          console.warn(`Invalid settings value for key ${row.key}:`, row.value)
          settings[row.key] = {}
        }
      } catch (parseError) {
        console.error(`Error parsing settings for key ${row.key}:`, parseError)
        console.error(`Raw value:`, row.value)
        settings[row.key] = {}
      }
    }

    const dedicatedRates = settings.pricing_rates_dedicated || {}
    const pagRates = settings.pricing_rates_pag || {}
    const s3Config = settings.s3_config || {}

    // Get all agents in workspace
    const agentsResult = await query(`
      SELECT id, name, platform_mode, billing_cycle, s3_storage_gb, 
             pricing_config, provider_config
      FROM pype_voice_agents 
      WHERE project_id = $1
    `, [workspace_id])

    const agents = agentsResult.rows

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'No agents found in workspace' }, { status: 404 })
    }

    // Get consumption data for period
    const agentIds = agents.map((a: any) => a.id)
    const consumptionResult = await query(`
      SELECT * FROM monthly_consumption 
      WHERE agent_id = ANY($1) 
      AND period_start >= $2 
      AND period_end <= $3
    `, [agentIds, period_start, period_end])

    const consumption = consumptionResult.rows

    // Get call logs for detailed metrics
    const callLogsResult = await query(`
      SELECT agent_id, duration_minutes, stt_minutes_used, 
             tts_words_used, llm_tokens_used, usage_cost, created_at
      FROM pype_voice_call_logs 
      WHERE agent_id = ANY($1) 
      AND created_at >= $2 
      AND created_at <= $3
    `, [agentIds, period_start, period_end])

    const callLogs = callLogsResult.rows

    // Calculate billing items for each agent
    const billingItems: BillingItem[] = []

    for (const agent of agents) {
      const agentConsumption = consumption?.filter((c: any) => c.agent_id === agent.id) || []
      const agentCallLogs = callLogs?.filter((c: any) => c.agent_id === agent.id) || []
      
      // Aggregate usage metrics
      const totalCalls = agentCallLogs.length
      const totalMinutes = agentCallLogs.reduce((sum: number, log: any) => sum + (log.duration_minutes || 0), 0)
      const totalSttMinutes = agentCallLogs.reduce((sum: number, log: any) => sum + (log.stt_minutes_used || 0), 0)
      const totalTtsWords = agentCallLogs.reduce((sum: number, log: any) => sum + (log.tts_words_used || 0), 0)
      const totalLlmTokens = agentCallLogs.reduce((sum: number, log: any) => sum + (log.llm_tokens_used || 0), 0)

      // Calculate costs based on platform mode
      let sttCost = 0
      let ttsCost = 0
      let llmCost = 0
      let agentCost = 0
      let s3Cost = 0

      const consumptionDetails: any = {}

      if (agent.platform_mode === 'dedicated') {
        // Fixed monthly costs from global settings
        sttCost = dedicatedRates.stt_monthly || 15.00
        ttsCost = dedicatedRates.tts_monthly || 12.00  
        llmCost = dedicatedRates.llm_monthly || 25.00
        agentCost = dedicatedRates.voice_agent_monthly || 29.99
        
        consumptionDetails.stt_dedicated_monthly = sttCost
        consumptionDetails.tts_dedicated_monthly = ttsCost
        consumptionDetails.llm_dedicated_monthly = llmCost

      } else if (agent.platform_mode === 'pag') {
        // Pay-as-you-go costs from global settings
        sttCost = totalSttMinutes * (pagRates.stt_builtin_per_minute || 0.005)
        ttsCost = totalTtsWords * (pagRates.tts_builtin_per_word || 0.002)
        llmCost = totalLlmTokens * (pagRates.llm_builtin_per_token || 0.000015)
        
        consumptionDetails.stt_pag_usage = totalSttMinutes
        consumptionDetails.tts_pag_usage = totalTtsWords
        consumptionDetails.llm_pag_usage = totalLlmTokens

      } else if (agent.platform_mode === 'hybrid') {
        // Mixed costs based on provider config using global settings
        const provider_config = agent.provider_config || {}
        
        // Default to PAG pricing for hybrid mode
        sttCost = totalSttMinutes * (pagRates.stt_builtin_per_minute || 0.005)
        ttsCost = totalTtsWords * (pagRates.tts_builtin_per_word || 0.002)
        llmCost = totalLlmTokens * (pagRates.llm_builtin_per_token || 0.000015)
        
        consumptionDetails.stt_pag_usage = totalSttMinutes
        consumptionDetails.tts_pag_usage = totalTtsWords
        consumptionDetails.llm_pag_usage = totalLlmTokens
      }

      // S3 storage cost (monthly) from global settings
      const s3Rate = s3Config.cost_per_gb || pagRates.s3_storage_per_gb_monthly || 0.023
      s3Cost = (agent.s3_storage_gb || 50) * s3Rate

      // Apply billing cycle multiplier for annual
      const cycleMultiplier = billing_cycle === 'annual' ? 12 : 1
      const totalCost = (sttCost + ttsCost + llmCost + agentCost + s3Cost) * cycleMultiplier

      billingItems.push({
        agent_id: agent.id,
        agent_name: agent.name,
        platform_mode: agent.platform_mode,
        billing_cycle: agent.billing_cycle || billing_cycle,
        total_calls: totalCalls,
        total_minutes: totalMinutes,
        total_stt_minutes: totalSttMinutes,
        total_tts_words: totalTtsWords,
        total_llm_tokens: totalLlmTokens,
        stt_cost: sttCost * cycleMultiplier,
        tts_cost: ttsCost * cycleMultiplier,
        llm_cost: llmCost * cycleMultiplier,
        agent_cost: agentCost * cycleMultiplier,
        s3_cost: s3Cost * cycleMultiplier,
        total_cost: totalCost,
        consumption_details: consumptionDetails
      })
    }

    // Create invoice
    const invoice: BillingInvoice = {
      workspace_id,
      period_start,
      period_end,
      billing_cycle,
      items: billingItems,
      total_amount: billingItems.reduce((sum, item) => sum + item.total_cost, 0),
      status: preview ? 'draft' : 'sent',
      currency: 'USD'
    }

    // Save invoice to database if not preview
    if (!preview) {
      const invoiceResult = await query(`
        INSERT INTO billing_invoices 
        (workspace_id, period_start, period_end, billing_cycle, total_amount, status, currency, invoice_data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        invoice.workspace_id,
        invoice.period_start,
        invoice.period_end,
        invoice.billing_cycle,
        invoice.total_amount,
        invoice.status,
        invoice.currency,
        JSON.stringify(invoice),
        new Date().toISOString()
      ])

      const savedInvoice = invoiceResult.rows[0]

      // Save detailed billing items
      for (const item of billingItems) {
        await query(`
          INSERT INTO billing_items 
          (invoice_id, agent_id, item_type, quantity, unit_cost, total_cost, usage_details)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          savedInvoice.id,
          item.agent_id,
          'combined', // Item type for combined billing
          1, // Quantity
          item.total_cost, // Unit cost = total cost for combined items
          item.total_cost,
          JSON.stringify({
            agent_name: item.agent_name,
            platform_mode: item.platform_mode,
            total_calls: item.total_calls,
            total_minutes: item.total_minutes,
            total_stt_minutes: item.total_stt_minutes,
            total_tts_words: item.total_tts_words,
            total_llm_tokens: item.total_llm_tokens,
            stt_cost: item.stt_cost,
            tts_cost: item.tts_cost,
            llm_cost: item.llm_cost,
            agent_cost: item.agent_cost,
            s3_cost: item.s3_cost,
            consumption_details: item.consumption_details
          })
        ])
      }

      return NextResponse.json({
        success: true,
        invoice: { ...invoice, id: savedInvoice.id },
        message: `Facture ${billing_cycle} générée avec succès`
      })
    }

    // Return preview
    return NextResponse.json({
      success: true,
      preview: true,
      invoice,
      message: `Aperçu facture ${billing_cycle} généré`
    })

  } catch (error) {
    console.error('Error generating billing:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la facture' },
      { status: 500 }
    )
  }
}

// GET - List invoices for workspace
export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    if (userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can view billing invoices' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url)
    const workspace_id = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      )
    }

    const invoicesResult = await query(`
      SELECT id, period_start, period_end, billing_cycle, 
             total_amount, status, currency, created_at, updated_at
      FROM billing_invoices 
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [workspace_id, limit, offset])

    const invoices = invoicesResult.rows

    return NextResponse.json({
      success: true,
      invoices: invoices || [],
      total: invoices?.length || 0
    })

  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures' },
      { status: 500 }
    )
  }
}
