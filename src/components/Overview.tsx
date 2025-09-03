'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Tooltip } from 'recharts'
import {
  Phone,
  Clock,
  CheckCircle,
  TrendUp,
  CircleNotch,
  Warning,
  CalendarBlank,
  CurrencyDollar,
  Lightning,
  XCircle,
  ChartBar,
  Activity,
  Target,
  Users,
  Percent,
  ArrowUp,
  ArrowDown,
} from 'phosphor-react'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useOverviewQuery } from '../hooks/useOverviewQuery'
import { getUserProjectRole } from '@/services/getUserRole'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, MoreHorizontal, Trash2, Download } from 'lucide-react'
import { EnhancedChartBuilder, ChartProvider } from './EnhancedChartBuilder'
import { FloatingActionMenu } from './FloatingActionMenu'


import { useDynamicFields } from '../hooks/useDynamicFields'
// JWT auth is handled at the page level
import CustomTotalsBuilder from './CustomTotalBuilds'
import { CustomTotalsService } from '@/services/customTotalServiceClient'
import { CustomTotalConfig, CustomTotalResult } from '../types/customTotals'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { useApiClient } from '../hooks/useApiClient'
import Papa from 'papaparse'



interface OverviewProps {
  project: any
  agent: any
  dateRange: {
    from: string
    to: string
  }
  quickFilter?: string
  isCustomRange?: boolean
}

const ICON_COMPONENTS = {
  phone: Phone,
  clock: Clock,
  'dollar-sign': CurrencyDollar,
  'trending-up': TrendUp,
  calculator: Activity,
  users: Users
}

const COLOR_CLASSES = {
  blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/50',
  green: 'bg-gradient-to-r from-green-500 to-green-600 text-white border border-green-400/50',
  purple: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border border-purple-400/50',
  orange: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border border-orange-400/50',
  red: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400/50',
  emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border border-emerald-400/50'
}

const subDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const formatDateISO = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatDateDisplay = (date: Date) => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

const AVAILABLE_COLUMNS = [
  { key: 'customer_number', label: 'Customer Number', type: 'text' as const },
  { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number' as const },
  { key: 'avg_latency', label: 'Avg Latency', type: 'number' as const },
  { key: 'call_started_at', label: 'Call Date', type: 'date' as const },
  { key: 'call_ended_reason', label: 'Call Status', type: 'text' as const },
  { key: 'total_llm_cost', label: 'LLM Cost', type: 'number' as const },
  { key: 'total_tts_cost', label: 'TTS Cost', type: 'number' as const },
  { key: 'total_stt_cost', label: 'STT Cost', type: 'number' as const },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' as const },
  { key: 'transcription_metrics', label: 'Transcription Metrics', type: 'jsonb' as const }
]

const Overview: React.FC<OverviewProps> = ({ 
  project, 
  agent,
  dateRange
}) => {

  // Function to format date range display
  const getDateRangeDisplay = () => {
    if (!dateRange?.from || !dateRange?.to) return 'All time'
    
    const fromDate = new Date(dateRange.from)
    const toDate = new Date(dateRange.to)
    
    // If same date
    if (dateRange.from === dateRange.to) {
      return formatDateDisplay(fromDate)
    }
    
    // If different dates
    return `${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
  }

  const [role, setRole] = useState<string | null>(null)
  const [customTotals, setCustomTotals] = useState<CustomTotalConfig[]>([])
  const [customTotalResults, setCustomTotalResults] = useState<CustomTotalResult[]>([])
  const [loadingCustomTotals, setLoadingCustomTotals] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true) // Add loading state for role
  
  // Use API client for database operations
  const { fetchFromTable } = useApiClient()

  // TODO: Replace with JWT auth context when available
  // const { user } = useUser() // Removed: obsolete Clerk hook
  const userEmail = 'user@example.com' // TODO: Get from JWT auth context




  // 🔍 DEBUG: Log dateRange changes
  console.log('🔍 Overview RENDER - dateRange received:', dateRange)
  console.log('🔍 Overview RENDER - agent?.id:', agent?.id)

  const { data: analytics, loading, error } = useOverviewQuery({
    agentId: agent?.id,
    dateFrom: dateRange.from,
    dateTo: dateRange.to
  })

  // 🔍 DEBUG: Log analytics data
  console.log('🔍 Overview RENDER - analytics:', analytics)
  console.log('🔍 Overview RENDER - loading:', loading)

  const { 
    metadataFields, 
    transcriptionFields, 
    loading: fieldsLoading,
    error: fieldsError 
  } = useDynamicFields(agent?.id)


  useEffect(() => {
    if (userEmail) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail, project?.id)
          setRole(userRole)
        } catch (error) {
          console.error('Failed to load user role:', error)
          setRole('user') // Default to most restrictive role on error
        } finally {
          setRoleLoading(false)
        }
      }
      getUserRole()
    } else {
      setRoleLoading(false)
      setRole('user') // Default when no user email
    }
  }, [userEmail, project?.id])



  const loadCustomTotals = async () => {
    try {
      const configs = await CustomTotalsService.getCustomTotals(project?.id, agent?.id)
      setCustomTotals(configs)
    } catch (error) {
      console.error('Failed to load custom totals:', error)
    }
  }

  useEffect(() => {
    if (role !== null && !roleLoading) {
      loadCustomTotals()
    }
  }, [role, roleLoading])

  useEffect(() => {
    const run = async () => {
      if (customTotals.length === 0 || roleLoading) return
      setLoadingCustomTotals(true)
      try {
        const results = await CustomTotalsService.batchCalculateCustomTotals(
          customTotals,
          'project-id', // TODO: Get actual project ID
          agent.id,
          dateRange
        )
        if (results.success && results.data) {
          setCustomTotalResults(results.data)
        }
      } catch (e) {
        console.error('Batch calc failed', e)
      } finally {
        setLoadingCustomTotals(false)
      }
    }
    run()
  }, [customTotals, dateRange.from, dateRange.to, roleLoading, agent?.id])

  const calculateCustomTotals = async () => {
    if (customTotals.length === 0) return
    
    setLoadingCustomTotals(true)
    try {
      const results = await Promise.all(
        customTotals.map(config =>
          CustomTotalsService.calculateCustomTotal(
            config, 
            agent?.id, 
            dateRange
          )
        )
      )

      const validResults = results
        .filter(result => result.success && result.data)
        .map(result => result.data!)
      setCustomTotalResults(validResults)
    } catch (error) {
      console.error('Failed to calculate custom totals:', error)
    } finally {
      setLoadingCustomTotals(false)
    }
  }

  const handleDeleteCustomTotal = async (configId: string) => {
    try {
      await CustomTotalsService.deleteCustomTotal(configId)
      setCustomTotals(prev => prev.filter(c => c.id !== configId))
      setCustomTotalResults(prev => prev.filter(r => r.configId !== configId))
    } catch (error) {
      console.error('Failed to delete custom total:', error)
    }
  }

  const handleSaveCustomTotal = async (config: CustomTotalConfig) => {
    try {
      const result = await CustomTotalsService.saveCustomTotal(config, agent?.id)
      if (result.success && result.data) {
        setCustomTotals(prev => {
          const existing = prev.find(c => c.id === result.data!.id)
          if (existing) {
            return prev.map(c => c.id === result.data!.id ? result.data! : c)
          } else {
            return [...prev, result.data!]
          }
        })
        
        // Recalculate custom totals
        calculateCustomTotals()
      }
    } catch (error) {
      console.error('Failed to save custom total:', error)
    }
  }

  const formatCustomTotalValue = (result: any, config: any) => {
    if (!result || result.value === null || result.value === undefined) {
      return '0'
    }
    
    const value = result.value
    switch (config.aggregation) {
      case 'SUM':
      case 'COUNT':
      case 'COUNT_DISTINCT':
        return typeof value === 'number' ? Math.round(value).toLocaleString() : value.toString()
      case 'AVG':
        return typeof value === 'number' ? value.toFixed(2) : value.toString()
      default:
        return value.toString()
    }
  }

  // Build PostgREST-friendly filters and OR string to mirror SQL logic (AND vs OR)
  const buildFiltersForDownload = (
    config: CustomTotalConfig,
    agentId: string,
    dateFrom?: string,
    dateTo?: string
  ) => {
    const andFilters: { column: string; operator: string; value: any }[] = []

    // Always constrain by agent and date range (ANDed)
    andFilters.push({ column: 'agent_id', operator: 'eq', value: agentId })
    if (dateFrom) andFilters.push({ column: 'call_started_at', operator: 'gte', value: `${dateFrom} 00:00:00` })
    if (dateTo) andFilters.push({ column: 'call_started_at', operator: 'lte', value: `${dateTo} 23:59:59.999` })

    const getColumnName = (col: string, jsonField?: string, forText?: boolean) => {
      if (!jsonField) return col
      return `${col}${forText ? '->>' : '->'}${jsonField}`
    }

    // COUNT/COUNT_DISTINCT existence checks when targeting JSON field, to match SQL
    if ((config.aggregation === 'COUNT' || (config.aggregation === 'COUNT_DISTINCT' && !!config.jsonField)) && config.jsonField) {
      const existsCol = getColumnName(config.column, config.jsonField, true)
      andFilters.push({ column: existsCol, operator: 'not.is', value: null })
      andFilters.push({ column: existsCol, operator: 'neq', value: '' })
    }

    // Build filter group based on filterLogic
    const isTextOp = (op: string) => ['contains', 'json_contains', 'equals', 'json_equals', 'starts_with'].includes(op)

    const toSimpleCond = (f: CustomTotalConfig['filters'][number]) => {
      const col = getColumnName(f.column, f.jsonField, isTextOp(f.operation))
      switch (f.operation) {
        case 'equals':
        case 'json_equals':
          return { column: col, operator: 'eq', value: f.value }
        case 'contains':
        case 'json_contains':
          return { column: col, operator: 'ilike', value: `%${f.value}%` }
        case 'starts_with':
          return { column: col, operator: 'ilike', value: `${f.value}%` }
        case 'greater_than':
        case 'json_greater_than':
          return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'gt', value: f.value }
        case 'less_than':
        case 'json_less_than':
          return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'lt', value: f.value }
        case 'json_exists': {
          // Represent as a nested and() for OR usage; for AND we add two filters
          return { column: col, operator: 'json_exists', value: null }
        }
        default:
          return null
      }
    }

    const filters = (config.filters || []).map(toSimpleCond).filter(Boolean) as { column: string; operator: string; value: any }[]

    let orString: string | null = null
    if (config.filterLogic === 'OR' && filters.length > 0) {
      const parts = filters.map(f => {
        if (f.operator === 'json_exists') {
          // and(col.not.is.null,col.neq.)
          return `and(${f.column}.not.is.null,${f.column}.neq.)`
        }
        if (f.operator === 'eq') return `${f.column}.eq.${encodeURIComponent(String(f.value))}`
        if (f.operator === 'ilike') return `${f.column}.ilike.*${encodeURIComponent(String(f.value).replace(/%/g, ''))}*`
        if (f.operator === 'gt') return `${f.column}.gt.${encodeURIComponent(String(f.value))}`
        if (f.operator === 'lt') return `${f.column}.lt.${encodeURIComponent(String(f.value))}`
        return ''
      }).filter(Boolean)
      orString = parts.join(',') || null
    } else {
      // AND logic: merge into andFilters, expanding json_exists into two filters
      for (const f of filters) {
        if (f.operator === 'json_exists') {
          andFilters.push({ column: f.column, operator: 'not.is', value: null })
          andFilters.push({ column: f.column, operator: 'neq', value: '' })
        } else {
          andFilters.push(f)
        }
      }
    }

    return { andFilters, orString }
  }

  const handleDownloadCustomTotal = async (config: CustomTotalConfig) => {
    try {
      // Build filters mirroring SQL
      const { andFilters, orString } = buildFiltersForDownload(config, agent?.id, dateRange?.from, dateRange?.to)
      
      // Convertir les filtres au format attendu par fetchFromTable
      const filters = andFilters.map(f => ({
        column: f.column,
        operator: f.operator === 'eq' ? '=' :
                 f.operator === 'ilike' ? 'ilike' :
                 f.operator === 'gte' ? '>=' :
                 f.operator === 'lte' ? '<=' :
                 f.operator === 'gt' ? '>' :
                 f.operator === 'lt' ? '<' :
                 f.operator === 'not.is' ? 'is not' :
                 f.operator === 'neq' ? '!=' : f.operator,
        value: f.value
      }))
      
      // Gestion de la condition OR si présente
      let orCondition = undefined
      if (orString) {
        // Convertir la chaîne OR en format compatible avec fetchFromTable
        // Note: Cette implémentation est simplifiée et pourrait nécessiter une adaptation
        // selon la façon dont fetchFromTable gère les conditions OR
        orCondition = orString
      }
      
      // Appel à fetchFromTable avec les paramètres appropriés
      const { data, error } = await fetchFromTable({
        table: 'pype_voice_call_logs',
        select: 'id,agent_id,customer_number,call_id,call_ended_reason,call_started_at,call_ended_at,duration_seconds,metadata,transcript_json,transcript_with_metrics,transcription_metrics,avg_latency,created_at',
        filters,
        orderBy: { column: 'created_at', ascending: false },
        limit: 2000
        // Note: orCondition not supported by current fetchFromTable interface
      })
      if (error) {
        alert(`Failed to fetch logs: ${error}`)
        return
      }
      
      const asObj = (v: any): Record<string, any> => {
        try {
          if (!v) return {}
          return typeof v === 'string' ? (JSON.parse(v) || {}) : v
        } catch {
          return {}
        }
      }

      const pickJsonValue = (obj: Record<string, any>, key?: string): any => {
        if (!obj || !key) return undefined
        if (key in obj) return obj[key]
        const noSpace = key.replace(/\s+/g, '')
        if (noSpace in obj) return obj[noSpace]
        const lowerFirst = key.charAt(0).toLowerCase() + key.slice(1)
        if (lowerFirst in obj) return obj[lowerFirst]
        const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
        return found ? obj[found] : undefined
      }

      const rows = (data || []).map((row: any) => {
        const tm = asObj(row.transcription_metrics)
        const md = asObj(row.metadata)
        const flattenedMd = Object.fromEntries(Object.entries(md).map(([k, v]) => [
          `metadata_${k}`, typeof v === 'object' ? JSON.stringify(v) : v
        ]))
        const flattenedTm = Object.fromEntries(Object.entries(tm).map(([k, v]) => [
          `transcription_${k}`, typeof v === 'object' ? JSON.stringify(v) : v
        ]))

        return {
          id: row.id,
          customer_number: row.customer_number,
          call_id: row.call_id,
          call_ended_reason: row.call_ended_reason,
          call_started_at: row.call_started_at,
          duration_seconds: row.duration_seconds,
          avg_latency: row.avg_latency,
          ...flattenedMd,
          ...flattenedTm,

          ...(config.jsonField && config.column === 'transcription_metrics'
            ? { [config.jsonField]: pickJsonValue(tm, config.jsonField) }
            : {}),
          ...(config.jsonField && config.column === 'metadata'
            ? { [config.jsonField]: pickJsonValue(md, config.jsonField) }
            : {}),
        }
      })


      if (!rows.length) {
        alert('No logs found for this custom total and date range.')
        return
      }

      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.name.replace(/\s+/g, '_').toLowerCase()}_${dateRange.from}_to_${dateRange.to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error(e)
      alert('Failed to download CSV')
    }
  }


  const handleSaveCustomTotal = async (config: CustomTotalConfig) => {

    try {
      const result = await CustomTotalsService.saveCustomTotal(config, project?.id, agent?.id)
      if (result.success) {
        await loadCustomTotals() // Reload the list
      } else {
        alert(`Failed to save: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save custom total:', error)
      alert('Failed to save custom total')
    }
  }

  // Handle deleting custom total
  const handleDeleteCustomTotal = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this custom total?')) return

    try {
      const result = await CustomTotalsService.deleteCustomTotal(configId)
      if (result.success) {
        await loadCustomTotals() // Reload the list
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete custom total:', error)
      alert('Failed to delete custom total')
    }
  }

  const formatCustomTotalValue = (result: CustomTotalResult, config: CustomTotalConfig) => {
    if (result.error) return 'Error'
    
    const value = typeof result.value === 'number' ? result.value : parseFloat(result.value as string) || 0
    
    // Format based on aggregation type
    switch (config.aggregation) {
      case 'AVG':
        return value.toFixed(2)
      case 'SUM':
        if (config.column.includes('cost')) {
          return `₹${value.toFixed(2)}`
        }
        return value.toLocaleString()
      case 'COUNT':
      case 'COUNT_DISTINCT':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }

  // Prepare chart data
  const successFailureData = (analytics?.successfulCalls !== undefined && analytics?.totalCalls !== undefined) ? [
    { name: 'Success', value: analytics.successfulCalls, color: '#007AFF' },
    { name: 'Failed', value: analytics.totalCalls - analytics.successfulCalls, color: '#FF3B30' }
  ] : []

  const successRate = (analytics?.totalCalls && analytics?.successfulCalls !== undefined && analytics.totalCalls > 0) 
    ? (analytics.successfulCalls / analytics.totalCalls) * 100 
    : 0


  if (loading || roleLoading || role === null) {
    return (
      <div className="h-full bg-gray-25 flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mx-auto shadow-sm">
              <CircleNotch weight="light" className="w-7 h-7 animate-spin text-gray-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Loading Analytics</h3>
            <p className="text-sm text-gray-500">Fetching your dashboard data</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-950/50">
        {/* Overview Header */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-100 via-white to-slate-100 bg-clip-text text-transparent tracking-tight">
            Overview
          </h2>
          <p className="text-slate-400 font-medium">
            {getDateRangeDisplay()}
          </p>
        </div>
      </div>
    )
  }

  // Debug all analytics data
  console.log('🔍 Overview RENDER - Full analytics object:', analytics)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-950/50">
      {/* Overview Header */}
      <div className="space-y-3">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-100 via-white to-slate-100 bg-clip-text text-transparent tracking-tight">
          Overview
        </h2>
        <p className="text-slate-400 font-medium">
          {getDateRangeDisplay()}
        </p>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Total Calls */}
        <div className="group">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <Phone weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                    Total
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Calls</h3>
                <p className="text-2xl font-light text-slate-100 tracking-tight">{analytics?.totalCalls?.toLocaleString() || '0'}</p>
                <p className="text-xs text-slate-400 font-medium">{getDateRangeDisplay()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="group">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg">
                  <Clock weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                    {analytics?.totalCalls && analytics?.totalCallMinutes ? Math.round(analytics.totalCallMinutes / analytics.totalCalls) : 0}m avg
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Duration</h3>
                <p className="text-2xl font-light text-slate-100 tracking-tight">
                  {analytics?.averageDuration 
                    ? `${Math.floor(analytics.averageDuration / 60)}:${(analytics.averageDuration % 60).toString().padStart(2, '0')}`
                    : '0:00'
                  }
                </p>
                <p className="text-xs text-slate-400 font-medium">{getDateRangeDisplay()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Successful Calls */}
        <div className="group">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg">
                  <CheckCircle weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-md border border-green-500/30">
                    <ArrowUp weight="bold" className="w-3 h-3 text-green-400" />
                    <span className="text-xs font-bold text-green-400">
                      {analytics ? successRate.toFixed(1) : '0.0'}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Successful</h3>
                <p className="text-2xl font-light text-slate-100 tracking-tight">{analytics?.successfulCalls?.toLocaleString() || '0'}</p>
                <p className="text-xs text-slate-400 font-medium">{getDateRangeDisplay()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Failed Calls */}
        <div className="group">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg">
                  <XCircle weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-md border border-red-500/30">
                    <ArrowDown weight="bold" className="w-3 h-3 text-red-400" />
                    <span className="text-xs font-bold text-red-400">
                      {analytics ? (100 - successRate).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Failed</h3>
                <p className="text-2xl font-light text-slate-100 tracking-tight">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls).toLocaleString() : '0'}</p>
                <p className="text-xs text-slate-400 font-medium">{getDateRangeDisplay()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="group">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                  <Activity weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                    {analytics?.totalCalls ? Math.round((analytics?.totalTokens || 0) / analytics.totalCalls) : 0} avg
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tokens</h3>
                <p className="text-2xl font-light text-slate-100 tracking-tight">
                  {analytics?.totalTokens?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-slate-400 font-medium">{getDateRangeDisplay()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Totals */}
        {customTotals.map((config) => {
          const result = customTotalResults.find(r => r.configId === config.id)
          const IconComponent = ICON_COMPONENTS[config.icon as keyof typeof ICON_COMPONENTS] || Users
          const colorClass = COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue

          return (
            <div key={config.id} className="group">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl hover:shadow-3xl hover:border-slate-700/50 transition-all duration-300">
                <div className="p-4 md:p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${colorClass} rounded-xl shadow-lg`}>
                      <IconComponent weight="regular" className="w-5 h-5 text-white drop-shadow-sm" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-slate-800/50"
                        onClick={() => handleDownloadCustomTotal(config)}
                        title="Download matching logs"
                      >
                        <Download className="h-3 w-3 text-slate-400" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 hover:bg-slate-800/50"
                          >
                            <MoreHorizontal className="h-3 w-3 text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDeleteCustomTotal(config.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate" title={config.name}>
                      {config.name}
                    </h3>
                    <p className="text-2xl font-light text-slate-100 tracking-tight">
                      {loadingCustomTotals || !result ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      ) : (
                        formatCustomTotalValue(result, config)
                      )}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {config.filters.length > 0 
                        ? `${config.filters.length} filter${config.filters.length > 1 ? 's' : ''} (${config.filterLogic})`
                        : 'No filters'
                      }
                    </p>
                    {result?.error && (
                      <p className="text-xs text-red-500 mt-1">
                        {result.error}
                      </p>
                    )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            </div>

            {process.env.NODE_ENV === 'development' && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="text-sm">
                    <strong>Debug - Dynamic Fields:</strong>
                    <div>Metadata: {metadataFields.join(', ') || 'None'}</div>
                    <div>Transcription: {transcriptionFields.join(', ') || 'None'}</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Responsive Chart Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Daily Calls Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-4 md:px-6 lg:px-7 py-4 md:py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <TrendUp weight="regular" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-gray-900 tracking-tight">Daily Call Volume</h3>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Trend analysis over selected period</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 text-sm">
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500">Peak</div>
                        <div className="text-sm font-semibold text-gray-900">
                        {analytics?.dailyData && analytics.dailyData.length > 0 
                        ? Math.max(...analytics.dailyData.map(d => d.calls || 0)) 
                        : 0
                      }
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200"></div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500">Avg</div>
                        <div className="text-sm font-semibold text-gray-900">
                        {analytics?.dailyData && analytics.dailyData.length > 0 
                            ? Math.round(analytics.dailyData.reduce((sum, d) => sum + (d.calls || 0), 0) / analytics.dailyData.length) 
                            : 0
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6 lg:p-7">
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={45}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            backdropFilter: 'blur(20px)'
                          }}
                          labelStyle={{ color: '#374151', fontWeight: '600' }}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                          formatter={(value) => [`${value}`, 'Calls']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="calls" 
                          stroke="#007aff" 
                          strokeWidth={3}
                          fill="url(#callsGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: '#007aff', 
                            strokeWidth: 3, 
                            stroke: '#ffffff',
                            filter: 'drop-shadow(0 2px 4px rgba(0, 122, 255, 0.3))'
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Professional Success Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-4 md:px-6 lg:px-7 py-4 md:py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <Target weight="regular" className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-gray-900 tracking-tight">Success Analysis</h3>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Call completion metrics</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500">Success Rate</div>
                      <div className="text-2xl font-light text-green-600">{analytics ? successRate.toFixed(1) : '0.0'}%</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6 lg:p-7">
                  <div className="h-64 md:h-80 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-0">
                    <div className="relative">
                      {/* Modern Ring Chart */}
                      <div className="w-32 h-32 md:w-48 md:h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={successFailureData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={2}
                              dataKey="value"
                              strokeWidth={0}
                              startAngle={90}
                              endAngle={450}
                            >
                              {successFailureData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                backdropFilter: 'blur(20px)'
                              }}
                              formatter={(value, name) => [`${value} calls`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Center Statistics */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-3xl font-light text-gray-900 mb-1">{analytics?.totalCalls || 0}</div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="lg:ml-8 space-y-2 md:space-y-3 text-center lg:text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#007AFF' }}></div>
                        <div className="text-sm font-medium text-gray-700">Successful</div>
                        <div className="text-sm font-light text-gray-500">{analytics?.successfulCalls || 0}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF3B30' }}></div>
                        <div className="text-sm font-medium text-gray-700">Failed</div>
                        <div className="text-sm font-light text-gray-500">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls) : 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Minutes Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-4 md:px-6 lg:px-7 py-4 md:py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <ChartBar weight="regular" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-gray-900 tracking-tight">Usage Minutes</h3>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Daily conversation duration</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6 lg:p-7">
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}m`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value) => [`${value} min`, 'Duration']}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                        />
                        <Bar 
                          dataKey="minutes" 
                          fill="url(#minutesGradient)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Average Latency Chart */}
              <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-4 md:px-6 lg:px-7 py-4 md:py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
                        <Activity weight="regular" className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-gray-900 tracking-tight">Response Performance</h3>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Average latency metrics</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6 lg:p-7">
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff9500" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ff9500" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}s`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value) => [`${value}s`, 'Latency']}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avg_latency" 
                          stroke="#ff9500" 
                          strokeWidth={3}
                          fill="url(#latencyGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: '#ff9500', 
                            strokeWidth: 3, 
                            stroke: '#ffffff',
                            filter: 'drop-shadow(0 2px 4px rgba(255, 149, 0, 0.3))'
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Analytics Section */}
            <ChartProvider>
              <div className="space-y-6">
                <EnhancedChartBuilder 
                  agentId={agent.id}
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  metadataFields={metadataFields}
                  transcriptionFields={transcriptionFields}
                  fieldsLoading={fieldsLoading}
                />

                {/* Floating Action Menu */}
                {userEmail && !fieldsLoading && (
                  <FloatingActionMenu
                    metadataFields={metadataFields}
                    transcriptionFields={transcriptionFields}
                    agentId={agent?.id}
                    projectId={project?.id}
                    userEmail={userEmail}
                    availableColumns={AVAILABLE_COLUMNS}
                    onSaveCustomTotal={handleSaveCustomTotal}
                  />
                )}
              </div>
            </ChartProvider>
          </>
        ) : (
          <div className="h-64 bg-slate-900/50 border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 backdrop-blur-xl flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex items-center justify-center mx-auto">
                <CalendarBlank weight="light" className="w-8 h-8 text-slate-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-slate-200">No Data Available</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  No calls found for the selected time period. Try adjusting your date range or check back later.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Overview