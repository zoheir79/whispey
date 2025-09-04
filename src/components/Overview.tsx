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
import { useTheme } from '@/contexts/ThemeContext';

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
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
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

  const { resolvedTheme } = useTheme()

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
  const successFailureData = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    return (analytics?.successfulCalls !== undefined && analytics?.totalCalls !== undefined) ? [
      { name: 'Success', value: analytics.successfulCalls, color: '#007AFF' },
      { name: 'Failed', value: analytics.totalCalls - analytics.successfulCalls, color: isDark ? '#4b5563' : '#FF3B30' }
    ] : []
  }, [analytics, resolvedTheme]);

  const successRate = (analytics?.totalCalls && analytics?.successfulCalls !== undefined && analytics.totalCalls > 0) 
    ? (analytics.successfulCalls / analytics.totalCalls) * 100 
    : 0


  if (loading || roleLoading || role === null) {
    return (
      <div className="h-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 flex items-center justify-center mx-auto shadow-sm">
              <CircleNotch weight="light" className="w-7 h-7 animate-spin text-gray-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loading Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fetching your dashboard data</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 flex items-center justify-center mx-auto shadow-sm">
            <Warning weight="light" className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Unable to Load Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Debug all analytics data
  console.log('🔍 DEBUG Overview - Full analytics:', analytics);
  console.log('🔍 DEBUG Overview - Loading:', loading);
  console.log('🔍 DEBUG Overview - Error:', error);
  console.log('🔍 DEBUG Overview - Agent ID:', agent?.id);
  console.log('🔍 DEBUG Overview - Date Range:', dateRange);

  return (
    <div className="h-full bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        {analytics ? (
          <>
            {/* Responsive Metrics Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 md:gap-4">
              {/* Total Calls */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                        <Phone weight="regular" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Calls</h3>
                      <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                        {(() => {
                          const totalCalls = analytics?.totalCalls || 0;
                          console.log('🔍 DEBUG Overview - analytics.totalCalls raw:', analytics?.totalCalls);
                          console.log('🔍 DEBUG Overview - totalCalls processed:', totalCalls);
                          console.log('🔍 DEBUG Overview - typeof totalCalls:', typeof totalCalls);
                          return String(totalCalls).replace(/^0+/, '') || '0';
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Call Duration */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-800">
                        <Clock weight="regular" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                          {analytics?.totalCalls && analytics?.totalCallMinutes ? Math.round(analytics.totalCallMinutes / analytics.totalCalls) : 0}m avg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Call Duration</h3>
                      <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                        {Math.round(analytics?.totalCallMinutes || 0).toLocaleString()}
                        <span className="text-lg text-gray-500 dark:text-slate-400 ml-1">min</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Processing Time */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-100 dark:border-purple-800">
                        <Activity weight="regular" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                          STT+LLM+TTS
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">AI Processing</h3>
                      <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                        {(analytics?.totalAiProcessingMinutes || 0).toFixed(2)}
                        <span className="text-lg text-gray-500 dark:text-slate-400 ml-1">min</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Cost */}
              {role !== 'user' && (
                <div className="h-full">
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                    <div className="p-4 md:p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-100 dark:border-amber-800">
                          <CurrencyDollar weight="regular" className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">INR</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Cost</h3>
                        <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">₹{analytics?.totalCost?.toFixed(2) || '0.00'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Average Latency */}
              {role !== 'user' && (
                <div className="h-full">
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                    <div className="p-4 md:p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-100 dark:border-purple-800">
                          <Lightning weight="regular" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">avg</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Response Time</h3>
                        <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{analytics?.averageLatency?.toFixed(2) || '0.00'}<span className="text-lg text-gray-500 dark:text-slate-400 ml-1">s</span></p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Successful Calls */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                        <CheckCircle weight="regular" className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md border border-green-100 dark:border-green-800">
                          <ArrowUp weight="bold" className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">
                            {analytics ? successRate.toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Successful</h3>
                      <p className="text-2xl font-light text-green-600 dark:text-green-400 tracking-tight">{analytics?.successfulCalls?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Failed Calls */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800">
                        <XCircle weight="regular" className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md border border-red-100 dark:border-red-800">
                          <ArrowDown weight="bold" className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            {analytics ? (100 - successRate).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Failed</h3>
                      <p className="text-2xl font-light text-red-600 dark:text-red-400 tracking-tight">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls).toLocaleString() : '0'}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Tokens */}
              <div className="h-full">
                <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <Activity weight="regular" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                          {analytics?.totalCalls ? Math.round((analytics?.totalTokens || 0) / analytics.totalCalls) : 0} avg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Tokens</h3>
                      <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                        {analytics?.totalTokens?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{getDateRangeDisplay()}</p>
                    </div>
                  </div>
                </div>
              {customTotals.map((config) => {
              const result = customTotalResults.find(r => r.configId === config.id)

              const IconComponent = ICON_COMPONENTS[config.icon as keyof typeof ICON_COMPONENTS] || Users
              const colorClass = COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue

              return (
                <div key={config.id} className="group h-full">
                  <div className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-full">
                    <div className="p-4 md:p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-2 ${colorClass} rounded-lg border`}>
                          <IconComponent weight="regular" className={`w-5 h-5`} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-100"
                            onClick={() => handleDownloadCustomTotal(config)}
                            title="Download matching logs"
                          >
                            <Download className="h-3 w-3 text-gray-400" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                <MoreHorizontal className="h-3 w-3 text-gray-400 dark:text-gray-500" />
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
                        <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate" title={config.name}>
                          {config.name}
                        </h3>
                        <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                          {loadingCustomTotals || !result ? (
                            <Loader2 className="w-5 h-5 animate-spin text-gray-300 dark:text-gray-500" />
                          ) : (
                            formatCustomTotalValue(result, config)
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Daily Calls Chart */}
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-[480px] flex flex-col">
                <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                        <TrendUp weight="regular" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Daily Calls</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {analytics?.dailyData && analytics.dailyData.length > 0 
                          ? Math.round(analytics.dailyData.reduce((sum, d) => sum + (d.calls || 0), 0) / analytics.dailyData.length) 
                          : 0
                        }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke={resolvedTheme === 'dark' ? '#3e4c5f' : '#f3f4f6'} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          width={45}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: resolvedTheme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.98)',
                            border: `1px solid ${resolvedTheme === 'dark' ? '#4a5568' : '#e5e7eb'}`,
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            backdropFilter: 'blur(20px)'
                          }}
                          labelStyle={{ color: resolvedTheme === 'dark' ? '#e2e8f0' : '#374151', fontWeight: '600' }}
                          labelFormatter={(value: any) => {
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
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-[480px] flex flex-col">
                <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                        <Target weight="regular" className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Success Analysis</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Success Rate</div>
                      <div className="text-lg font-semibold text-green-600">{analytics ? successRate.toFixed(1) : '0.0'}%</div>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1 flex items-center justify-center">
                  <div className="h-full flex items-center justify-center gap-8 w-full">
                    <div className="relative">
                      {/* Modern Ring Chart */}
                      <div className="w-40 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={successFailureData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
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
                                backgroundColor: resolvedTheme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.98)',
                                border: `1px solid ${resolvedTheme === 'dark' ? '#4a5568' : '#e5e7eb'}`,
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                backdropFilter: 'blur(20px)'
                              }}
                              formatter={(value: any, name: any) => [`${value} calls`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Center Statistics */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                        <div className="text-3xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                          {successRate.toFixed(1)}<span className="text-xl text-gray-500 dark:text-gray-400">%</span>
                        </div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Success</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#007AFF' }}></div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Successful</div>
                        <div className="text-sm font-light text-gray-500 dark:text-gray-400">{analytics?.successfulCalls || 0}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF3B30' }}></div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Failed</div>
                        <div className="text-sm font-light text-gray-500 dark:text-gray-400">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls) : 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Minutes Chart */}
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-[480px] flex flex-col">
                <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                        <ChartBar weight="regular" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Usage Minutes</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke={resolvedTheme === 'dark' ? '#3e4c5f' : '#f3f4f6'} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}m`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: resolvedTheme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.98)',
                            border: `1px solid ${resolvedTheme === 'dark' ? '#4a5568' : '#e5e7eb'}`,
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value: any) => [`${value} min`, 'Duration']}
                          labelFormatter={(value: any) => {
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
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300 h-[480px] flex flex-col">
                <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-100 dark:border-orange-800">
                        <Activity weight="regular" className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Response Performance</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff9500" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ff9500" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke={resolvedTheme === 'dark' ? '#3e4c5f' : '#f3f4f6'} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: resolvedTheme === 'dark' ? '#94a3b8' : '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}s`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: resolvedTheme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.98)',
                            border: `1px solid ${resolvedTheme === 'dark' ? '#4a5568' : '#e5e7eb'}`,
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value: any) => [`${value}s`, 'Latency']}
                          labelFormatter={(value: any) => {
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
              <div className="space-y-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
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
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-8">
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 flex items-center justify-center mx-auto shadow-sm">
                <CalendarBlank weight="light" className="w-10 h-10 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">No Data Available</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
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

export default Overview;