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



interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
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
        className="w-full max-w-full overflow-hidden border rounded-md bg-muted/20"
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





const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {

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
    // Add other role restrictions as needed
    // viewer: ['total_cost'],
    // editor: [], // No restrictions
    // admin: []  // No restrictions
  }

  const isColumnVisibleForRole = (columnKey: string, role: string | null): boolean => {
    if (!role) return false
    
    const restrictedColumns = ROLE_RESTRICTIONS[role as keyof typeof ROLE_RESTRICTIONS]
    if (!restrictedColumns) return true // If role not in restrictions, show all
    
    return !restrictedColumns.includes(columnKey)
  }


    const dynamicColumnsKey = (() => {
      try {
        const prompt = agent?.field_extractor_prompt;
        if (typeof prompt === 'string') {
          const parsed = JSON.parse(prompt);
          return Array.isArray(parsed) ? parsed.map((item: any) => toCamelCase(item.key)) : [];
        } else if (Array.isArray(prompt)) {
          return prompt.map((item: any) => toCamelCase(item.key));
        }
        return [];
      } catch (error) {
        console.error('Error parsing field_extractor_prompt:', error);
        return [];
      }
    })();
    const [roleLoading, setRoleLoading] = useState(true) // Add loading state for role
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: basicColumns.filter(col => !col.hidden).map(col => col.key), // initially show all
    metadata: [],
    transcription_metrics: []
  })

  console.log(dynamicColumnsKey)



  const getFilteredBasicColumns = useMemo(() => {
    return basicColumns.filter(col => 
      !col.hidden && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  // Convert FilterRule[] to fetchFromTable filter format
  const convertToFetchFilters = (filters: FilterRule[]) => {
    const fetchFilters = [{ column: "agent_id", operator: "=", value: agent?.id }]
    
    filters.forEach(filter => {
      // Determine the column name (with JSONB path if applicable)
      // Use ->> for text operations, -> for existence checks and numeric comparisons
      const getColumnName = (forTextOperation = false) => {
        if (!filter.jsonField) return filter.column
        
        if (forTextOperation) {
          return `${filter.column}->>${filter.jsonField}` // Double arrow for text extraction
        } else {
          return `${filter.column}->${filter.jsonField}` // Single arrow for JSONB data
        }
      }
      
      switch (filter.operation) {
        // Regular operations
        case 'equals':
          if (filter.column === 'call_started_at') {
            const startOfDay = `${filter.value} 00:00:00`
            const endOfDay = `${filter.value} 23:59:59.999`
            fetchFilters.push({ 
              column: filter.column, 
              operator: '>=', 
              value: startOfDay
            })
            fetchFilters.push({ 
              column: filter.column, 
              operator: '<=', 
              value: endOfDay
            })
          } else {
            fetchFilters.push({ 
              column: getColumnName(false), 
              operator: '=', 
              value: filter.value 
            })
          }
          break
          
        case 'contains':
          fetchFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'starts_with':
          fetchFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `${filter.value}%` 
          })
          break
          
        case 'greater_than':
          if (filter.column === 'call_started_at') {
            const nextDay = new Date(filter.value)
            nextDay.setDate(nextDay.getDate() + 1)
            const nextDayStr = nextDay.toISOString().split('T')[0]
            fetchFilters.push({ 
              column: filter.column, 
              operator: '>=', 
              value: `${nextDayStr} 00:00:00`
            })
          } else {
            fetchFilters.push({ 
              column: getColumnName(false), 
              operator: '>', 
              value: filter.value 
            })
          }
          break
          
        case 'less_than':
          if (filter.column === 'call_started_at') {
            fetchFilters.push({ 
              column: filter.column, 
              operator: '<', 
              value: `${filter.value} 00:00:00`
            })
          } else {
            fetchFilters.push({ 
              column: getColumnName(false), 
              operator: '<', 
              value: filter.value 
            })
          }
          break
  
        // JSONB-specific operations
        case 'json_equals':
          fetchFilters.push({ 
            column: getColumnName(true), // Use ->> for text comparison
            operator: '=', 
            value: filter.value 
          })
          break
          
        case 'json_contains':
          fetchFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'json_greater_than':
          // For numeric JSONB fields, use -> and cast to numeric
          fetchFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: '>', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_less_than':
          // For numeric JSONB fields, use -> and cast to numeric
          fetchFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: '<', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_exists':
          // Check if the JSONB field exists (is not null)
          fetchFilters.push({ 
            column: getColumnName(false), // Use -> for existence check
            operator: 'is not', 
            value: 'null' 
          })
          break
          
        default:
          console.warn(`Unknown filter operation: ${filter.operation}`)
          break
      }
    })
    
    return fetchFilters
  }

  const handleColumnChange = (type: 'basic' | 'metadata' | 'transcription_metrics', column: string, visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible 
        ? [...prev[type], column]
        : prev[type].filter(col => col !== column)
    }))
    }
    
    const handleSelectAll = (type: 'basic' | 'metadata' | 'transcription_metrics', visible: boolean) => {
      setVisibleColumns(prev => ({
        ...prev,
        [type]: visible
          ? (type === "basic" ? basicColumns.map(col => col.key) : dynamicColumns[type])
          : []
      }))
    }



// JWT auth handled at page level, user context removed

  // Load user role first
  useEffect(() => {
    // JWT auth provides user context at page level, defaulting to 'admin' role
    // TODO: Implement proper role fetching from JWT token payload
    setRole('admin')
    setRoleLoading(false)
  }, [project?.id])

  // Update visible columns when role changes
  useEffect(() => {
    if (role !== null) {
      const allowedBasicColumns = getFilteredBasicColumns.map(col => col.key)
      setVisibleColumns(prev => ({
        ...prev,
        basic: allowedBasicColumns

      }))
    }
  }, [role, getFilteredBasicColumns])



  const queryOptions = useMemo(() => {
    // Build select clause based on role permissions
    let selectColumns = [
      'id',
      'call_id',
      'customer_number',
      'call_ended_reason',
      'call_started_at',
      'call_ended_at',
      'duration_seconds',
      'recording_url',
      'metadata',
      'environment',
      'transcript_type',
      'transcript_json',
      'transcript_with_metrics',
      'created_at',
      'transcription_metrics',
      'total_llm_cost',
      'total_tts_cost',
      'total_stt_cost',
      'avg_latency'
    ]

    // Add role-restricted columns only if user has permission
    if (isColumnVisibleForRole('avg_latency', role)) {
      selectColumns.push('avg_latency')
    }
    
    if (isColumnVisibleForRole('total_llm_cost', role)) {
      selectColumns.push('total_llm_cost', 'total_tts_cost', 'total_stt_cost')
    }

    return {
      select: selectColumns.join(','),
      filters: convertToFetchFilters(activeFilters),
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }
  }, [agent?.id, activeFilters, role])

  

  const { data: calls, loading, hasMore, error, loadMore, refresh } = useInfiniteScrollWithFetch("pype_voice_call_logs", queryOptions)

  console.log(calls)
  // Extract all unique keys from metadata and transcription_metrics across all calls
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()

    calls.forEach((call: CallLog) => {
      // Extract metadata keys
      if (call.metadata && typeof call.metadata === 'object') {
        Object.keys(call.metadata).forEach(key => metadataKeys.add(key))
      }

      // Extract transcription_metrics keys
      if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
        Object.keys(call.transcription_metrics).forEach(key => transcriptionKeys.add(key))
      }
    })

    return {
      metadata: Array.from(metadataKeys).sort(),
      transcription_metrics: Array.from(transcriptionKeys).sort()
    }
  }, [calls])

  console.log(dynamicColumns)

  // Initialize visible columns when dynamic columns change
  useEffect(() => {
    setVisibleColumns((prev) => ({
      basic: prev.basic ?? basicColumns.map((col) => col.key),
      metadata: Array.from(
        new Set(
          (prev.metadata.length === 0 ? dynamicColumns.metadata : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col)))
        )
      ),
      transcription_metrics: dynamicColumnsKey
    }))
  }, [dynamicColumns, basicColumns, JSON.stringify(dynamicColumnsKey)])
  

  // Fixed handleDownloadCSV function using fetchFromTable
  const handleDownloadCSV = async () => {
    const { basic, metadata, transcription_metrics } = visibleColumns;

    console.log('Download initiated with visible columns:', { basic, metadata, transcription_metrics });

    // Always include id and agent_id for filtering, plus metadata and transcription_metrics if needed
    const selectColumns = [
      'id',
      'agent_id',
      ...basic.filter(col => col !== "total_cost"), // Exclude calculated field
      ...(metadata.length > 0 ? ['metadata'] : []),
      ...(transcription_metrics.length > 0 ? ['transcription_metrics'] : []),
    ];

    console.log('Select columns:', selectColumns);

    try {
      // Préparer les options pour fetchFromTable
      const queryOptions = {
        table: "pype_voice_call_logs",
        select: selectColumns.join(','),
        filters: convertToFetchFilters(activeFilters),
        orderBy: { column: "created_at", ascending: false }
      };
      
      console.log('Applying filters:', queryOptions.filters);

      // Fetch all data in chunks
      let allData: CallLog[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      console.log('Starting data fetch...');

      while (hasMoreData) {
        // Add pagination to query options
        const paginatedOptions = {
          ...queryOptions,
          limit: pageSize,
          offset: page * pageSize
        };
        
        // Execute the query with API endpoint
        const { data, error } = await fetchFromAPI(paginatedOptions);

        if (error) {
          console.error('Error fetching data for CSV:', error);
          alert("Failed to fetch data for export: " + (error as any)?.message || 'Unknown error');
          return;
        }

        if (data && data.length > 0) {
          // Ensure proper type casting
          const typedData = data as unknown as CallLog[];
          allData = [...allData, ...typedData];
          console.log(`Fetched page ${page + 1}, total records: ${allData.length}`);
          
          // If we got less than pageSize, we're done
          if (data.length < pageSize) {
            hasMoreData = false;
          } else {
            page += 1;
          }
        } else {
          hasMoreData = false;
        }
      }

      console.log('Total records fetched:', allData.length);

      if (allData.length === 0) {
        alert("No data found to export");
        return;
      }

      // Debug: Check first record
      console.log('Sample record:', allData[0]);
      console.log('Sample metadata:', allData[0]?.metadata);
      console.log('Sample transcription_metrics:', allData[0]?.transcription_metrics);

      // Flatten data for CSV - FIXED VERSION
      const csvData = allData.map((row, index) => {
        const flattened = flattenAndPickColumnsFixed(row, basic, metadata, transcription_metrics);
        
        // Debug first few records
        if (index < 3) {
          console.log(`Flattened record ${index}:`, flattened);
        }
        
        return flattened;
      });

      console.log('CSV headers would be:', Object.keys(csvData[0] || {}));

      // Generate and download CSV
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `call_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('CSV download completed');

    } catch (error) {
      console.error('Download error:', error);
      alert("Failed to download CSV: " + (error as Error).message);
    }
  };

  // Fixed flatten function with better debugging
  function flattenAndPickColumnsFixed(
    row: CallLog,
    basic: string[],
    metadata: string[],
    transcription: string[]
  ): Record<string, any> {
    const flat: Record<string, any> = {};

    console.log('Flattening row:', {
      id: row.id,
      hasMetadata: !!row.metadata,
      hasTranscription: !!row.transcription_metrics,
      metadataType: typeof row.metadata,
      transcriptionType: typeof row.transcription_metrics
    });

    // Basic columns (exclude "total_cost" as it's calculated)
    for (const key of basic) {
      if (key in row && key !== 'total_cost') {
        flat[key] = row[key as keyof CallLog];
      }
    }

    // Add calculated total_cost if requested
    if (basic.includes('total_cost')) {
      const totalCost = (row.total_llm_cost || 0) + (row.total_tts_cost || 0) + (row.total_stt_cost || 0);
      flat['total_cost'] = totalCost;
    }

    // Metadata columns - FIXED
    if (row.metadata && typeof row.metadata === "object" && metadata.length > 0) {
      console.log('Processing metadata fields:', metadata);
      console.log('Available metadata keys:', Object.keys(row.metadata));
      
      for (const key of metadata) {
        const value = row.metadata[key];
        // Prefix with 'metadata_' to avoid column name conflicts
        flat[`metadata_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (metadata.length > 0) {
      // Add empty values for missing metadata
      for (const key of metadata) {
        flat[`metadata_${key}`] = '';
      }
    }

    // Transcription metrics columns - FIXED
    if (row.transcription_metrics && typeof row.transcription_metrics === "object" && transcription.length > 0) {
      console.log('Processing transcription fields:', transcription);
      console.log('Available transcription keys:', Object.keys(row.transcription_metrics));
      
      for (const key of transcription) {
        const value = row.transcription_metrics[key];
        // Prefix with 'transcription_' to avoid column name conflicts
        flat[`transcription_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (transcription.length > 0) {
      // Add empty values for missing transcription_metrics
      for (const key of transcription) {
        flat[`transcription_${key}`] = '';
      }
    }

    console.log('Final flattened keys:', Object.keys(flat));
    return flat;
  }

  // Responsive table - no fixed width calculations needed

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refresh()
  }, [activeFilters])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  const handleFiltersChange = (filters: FilterRule[]) => {
    setActiveFilters(filters)
    setTimeout(() => refresh(), 100)
  }

  const handleClearFilters = () => {
    setActiveFilters([])
    setTimeout(() => refresh(), 100)
  }

  const handleRefresh = () => {
    refresh()
  }


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatToIndianDateTime = (timestamp: any) => {
    console.log('🔍 DEBUG - formatToIndianDateTime input:', timestamp, typeof timestamp)
    
    const date = new Date(timestamp)
    console.log('🔍 DEBUG - parsed date:', date.toString())
    console.log('🔍 DEBUG - date UTC:', date.toISOString())
    
    // Don't add timezone offset - let the browser handle local time display
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Europe/Paris' // Use Paris timezone (UTC+1)
    })
  }

  if (error) {
    return (
      <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unable to load calls</h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state until role is determined
  if (roleLoading || role === null) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-48"></div>
            <div className="flex items-center gap-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-24"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-24"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-8"></div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 mt-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
            <p className="text-gray-600 dark:text-gray-400">Loading permissions...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header with Filters and Column Selector */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
            availableMetadataFields={dynamicColumns.metadata}
            availableTranscriptionFields={dynamicColumnsKey}
          />
          
          <div className="flex items-center gap-2">
          <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={loading}
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={basicColumns.map((col) => col.key)}
              basicColumnLabels={Object.fromEntries(basicColumns.filter(col => !col.hidden).map((col) => [col.key, col.label]))}
              metadataColumns={dynamicColumns.metadata}
              transcriptionColumns={dynamicColumnsKey}
              visibleColumns={visibleColumns}
              onColumnChange={handleColumnChange}
              onSelectAll={handleSelectAll}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2 h-8 w-8 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
          </div>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="flex-1 space-y-4 p-6">
        {loading && calls.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading calls...</p>
            </div>
          </div>
        ) : calls.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {activeFilters.length > 0 ? "No calls match your filters" : "No calls found"}
            </h3>
            <p className="text-muted-foreground">
              {activeFilters.length > 0
                ? "Try adjusting your filters to find what you're looking for."
                : "Calls will appear here once your agent starts handling conversations."}
            </p>
          </div>
        ) : (
          <div className="group">
            <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300 overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    {/* Basic Columns */}
                    {visibleColumns.basic.map((key) => {
                      const col = basicColumns.find((c) => c.key === key)
                      return (
                        <TableHead key={`basic-${key}`} className="font-semibold">
                          {col?.label ?? key}
                        </TableHead>
                      )
                    })}

                    {/* Dynamic Metadata Columns */}
                    {visibleColumns.metadata.map((key) => (
                      <TableHead 
                        key={`metadata-${key}`} 
                        className="font-semibold text-foreground"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                    
                    {/* Dynamic Transcription Metrics Columns */}
                    {visibleColumns.transcription_metrics.map((key) => (
                      <TableHead 
                        key={`transcription-${key}`} 
                        className="font-semibold text-foreground"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call: CallLog) => (
                    <TableRow
                      key={call.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCall(call)}
                    >
              {visibleColumns.basic.map((key) => {
                let value: React.ReactNode = "-"

                switch (key) {
                  case "customer_number":
                    value = (
                      <div className="flex w-full items-center gap-3">
                        <div className="w-10 h-8 rounded-full  flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{call.customer_number}</span>
                      </div>
                    )
                    break
                  case "call_id":
                    value = (
                      <code className="text-xs bg-muted/60 px-3 py-1.5 rounded-md font-mono">
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
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    )
                    break
                  case "call_started_at":
                    value = formatToIndianDateTime(call.call_started_at)
                    break
                  case "avg_latency":
                    value = call?.avg_latency ? (
                      <span className="font-mono">{call.avg_latency.toFixed(2)}s</span>
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

                      {/* Dynamic Metadata Columns */}
                      {visibleColumns.metadata.map((key) => (
                        <TableCell 
                          key={`metadata-${call.id}-${key}`} 
                          className="py-4"
                        >
                          <DynamicJsonCell 
                            data={call.metadata} 
                            fieldKey={key}
                          />
                        </TableCell>
                      ))}

                      {/* Dynamic Transcription Metrics Columns */}
                      {visibleColumns.transcription_metrics.map((key) => (
                        <TableCell 
                          key={`transcription-${call.id}-${key}`} 
                          className="py-4"
                        >
                          <DynamicJsonCell 
                            data={call.transcription_metrics} 
                            fieldKey={key}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Load More Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="py-6 text-center">
                {loading && <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />}
              </div>
            )}

            {/* End of List */}
            {!hasMore && calls.length > 0 && (
              <div className="py-4 text-muted-foreground text-sm text-center">
                All calls loaded ({calls.length} total)
              </div>
            )}
          </div>
        )}
      </div>
      
      <CallDetailsDrawer 
        isOpen={!!selectedCall} 
        callData={selectedCall} 
        onClose={() => setSelectedCall(null)} 
      />
    </div>
  )
}

export default CallLogs