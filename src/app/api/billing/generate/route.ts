import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

interface BillingItem {
  agent_id: string
  agent_name: string
  platform_mode: string
  billing_cycle: 'monthly' | 'annual'
  
  // Usage totals
  total_calls: number
  total_minutes: number
  total_stt_cost: number
  total_tts_cost: number
  total_llm_cost: number
  
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
    tts_pag_cost?: number
    llm_pag_cost?: number
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
    
    console.log('💲 BILLING DEBUG - Pricing rates loaded:', {
      dedicatedRates,
      pagRates,
      s3Config
    })

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
    
    // Extract year and month from period dates
    const startDate = new Date(period_start)
    const endDate = new Date(period_end)
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth() + 1
    
    const consumptionResult = await query(`
      SELECT * FROM monthly_consumption 
      WHERE agent_id = ANY($1) 
      AND ((year = $2 AND month >= $3) OR (year > $2))
      AND ((year = $4 AND month <= $5) OR (year < $4))
    `, [agentIds, startYear, startMonth, endYear, endMonth])

    const consumption = consumptionResult.rows

    // Get call logs for detailed metrics
    console.log('🔍 BILLING DEBUG - Fetching call logs:', {
      agentIds,
      period_start,
      period_end,
      agentCount: agentIds.length
    })
    
    const callLogsResult = await query(`
      SELECT agent_id, duration_seconds, 
             total_stt_cost, total_tts_cost, total_llm_cost,
             created_at, call_started_at
      FROM pype_voice_call_logs 
      WHERE agent_id = ANY($1) 
      AND created_at >= $2 
      AND created_at <= $3
    `, [agentIds, period_start, period_end])

    const callLogs = callLogsResult.rows
    
    console.log('📊 BILLING DEBUG - Call logs found:', {
      totalCallLogs: callLogs.length,
      sampleLog: callLogs[0] || 'No logs found',
      dateRange: { period_start, period_end }
    })

    // Calculate billing items for each agent
    const billingItems: BillingItem[] = []

    for (const agent of agents) {
      const agentConsumption = consumption?.filter((c: any) => c.agent_id === agent.id) || []
      const agentCallLogs = callLogs?.filter((c: any) => c.agent_id === agent.id) || []
      
      // Aggregate usage metrics
      const totalCalls = agentCallLogs.length
      const totalMinutes = agentCallLogs.reduce((sum: number, log: any) => sum + ((log.duration_seconds || 0) / 60), 0)
      
      // Calculate costs from duration if pre-calculated costs are null
      let totalSttCost = agentCallLogs.reduce((sum: number, log: any) => sum + (log.total_stt_cost || 0), 0)
      let totalTtsCost = agentCallLogs.reduce((sum: number, log: any) => sum + (log.total_tts_cost || 0), 0)
      let totalLlmCost = agentCallLogs.reduce((sum: number, log: any) => sum + (log.total_llm_cost || 0), 0)
      
      // If costs are null/zero, calculate from duration using PAG rates
      if (totalSttCost === 0 && totalMinutes > 0) {
        totalSttCost = totalMinutes * (pagRates.stt_builtin_per_minute || 0.005)
      }
      if (totalTtsCost === 0 && totalMinutes > 0) {
        totalTtsCost = totalMinutes * (pagRates.tts_builtin_per_minute || 0.004)
      }
      if (totalLlmCost === 0 && totalMinutes > 0) {
        totalLlmCost = totalMinutes * (pagRates.llm_builtin_per_minute || 0.2)
      }
      
      console.log(`💰 BILLING DEBUG - Agent ${agent.name} (${agent.id}):`, {
        platform_mode: agent.platform_mode,
        totalCalls,
        totalMinutes: totalMinutes.toFixed(2),
        totalSttCost,
        totalTtsCost,
        totalLlmCost,
        callLogsCount: agentCallLogs.length
      })

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
        // Pay-as-you-go costs from call logs (already calculated)
        sttCost = totalSttCost
        ttsCost = totalTtsCost  
        llmCost = totalLlmCost
        
        consumptionDetails.stt_pag_usage = totalMinutes
        consumptionDetails.tts_pag_cost = totalTtsCost
        consumptionDetails.llm_pag_cost = totalLlmCost

      } else if (agent.platform_mode === 'hybrid') {
        // Mixed costs from call logs (already calculated)
        sttCost = totalSttCost
        ttsCost = totalTtsCost
        llmCost = totalLlmCost
        
        consumptionDetails.stt_pag_usage = totalMinutes
        consumptionDetails.tts_pag_cost = totalTtsCost
        consumptionDetails.llm_pag_cost = totalLlmCost
      }

      // S3 storage cost (monthly) from global settings
      const s3Rate = s3Config.cost_per_gb || pagRates.s3_storage_per_gb_monthly || 0.023
      s3Cost = (agent.s3_storage_gb || 50) * s3Rate

      // Apply billing cycle multiplier for annual
      const cycleMultiplier = billing_cycle === 'annual' ? 12 : 1
      const totalCost = (sttCost + ttsCost + llmCost + agentCost + s3Cost) * cycleMultiplier
      
      console.log(`💸 BILLING DEBUG - Final costs for ${agent.name}:`, {
        sttCost,
        ttsCost, 
        llmCost,
        agentCost,
        s3Cost,
        cycleMultiplier,
        totalCost,
        dedicatedRates,
        pagRates
      })

      billingItems.push({
        agent_id: agent.id,
        agent_name: agent.name,
        platform_mode: agent.platform_mode,
        billing_cycle: agent.billing_cycle || billing_cycle,
        total_calls: totalCalls,
        total_minutes: totalMinutes,
        total_stt_cost: totalSttCost,
        total_tts_cost: totalTtsCost,
        total_llm_cost: totalLlmCost,
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
            total_stt_cost: item.total_stt_cost,
            total_tts_cost: item.total_tts_cost,
            total_llm_cost: item.total_llm_cost,
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
