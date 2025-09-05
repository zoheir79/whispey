// API pour la facturation mensuelle avec prorata et sommation des coûts par agent
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request)
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userGlobalRole = await getUserGlobalRole(userId)
    if (userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can generate monthly billing' }, { status: 403 })
    }

    const { year, month, project_id } = await request.json()

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 })
    }

    // Générer la facturation pour le mois donné
    const billingResult = await generateMonthlyBilling(year, month, project_id)

    return NextResponse.json(billingResult)

  } catch (error) {
    console.error('Error generating monthly billing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateMonthlyBilling(year: number, month: number, projectId?: string) {
  try {
    // 1. Récupérer tous les agents actifs pour le projet ou tous les projets
    let agentsQuery = `
      SELECT DISTINCT a.id, a.name, a.agent_type, a.platform_mode, a.billing_cycle, 
             a.cost_overrides, a.created_at, a.project_id, p.name as project_name
      FROM pype_voice_agents a
      LEFT JOIN pype_voice_projects p ON a.project_id = p.id
      WHERE a.is_active = true
    `
    const params: any[] = []

    if (projectId) {
      agentsQuery += ' AND a.project_id = $1'
      params.push(projectId)
    }

    const agentsResult = await query(agentsQuery, params)
    const agents = agentsResult.rows

    const billingData = []

    for (const agent of agents) {
      // 2. Calculer le prorata pour cet agent
      const prorata = await calculateAgentProrata(agent.id, year, month)
      
      // 3. Calculer les coûts selon le mode de l'agent
      let agentBilling: any = {
        agent_id: agent.id,
        agent_name: agent.name,
        agent_type: agent.agent_type,
        platform_mode: agent.platform_mode,
        billing_cycle: agent.billing_cycle,
        project_id: agent.project_id,
        project_name: agent.project_name,
        prorata: prorata,
        costs: {},
        total_cost: 0
      }

      if (agent.platform_mode === 'dedicated') {
        // Mode Dedicated: Coût fixe mensuel avec prorata
        agentBilling = await calculateDedicatedCost(agent, year, month, prorata)
      } 
      else if (agent.platform_mode === 'pag') {
        // Mode PAG: Sommation des coûts par call
        agentBilling = await calculatePagCost(agent, year, month)
      }
      else if (agent.platform_mode === 'hybrid') {
        // Mode Hybrid: Mix dedicated + PAG
        agentBilling = await calculateHybridCost(agent, year, month, prorata)
      }

      billingData.push(agentBilling)
    }

    // 4. Sauvegarder la facture mensuelle
    const invoiceId = await saveMonthlyInvoice(year, month, billingData, projectId)

    return {
      success: true,
      invoice_id: invoiceId,
      year,
      month,
      project_id: projectId,
      billing_data: billingData,
      total_agents: agents.length,
      generated_at: new Date()
    }

  } catch (error) {
    console.error('Error in generateMonthlyBilling:', error)
    throw error
  }
}

async function calculateAgentProrata(agentId: string, year: number, month: number) {
  const prorata = await query('SELECT calculate_monthly_prorata($1, $2, $3)', [agentId, year, month])
  return prorata.rows[0].calculate_monthly_prorata
}

async function calculateDedicatedCost(agent: any, year: number, month: number, prorata: any) {
  // Récupérer les tarifs dedicated
  const settingsResult = await query(`
    SELECT value FROM global_settings WHERE key = 'pricing_rates_dedicated'
  `)
  const dedicatedRates = settingsResult.rows[0]?.value

  let monthlyCost = 0
  
  // Appliquer overrides si disponibles
  if (agent.cost_overrides) {
    // Utiliser les overrides de l'agent
    if (agent.agent_type === 'voice') {
      monthlyCost = parseFloat(agent.cost_overrides.voice_monthly || dedicatedRates.voice_agent_monthly)
    } else {
      monthlyCost = parseFloat(agent.cost_overrides.text_monthly || dedicatedRates.text_agent_monthly)
    }
  } else {
    // Utiliser tarifs globaux
    if (agent.agent_type === 'voice') {
      monthlyCost = dedicatedRates.voice_agent_monthly
    } else {
      monthlyCost = dedicatedRates.text_agent_monthly
    }
  }

  const prorataCost = monthlyCost * prorata.prorata_ratio

  return {
    ...agent,
    prorata,
    costs: {
      base_monthly_cost: monthlyCost,
      prorata_cost: prorataCost,
      type: 'dedicated'
    },
    total_cost: prorataCost
  }
}

async function calculatePagCost(agent: any, year: number, month: number) {
  // Sommation des coûts par call pour ce mois
  const costsResult = await query(`
    SELECT 
      SUM((cost_calculation->'costs'->>'stt_cost')::numeric) as total_stt_cost,
      SUM((cost_calculation->'costs'->>'tts_cost')::numeric) as total_tts_cost,
      SUM((cost_calculation->'costs'->>'llm_cost')::numeric) as total_llm_cost,
      SUM((cost_calculation->'costs'->>'total_cost')::numeric) as total_cost,
      COUNT(*) as total_calls,
      SUM(call_duration_minutes) as total_minutes,
      SUM(tokens_used) as total_tokens,
      SUM(words_generated) as total_words
    FROM call_costs
    WHERE agent_id = $1
    AND EXTRACT(YEAR FROM created_at) = $2
    AND EXTRACT(MONTH FROM created_at) = $3
  `, [agent.id, year, month])

  const costs = costsResult.rows[0]

  return {
    ...agent,
    costs: {
      stt_cost: parseFloat(costs.total_stt_cost || 0),
      tts_cost: parseFloat(costs.total_tts_cost || 0),
      llm_cost: parseFloat(costs.total_llm_cost || 0),
      total_calls: parseInt(costs.total_calls || 0),
      total_minutes: parseFloat(costs.total_minutes || 0),
      total_tokens: parseInt(costs.total_tokens || 0),
      total_words: parseInt(costs.total_words || 0),
      type: 'pag'
    },
    total_cost: parseFloat(costs.total_cost || 0)
  }
}

async function calculateHybridCost(agent: any, year: number, month: number, prorata: any) {
  // TODO: Implémenter logique hybrid selon provider_config
  // Mix entre dedicated et PAG selon la config de chaque modèle
  
  const pagCost = await calculatePagCost(agent, year, month)
  const dedicatedCost = await calculateDedicatedCost(agent, year, month, prorata)
  
  // Pour l'instant, mix 50/50 - à ajuster selon provider_config
  const hybridCost = (pagCost.total_cost + dedicatedCost.total_cost) * 0.5

  return {
    ...agent,
    prorata,
    costs: {
      pag_component: pagCost.costs,
      dedicated_component: dedicatedCost.costs,
      hybrid_cost: hybridCost,
      type: 'hybrid'
    },
    total_cost: hybridCost
  }
}

async function saveMonthlyInvoice(year: number, month: number, billingData: any[], projectId?: string) {
  const totalAmount = billingData.reduce((sum, item) => sum + item.total_cost, 0)
  
  // Créer l'invoice principale
  const invoiceResult = await query(`
    INSERT INTO billing_invoices (
      project_id,
      year,
      month,
      total_amount,
      currency,
      status,
      generated_at
    ) VALUES ($1, $2, $3, $4, 'USD', 'generated', NOW())
    RETURNING id
  `, [projectId, year, month, totalAmount])

  const invoiceId = invoiceResult.rows[0].id

  // Créer les items de facturation
  for (const item of billingData) {
    await query(`
      INSERT INTO billing_items (
        invoice_id,
        agent_id,
        agent_name,
        platform_mode,
        agent_type,
        amount,
        cost_breakdown,
        usage_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      invoiceId,
      item.agent_id,
      item.agent_name,
      item.platform_mode,
      item.agent_type,
      item.total_cost,
      JSON.stringify(item.costs),
      JSON.stringify(item.usage_data || {})
    ])
  }

  return invoiceId
}

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request)
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const projectId = searchParams.get('project_id')

    // Récupérer les factures existantes
    let invoicesQuery = `
      SELECT i.*, COUNT(bi.id) as items_count
      FROM billing_invoices i
      LEFT JOIN billing_items bi ON i.id = bi.invoice_id
      WHERE i.year = $1 AND i.month = $2
    `
    const params: (number | string)[] = [year, month]

    if (projectId) {
      invoicesQuery += ' AND i.project_id = $3'
      params.push(projectId)
    }

    invoicesQuery += ' GROUP BY i.id ORDER BY i.generated_at DESC'

    const result = await query(invoicesQuery, params)

    return NextResponse.json({
      invoices: result.rows,
      year,
      month,
      project_id: projectId
    })

  } catch (error) {
    console.error('Error fetching monthly billing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
