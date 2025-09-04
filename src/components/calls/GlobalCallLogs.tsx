"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { useInfiniteScrollWithFetch } from "@/hooks/useInfiniteScrollWithFetch"
import CallDetailsDrawer from "./CallDetailsDrawer"
import CallFilter, { FilterRule } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { CostTooltip } from "../tool-tip/costToolTip"
import { CallLog } from "../../types/logs"
// DB operations now handled by useInfiniteScrollWithFetch hook using API endpoints

// Client-safe API call function for CSV export
const fetchFromAPI = async (query: any) => {
  const response = await fetch('/api/db-rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'fetchFromTable',
      params: query
    })
  })

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'API call failed')
  }
  
  return { data: result.data, error: null }
}

import Papa from 'papaparse'
// JWT auth is handled at the page level
import { getUserProjectRole } from "@/services/getUserRole"



interface GlobalCallLogsProps {
  // No props needed for global view
}

function flattenAndPickColumns(
  row: CallLog,
  basic: string[],
  metadata: string[],
  transcription: string[]
): Record<string, any> {
  const flat: Record<string, any> = {};

  // Basic columns (skip "total_cost")
  for (const key of basic) {
    if (key in row) {
      flat[key] = row[key as keyof CallLog];
    }
  }

  // Metadata columns
  if (row.metadata && typeof row.metadata === "object") {
    for (const key of metadata) flat[key] = row.metadata[key];
  }

  // Transcription metrics columns
  if (row.transcription_metrics && typeof row.transcription_metrics === "object") {
    for (const key of transcription) flat[key] = row.transcription_metrics[key];
  }

  return flat;
}



const TruncatedText: React.FC<{ 
  text: string; 
  maxLength?: number;
  className?: string;
}> = ({ text, maxLength = 30, className = "" }) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  
  return (
    <span 
      className={cn("break-words", className)}
      title={text.length > maxLength ? text : undefined}
    >
      {truncated}
    </span>
  )
}

// Dynamic JSON Cell Component - Fixed version with better text handling
const DynamicJsonCell: React.FC<{ 
  data: any; 
  fieldKey: string;
  maxWidth?: string;
}> = ({ data, fieldKey, maxWidth = "180px" }) => {
  if (!data || typeof data !== 'object') {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const value = data[fieldKey]
  
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  // Handle different data types
  if (typeof value === 'object') {
    const jsonString = JSON.stringify(value, null, 2)
    const truncatedJson = jsonString.length > 80 ? jsonString.substring(0, 80) + '...' : jsonString
    
    return (
      <div 
        className="w-full max-w-full overflow-hidden border rounded-md bg-muted/20 dark:bg-slate-700"
        style={{ maxWidth }}
      >
        <div className="p-1.5 w-full overflow-hidden">
          <pre 
            className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden w-full"
            style={{ 
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
              maxWidth: '100%'
            }}
            title={jsonString}
          >
            {truncatedJson}
          </pre>
        </div>
      </div>
    )
  }

  // Handle primitive values - truncate long strings
  const stringValue = String(value)
  const shouldTruncate = stringValue.length > 25
  const displayValue = shouldTruncate ? stringValue.substring(0, 25) + '...' : stringValue

  return (
    <div 
      className="text-xs w-full overflow-hidden" 
      style={{ maxWidth }}
    >
      <span 
        className="text-foreground font-medium block w-full overflow-hidden"
        style={{ 
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={shouldTruncate ? stringValue : undefined}
      >
        {displayValue}
      </span>
    </div>
  )
}




const GlobalCallLogs: React.FC<GlobalCallLogsProps> = () => {
  // State for loading all calls globally
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  // Convert string to camelCase
  function toCamelCase(str: string) {
    return str
      .replace(/[^\w\s]/g, '')
      .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, c => c.toLowerCase())
  }

  const basicColumns = useMemo(
    () => [
      { key: "customer_number", label: "Customer Number" },
      { key: "call_id", label: "Call ID" },
      { key: "call_ended_reason", label: "Call Status" },
      { key: "duration_seconds", label: "Duration" },
      {
        key: "total_cost",
        label: "Total Cost (₹)",
      },
      { key: "call_started_at", label: "Start Time" },
      { key: "avg_latency", label: "Avg Latency (ms)" },
      { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
      { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
      { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
    ],
    [],
  )

  const ROLE_RESTRICTIONS = {
    user: [
      'total_cost',
      'total_llm_cost', 
      'total_tts_cost',
      'total_stt_cost',
      'avg_latency'
    ],
  }

  const isColumnVisibleForRole = (columnKey: string, role: string | null): boolean => {
    if (!role) return false
    
    const restrictedColumns = ROLE_RESTRICTIONS[role as keyof typeof ROLE_RESTRICTIONS]
    if (!restrictedColumns) return true // If role not in restrictions, show all
    
    return !restrictedColumns.includes(columnKey)
  }

  const [visibleColumns, setVisibleColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: basicColumns.filter(col => !col.hidden).map(col => col.key), // initially show all
    metadata: [],
    transcription_metrics: []
  })

  const getFilteredBasicColumns = useMemo(() => {
    return basicColumns.filter(col => 
      !col.hidden && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  // Fetch all calls globally using /api/calls endpoint
  const fetchGlobalCalls = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/calls')
      if (!response.ok) {
        throw new Error(`Failed to fetch calls: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      // API returns { calls: [...], total: number, userRole: string }
      setCalls(data.calls || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setCalls([])
    } finally {
      setLoading(false)
    }
  }

  // Load calls on mount
  useEffect(() => {
    fetchGlobalCalls()
  }, [])

  // Get user role for global context
  useEffect(() => {
    const fetchRole = async () => {
      try {
        setRoleLoading(true)
        // For global context, use default role or check global role
        // TODO: Implement global role checking if needed
        setRole('admin') // Default to admin for global view
      } catch (error) {
        console.error('Error fetching user role:', error)
        setRole('user') // Default to user role
      } finally {
        setRoleLoading(false)
      }
    }

    fetchRole()
  }, [])

  // Format duration in seconds to readable format
  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) {
      return '-'
    }
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    
    if (minutes === 0) {
      return `${remainingSeconds}s`
    }
    
    return `${minutes}m ${remainingSeconds}s`
  }

  // Format date to Indian timezone
  const formatToIndianDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      return dateString
    }
  }

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2 dark:text-gray-100">Loading global calls...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Error loading calls</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchGlobalCalls} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Calls</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Viewing {calls.length} calls across all projects
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={fetchGlobalCalls}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Calls Table */}
      {calls.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2 dark:text-gray-100">No calls found</h3>
          <p className="text-muted-foreground dark:text-slate-400">
            No calls have been made yet across all projects.
          </p>
        </div>
      ) : (
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <Table>
            <TableHeader>
              <TableRow>
                {getFilteredBasicColumns.map((column) => (
                  <TableHead key={column.key} className="font-semibold">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow
                  key={call.id}
                  className="cursor-pointer hover:bg-muted/50 dark:hover:bg-slate-700/50"
                  onClick={() => setSelectedCall(call)}
                >
                  {visibleColumns.basic.map((key) => {
                    let value: React.ReactNode = "-"

                    switch (key) {
                      case "customer_number":
                        value = (
                          <div className="flex w-full items-center gap-3">
                            <div className="w-10 h-8 rounded-full flex items-center justify-center">
                              <Phone className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium dark:text-gray-100">{call.customer_number}</span>
                          </div>
                        )
                        break
                      case "call_id":
                        value = (
                          <code className="text-xs bg-muted/60 dark:text-gray-100 px-3 py-1.5 rounded-md font-mono">
                            {call.call_id.slice(-8)}
                          </code>
                        )
                        break
                      case "call_ended_reason":
                        value = (
                          <Badge
                            variant={call.call_ended_reason === "completed" ? "default" : "destructive"}
                            className="text-xs font-medium px-2.5 py-1"
                          >
                            {call.call_ended_reason === "completed" ? (
                              <CheckCircle className="w-3 h-3 mr-1.5" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1.5" />
                            )}
                            {call.call_ended_reason}
                          </Badge>
                        )
                        break
                      case "duration_seconds":
                        value = (
                          <div className="flex items-center gap-2 text-sm font-medium dark:text-gray-100">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {formatDuration(call.duration_seconds)}
                          </div>
                        )
                        break
                      case "call_started_at":
                                                value = <span className="dark:text-gray-100">{formatToIndianDateTime(call.call_started_at)}</span>
                        break
                      case "avg_latency":
                        value = call?.avg_latency ? (
                          <span className="font-mono dark:text-gray-100">{call.avg_latency.toFixed(2)}s</span>
                        ) : "-"
                        break
                      case "total_cost":
                        value = call?.total_llm_cost || call?.total_tts_cost || call?.total_stt_cost ? (
                          <CostTooltip call={call}/>
                        ) : "-"
                        break
                    }

                    return (
                      <TableCell key={`basic-${call.id}-${key}`} className="py-4">
                        {value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <CallDetailsDrawer 
        isOpen={!!selectedCall} 
        callData={selectedCall} 
        onClose={() => setSelectedCall(null)} 
      />
    </div>
  )
}

export default GlobalCallLogs
