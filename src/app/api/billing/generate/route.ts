import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore - Supabase types may not be available in build
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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
    const body = await request.json()
    const { workspace_id, period_start, period_end, billing_cycle = 'monthly', preview = false } = body

    if (!workspace_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'workspace_id, period_start, and period_end are required' },
        { status: 400 }
      )
    }

    // Get all agents in workspace
    const { data: agents, error: agentsError } = await supabase
      .from('pype_voice_agents')
      .select(`
        id,
        name,
        platform_mode,
        billing_cycle,
        s3_storage_gb,
        pricing_config,
        stt_mode,
        tts_mode,
        llm_mode
      `)
      .eq('workspace_id', workspace_id)

    if (agentsError) {
      return NextResponse.json({ error: agentsError.message }, { status: 500 })
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'No agents found in workspace' }, { status: 404 })
    }

    // Get consumption data for period
    const { data: consumption, error: consumptionError } = await supabase
      .from('monthly_consumption')
      .select('*')
      .in('agent_id', agents.map((a: any) => a.id))
      .gte('period_start', period_start)
      .lte('period_end', period_end)

    if (consumptionError) {
      return NextResponse.json({ error: consumptionError.message }, { status: 500 })
    }

    // Get call logs for detailed metrics
    const { data: callLogs, error: callLogsError } = await supabase
      .from('pype_voice_call_logs')
      .select(`
        agent_id,
        duration_minutes,
        stt_minutes_used,
        tts_words_used,
        llm_tokens_used,
        usage_cost,
        created_at
      `)
      .in('agent_id', agents.map((a: any) => a.id))
      .gte('created_at', period_start)
      .lte('created_at', period_end)

    if (callLogsError) {
      return NextResponse.json({ error: callLogsError.message }, { status: 500 })
    }

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
        // Fixed monthly costs for all models
        sttCost = 15.00 // Built-in STT dedicated monthly
        ttsCost = 12.00 // Built-in TTS dedicated monthly  
        llmCost = 25.00 // Built-in LLM dedicated monthly
        agentCost = 29.99 // Voice agent monthly subscription
        
        consumptionDetails.stt_dedicated_monthly = sttCost
        consumptionDetails.tts_dedicated_monthly = ttsCost
        consumptionDetails.llm_dedicated_monthly = llmCost

      } else if (agent.platform_mode === 'pag') {
        // Pay-as-you-go costs based on usage
        sttCost = totalSttMinutes * 0.005 // $0.005 per minute
        ttsCost = totalTtsWords * 0.002 // $0.002 per word
        llmCost = totalLlmTokens * 0.000015 // $0.000015 per token
        
        consumptionDetails.stt_pag_usage = totalSttMinutes
        consumptionDetails.tts_pag_usage = totalTtsWords
        consumptionDetails.llm_pag_usage = totalLlmTokens

      } else if (agent.platform_mode === 'hybrid') {
        // Mixed costs based on individual model modes
        const pricing_config = agent.pricing_config || {}
        
        // STT cost
        if (agent.stt_mode === 'builtin_dedicated') {
          sttCost = 15.00
          consumptionDetails.stt_dedicated_monthly = sttCost
        } else {
          sttCost = totalSttMinutes * 0.005
          consumptionDetails.stt_pag_usage = totalSttMinutes
        }
        
        // TTS cost
        if (agent.tts_mode === 'builtin_dedicated') {
          ttsCost = 12.00
          consumptionDetails.tts_dedicated_monthly = ttsCost
        } else {
          ttsCost = totalTtsWords * 0.002
          consumptionDetails.tts_pag_usage = totalTtsWords
        }
        
        // LLM cost
        if (agent.llm_mode === 'builtin_dedicated') {
          llmCost = 25.00
          consumptionDetails.llm_dedicated_monthly = llmCost
        } else {
          llmCost = totalLlmTokens * 0.000015
          consumptionDetails.llm_pag_usage = totalLlmTokens
        }
      }

      // S3 storage cost (monthly)
      s3Cost = (agent.s3_storage_gb || 50) * 0.023 // $0.023 per GB per month

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
      const { data: savedInvoice, error: saveError } = await supabase
        .from('billing_invoices')
        .insert({
          workspace_id: invoice.workspace_id,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          billing_cycle: invoice.billing_cycle,
          total_amount: invoice.total_amount,
          status: invoice.status,
          currency: invoice.currency,
          invoice_data: invoice,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (saveError) {
        return NextResponse.json({ error: saveError.message }, { status: 500 })
      }

      // Save detailed billing items
      const billingItemsToSave = billingItems.map(item => ({
        invoice_id: savedInvoice.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name,
        platform_mode: item.platform_mode,
        stt_cost: item.stt_cost,
        tts_cost: item.tts_cost,
        llm_cost: item.llm_cost,
        agent_cost: item.agent_cost,
        s3_cost: item.s3_cost,
        total_cost: item.total_cost,
        usage_details: {
          total_calls: item.total_calls,
          total_minutes: item.total_minutes,
          total_stt_minutes: item.total_stt_minutes,
          total_tts_words: item.total_tts_words,
          total_llm_tokens: item.total_llm_tokens,
          consumption_details: item.consumption_details
        }
      }))

      const { error: itemsError } = await supabase
        .from('billing_items')
        .insert(billingItemsToSave)

      if (itemsError) {
        console.error('Error saving billing items:', itemsError)
        // Don't fail the request, just log the error
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

    const { data: invoices, error } = await supabase
      .from('billing_invoices')
      .select(`
        id,
        period_start,
        period_end,
        billing_cycle,
        total_amount,
        status,
        currency,
        created_at,
        updated_at
      `)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
