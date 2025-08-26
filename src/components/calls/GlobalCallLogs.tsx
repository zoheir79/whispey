"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw, Search, Download, Eye } from "lucide-react"
import { useInfiniteScrollWithFetch } from "@/hooks/useInfiniteScrollWithFetch"
import CallDetailsDrawer from "./CallDetailsDrawer"
import CallFilter, { FilterRule } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { CostTooltip } from "../tool-tip/costToolTip"
import { CallLog } from "../../types/logs"
import { useGlobalRole } from "@/hooks/useGlobalRole"
import Papa from 'papaparse'

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

interface GlobalCallLogsProps {}

const GlobalCallLogs: React.FC<GlobalCallLogsProps> = () => {
  const [calls, setCalls] = useState<GlobalCallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCall, setSelectedCall] = useState<GlobalCallLog | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const { globalRole, permissions, isLoading: roleLoading } = useGlobalRole()

  // Fetch calls from global API
  useEffect(() => {
    const fetchCalls = async () => {
      if (roleLoading) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/calls', {
          method: 'GET',
          headers: {
            'authorization': localStorage.getItem('token') || ''
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch calls: ${response.status}`)
        }

        const data = await response.json()
        setCalls(data.calls || [])
      } catch (error) {
        console.error('Error fetching calls:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch calls')
      } finally {
        setLoading(false)
      }
    }

    fetchCalls()
  }, [roleLoading])

  // Filter calls based on search and status
  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      const matchesSearch = (
        call.call_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.customer_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' && call.call_ended_reason === 'completed') ||
        (statusFilter === 'error' && call.call_ended_reason !== 'completed')
      
      return matchesSearch && matchesStatus
    })
  }, [calls, searchQuery, statusFilter])

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0)
  }

  if (roleLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading calls...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-medium text-red-900">Error Loading Calls</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Phone className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {permissions?.canViewAllCalls ? 'All Calls' : 'My Calls'}
              </h1>
              {globalRole && globalRole !== 'user' && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {globalRole === 'super_admin' ? 'Super Admin' : globalRole === 'admin' ? 'Global Admin' : 'Owner'}
                </Badge>
              )}
            </div>
            <p className="text-gray-600">
              {permissions?.canViewAllCalls 
                ? `View all call records across all projects (${calls.length} total)`
                : `View your call records across your projects (${calls.length} total)`
              }
            </p>
          </div>
          
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Search and Controls */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search calls by ID, customer, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="error">Error/Failed</option>
            </select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold">{calls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">
                    {calls.filter(c => c.call_ended_reason === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold">
                    {calls.filter(c => c.call_ended_reason !== 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Calls Table */}
      {filteredCalls.length === 0 ? (
        <div className="text-center py-12">
          <Phone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No calls found' : 'No calls yet'}
          </h3>
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : permissions?.canViewAllCalls 
                ? 'No calls have been made yet across any project.'
                : 'You don\'t have access to any call records yet.'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Call Details</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCalls.map((call) => (
                <TableRow key={call.id || call.call_id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Phone className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {call.call_id ? call.call_id.slice(0, 12) + '...' : 'Unknown ID'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {call.id ? call.id.slice(0, 8) + '...' : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <p className="text-sm font-medium">
                      {call.customer_number || 'Unknown'}
                    </p>
                  </TableCell>
                  
                  <TableCell>
                    <p className="text-sm">{call.project_name || 'Unknown Project'}</p>
                  </TableCell>
                  
                  <TableCell>
                    <p className="text-sm font-mono">
                      {formatDuration(call.duration_seconds || 0)}
                    </p>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant={call.call_ended_reason === 'completed' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {call.call_ended_reason || 'Unknown'}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <p className="text-sm">
                      {call.call_started_at 
                        ? new Date(call.call_started_at).toLocaleString()
                        : call.created_at
                        ? new Date(call.created_at).toLocaleString()
                        : 'Unknown'
                      }
                    </p>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Call Details Drawer */}
      {selectedCall && (
        <CallDetailsDrawer
          callData={selectedCall}
          isOpen={!!selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  )
}

export default GlobalCallLogs
