'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart3, 
  TrendingUp, 
  History, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface WorkflowMetricsProps {
  workflowId: string
}

interface MetricData {
  executions_over_time: Array<{ date: string; count: number; success_count: number; cost: number }>
  execution_status: Array<{ status: string; count: number; percentage: number }>
  cost_breakdown: Array<{ component: string; cost: number; percentage: number }>
  performance_stats: {
    total_executions: number
    success_rate: number
    avg_duration: number
    total_cost: number
    avg_cost_per_execution: number
  }
}

export default function WorkflowMetrics({ workflowId }: WorkflowMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [workflowId])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workflows/${workflowId}/metrics`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`
  }

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280']

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No metrics available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Execute the workflow a few times to see metrics and analytics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Executions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.performance_stats.total_executions}
                </p>
              </div>
              <History className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatPercentage(metrics.performance_stats.success_rate)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(metrics.performance_stats.avg_duration)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(metrics.performance_stats.total_cost)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executions Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Executions Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.executions_over_time}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => {
                      if (name === 'cost') return [formatCurrency(Number(value)), 'Cost']
                      return [value, name === 'count' ? 'Total' : 'Successful']
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="count"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="success_count" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="success_count"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    yAxisId="right"
                    name="cost"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Execution Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Execution Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.execution_status}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    dataKey="count"
                    nameKey="status"
                  >
                    {metrics.execution_status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {metrics.execution_status.map((status, index) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium capitalize">{status.status}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {status.count} ({formatPercentage(status.percentage)})
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.cost_breakdown} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="component" type="category" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="cost" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Executions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.performance_stats.total_executions}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {formatPercentage(metrics.performance_stats.success_rate)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Cost/Execution</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(metrics.performance_stats.avg_cost_per_execution)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Duration</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatDuration(metrics.performance_stats.avg_duration)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
