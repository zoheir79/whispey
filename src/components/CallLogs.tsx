// components/CallLogs.tsx - FIXED VERSION
'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  Filter, 
  Download, 
  Phone, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  Calendar
} from 'lucide-react'
import { useInfiniteScroll } from '../../hooks/useSupabase'

interface CallLog {
  id: string
  call_id: string
  agent_id: string
  customer_number: string
  call_ended_reason: string
  transcript_type: string
  transcript_json: any
  metadata: any
  dynamic_variables: any
  environment: string
  call_started_at: string
  call_ended_at: string
  recording_url: string
  duration_seconds: number
  voice_recording_url: string
  created_at: string
}

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
}

const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {
  const [search, setSearch] = useState('')
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set())
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  
  // Memoize the query options to prevent unnecessary re-renders
  const queryOptions = useMemo(() => ({
    select: `
      id,
      call_id,
      agent_id,
      customer_number,
      call_ended_reason,
      transcript_type,
      transcript_json,
      metadata,
      environment,
      call_started_at,
      call_ended_at,
      duration_seconds,
      recording_url,
      voice_recording_url,
      created_at
    `,
    filters: [
      { column: 'agent_id', operator: 'eq', value: agent.id }
    ],
    orderBy: { column: 'created_at', ascending: false },
    limit: 30
  }), [agent.id])

  const { data: calls, loading, hasMore, error, loadMore } = useInfiniteScroll('pype_voice_call_logs', queryOptions)

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loading, loadMore])

  // Filter calls based on search (client-side filtering)
  const filteredCalls = useMemo(() => {
    if (!search) return calls
    
    const searchLower = search.toLowerCase()
    return calls.filter((call: CallLog) => 
      call.customer_number.toLowerCase().includes(searchLower) ||
      call.call_id.toLowerCase().includes(searchLower) ||
      call.call_ended_reason.toLowerCase().includes(searchLower)
    )
  }, [calls, search])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}m`
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (reason: string) => {
    switch (reason) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'timeout': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (reason: string) => {
    return reason === 'completed' ? 
      <CheckCircle className="w-4 h-4" /> : 
      <XCircle className="w-4 h-4" />
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCalls(new Set(filteredCalls.map(call => call.id)))
    } else {
      setSelectedCalls(new Set())
    }
  }

  const handleSelectCall = (id: string, checked: boolean) => {
    setSelectedCalls(prev => {
      const newSelected = new Set(prev)
      if (checked) {
        newSelected.add(id)
      } else {
        newSelected.delete(id)
      }
      return newSelected
    })
  }

  const toggleCallExpansion = (callId: string) => {
    setExpandedCall(expandedCall === callId ? null : callId)
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Call ID', 'Customer', 'Duration', 'Status', 'Date', 'Agent'].join(','),
      ...filteredCalls.map(call => [
        call.call_id,
        call.customer_number,
        formatDuration(call.duration_seconds),
        call.call_ended_reason,
        formatDateTime(call.created_at),
        call.agent_id
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-logs-${agent.name}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Error loading call logs: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <button 
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 mb-2"
        >
          ← Back to Agents
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{agent.name} - Call Logs</h1>
            <p className="text-gray-400 mt-1">
              {filteredCalls.length} calls in {project.name}
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-6 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search calls by phone number, call ID, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCalls.size === filteredCalls.length && filteredCalls.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredCalls.map((call: CallLog) => (
                  <React.Fragment key={call.id}>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedCalls.has(call.id)}
                          onChange={(e) => handleSelectCall(call.id, e.target.checked)}
                          className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {call.customer_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.call_ended_reason)}`}>
                            {getStatusIcon(call.call_ended_reason)}
                            {call.call_ended_reason}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDateTime(call.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => toggleCallExpansion(call.id)}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${expandedCall === call.id ? 'rotate-180' : ''}`} />
                          Details
                        </button>
                      </td>
                    </tr>
                    {expandedCall === call.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-750">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium text-white mb-2">Call Details</h4>
                              <div className="space-y-1 text-sm text-gray-300">
                                <p><span className="text-gray-400">Call ID:</span> {call.call_id}</p>
                                <p><span className="text-gray-400">Started:</span> {call.call_started_at ? formatDateTime(call.call_started_at) : 'N/A'}</p>
                                <p><span className="text-gray-400">Ended:</span> {call.call_ended_at ? formatDateTime(call.call_ended_at) : 'N/A'}</p>
                                <p><span className="text-gray-400">Environment:</span> {call.environment}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-white mb-2">Metadata</h4>
                              <div className="text-sm text-gray-300">
                                {call.metadata ? (
                                  <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(call.metadata, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-gray-400">No metadata available</p>
                                )}
                              </div>
                            </div>
                            {call.recording_url && (
                              <div className="md:col-span-2">
                                <h4 className="font-medium text-white mb-2">Recording</h4>
                                <a 
                                  href={call.recording_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  View Recording
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Loading indicator for infinite scroll */}
          {(loading || hasMore) && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {loading && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
            </div>
          )}
          
          {!hasMore && filteredCalls.length > 0 && (
            <div className="text-center py-4 text-gray-400">
              No more calls to load
            </div>
          )}
          
          {filteredCalls.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-400">
              No calls found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallLogs