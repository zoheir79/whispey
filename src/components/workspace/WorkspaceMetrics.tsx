'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Phone, DollarSign, Users, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react'

interface WorkspaceMetricsProps {
  projectId: string
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

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/metrics`)
        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }
        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Mock data for development
        setMetrics({
          totalCalls: 1247,
          successRate: 94.2,
          averageDuration: 156,
          totalCost: 89.45,
          activeAgents: 12,
          todayCalls: 23,
          weeklyGrowth: 12.5,
          avgResponseTime: 1.2
        })
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      fetchMetrics()
    }
  }, [projectId])

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Calls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Calls</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{metrics.totalCalls.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700">
                +{metrics.todayCalls} today
              </span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Phone className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Success Rate</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{metrics.successRate}%</p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Excellent</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Average Duration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Avg Duration</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatDuration(metrics.averageDuration)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-500">+{metrics.weeklyGrowth}% this week</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Clock className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Total Cost */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Cost</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(metrics.totalCost)}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700">
                This month
              </span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Active Agents */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Active Agents</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{metrics.activeAgents}</p>
            <div className="flex items-center gap-1 mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600">All running</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Response Time */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Avg Response</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{metrics.avgResponseTime}s</p>
            <div className="flex items-center gap-1 mt-2">
              <Activity className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Fast</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Cost Per Call */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Cost Per Call</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(metrics.totalCost / metrics.totalCalls)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-600">Monitor</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Weekly Growth */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Weekly Growth</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">+{metrics.weeklyGrowth}%</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Growing</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceMetrics
