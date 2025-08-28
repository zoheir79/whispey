'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Phone, DollarSign, Users, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3, Building } from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface WorkspaceMetricsProps {
  projectId?: string
}

interface MetricsData {
  totalCalls: number
  successRate: number
  averageDuration: number
  totalCost: number
  activeAgents: number
  todayCalls: number
  weeklyGrowth: number
  avgResponseTime: number
}

const WorkspaceMetrics: React.FC<WorkspaceMetricsProps> = ({ projectId }) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        let response;
        
        if (isSuperAdmin && !projectId) {
          // Superadmin sees global metrics across all workspaces
          response = await fetch('/api/metrics/global')
        } else if (projectId) {
          // User sees specific workspace metrics
          response = await fetch(`/api/projects/${projectId}/metrics`)
        } else {
          // Regular user without projectId - should not happen
          throw new Error('No workspace specified')
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }
        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Mock data for development - adapt based on role
        const mockData = {
          totalCalls: isSuperAdmin && !projectId ? 5420 : 1247,
          successRate: isSuperAdmin && !projectId ? 92.8 : 94.2,
          averageDuration: 156,
          totalCost: isSuperAdmin && !projectId ? 342.18 : 89.45,
          activeAgents: isSuperAdmin && !projectId ? 48 : 12,
          todayCalls: isSuperAdmin && !projectId ? 89 : 23,
          weeklyGrowth: 12.5,
          avgResponseTime: 1.2
        }
        setMetrics(mockData)
      } finally {
        setLoading(false)
      }
    }

    if (!roleLoading && (projectId || isSuperAdmin)) {
      fetchMetrics()
    }
  }, [projectId, isSuperAdmin, roleLoading])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-100 rounded mb-2"></div>
            <div className="h-8 bg-gray-100 rounded mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Failed to load metrics</p>
      </div>
    )
  }

  const metricsTitle = isSuperAdmin && !projectId ? 'Global Metrics' : 'Workspace Metrics'
  const metricsDescription = isSuperAdmin && !projectId ? 'Across all workspaces' : 'Current workspace'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{metricsTitle}</h2>
          <p className="text-sm text-gray-500">{metricsDescription}</p>
        </div>
        {isSuperAdmin && !projectId && (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">All Workspaces</span>
          </div>
        )}
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    +{metrics.todayCalls} today
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isSuperAdmin && !projectId ? 'Total Calls (ALL)' : 'Total Calls'}</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.totalCalls.toLocaleString()}</p>
                <p className="text-xs text-gray-400 font-medium">Current period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Excellent</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Success Rate</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.successRate}%</p>
                <p className="text-xs text-gray-400 font-medium">Call completion rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    +{metrics.weeklyGrowth}% week
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Duration</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatDuration(metrics.averageDuration)}</p>
                <p className="text-xs text-gray-400 font-medium">Per conversation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500">USD</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Cost</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatCurrency(metrics.totalCost)}</p>
                <p className="text-xs text-gray-400 font-medium">This month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Agents */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-600">All running</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Agents</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.activeAgents}</p>
                <p className="text-xs text-gray-400 font-medium">Voice assistants</p>
              </div>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <Activity className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Fast</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Response</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.avgResponseTime}s</p>
                <p className="text-xs text-gray-400 font-medium">Processing speed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Per Call */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingUp className="w-3 h-3 text-red-600" />
                    <span className="text-xs font-bold text-red-600">Monitor</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Per Call</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatCurrency(metrics.totalCost / metrics.totalCalls)}</p>
                <p className="text-xs text-gray-400 font-medium">Average cost</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Growth */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Growing</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Weekly Growth</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">+{metrics.weeklyGrowth}%</p>
                <p className="text-xs text-gray-400 font-medium">This week</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceMetrics
