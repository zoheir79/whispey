// components/Overview.tsx
'use client'
import React, { useState, useMemo } from 'react'
import { 
  Calendar, 
  Phone, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Loader2,
  AlertCircle,
  XCircle,
  Activity,
  Users
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface OverviewProps {
  project: any
  agent: any
}

const Overview: React.FC<OverviewProps> = ({ project, agent }) => {
  // Default to last 7 days
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  })

  const [quickFilter, setQuickFilter] = useState('7d')

  // Quick filter options
  const quickFilters = [
    { id: '1d', label: '1 Day', days: 1 },
    { id: '7d', label: '7 Days', days: 7 },
    { id: '30d', label: '30 Days', days: 30 },
    { id: '90d', label: '90 Days', days: 90 }
  ]

  // Fetch calls data
  const { data: calls, loading, error } = useSupabaseQuery('pype_voice_call_logs', {
    select: 'id, call_ended_reason, duration_seconds, created_at, call_started_at, call_ended_at, customer_number, call_id',
    filters: [
      { column: 'agent_id', operator: 'eq', value: agent.id },
      { column: 'created_at', operator: 'gte', value: `${dateRange.from}T00:00:00` },
      { column: 'created_at', operator: 'lte', value: `${dateRange.to}T23:59:59` }
    ],
    orderBy: { column: 'created_at', ascending: false }
  })

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!calls?.length) return null

    const totalCalls = calls.length
    const totalMinutes = Math.round(calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / 60)
    const successfulCalls = calls.filter(call => call.call_ended_reason === 'completed').length
    const failedCalls = calls.filter(call => call.call_ended_reason === 'failed' || call.call_ended_reason === 'error').length
    const timeoutCalls = calls.filter(call => call.call_ended_reason === 'timeout').length
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0
    const avgCallDuration = totalCalls > 0 ? Math.round(totalMinutes / totalCalls) : 0

    // Get unique customers
    const uniqueCustomers = new Set(calls.map(call => call.customer_number)).size

    // Group by date for charts
    const dailyData = calls.reduce((acc, call) => {
      const date = format(new Date(call.created_at), 'yyyy-MM-dd')
      if (!acc[date]) {
        acc[date] = { 
          date, 
          shortDate: format(new Date(call.created_at), 'MMM dd'),
          calls: 0, 
          minutes: 0, 
          successful: 0,
          failed: 0,
          timeout: 0
        }
      }
      acc[date].calls += 1
      acc[date].minutes += Math.round((call.duration_seconds || 0) / 60)
      
      if (call.call_ended_reason === 'completed') {
        acc[date].successful += 1
      } else if (call.call_ended_reason === 'failed' || call.call_ended_reason === 'error') {
        acc[date].failed += 1
      } else if (call.call_ended_reason === 'timeout') {
        acc[date].timeout += 1
      }
      
      return acc
    }, {} as any)

    const chartData = Object.values(dailyData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Status distribution for pie chart
    const statusDistribution = [
      { name: 'Completed', value: successfulCalls, color: '#10b981' },
      { name: 'Failed', value: failedCalls, color: '#ef4444' },
      { name: 'Timeout', value: timeoutCalls, color: '#f59e0b' }
    ].filter(item => item.value > 0)

    // Peak hours analysis
    const hourlyData = calls.reduce((acc, call) => {
      const hour = new Date(call.created_at).getHours()
      if (!acc[hour]) {
        acc[hour] = { hour: `${hour}:00`, calls: 0 }
      }
      acc[hour].calls += 1
      return acc
    }, {} as any)

    const peakHours = Object.values(hourlyData).sort((a: any, b: any) => b.calls - a.calls).slice(0, 5)

    return {
      totalCalls,
      totalMinutes,
      successfulCalls,
      failedCalls,
      timeoutCalls,
      successRate,
      avgCallDuration,
      uniqueCustomers,
      chartData,
      statusDistribution,
      peakHours
    }
  }, [calls])

  const handleQuickFilter = (filter: any) => {
    setQuickFilter(filter.id)
    const endDate = new Date()
    const startDate = subDays(endDate, filter.days)
    setDateRange({
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    })
  }

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }))
    setQuickFilter('custom')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Error loading analytics: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Date Range Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleQuickFilter(filter)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                quickFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => handleDateChange('from', e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => handleDateChange('to', e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {analytics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics.totalCalls}</p>
                  <p className="text-sm text-gray-400">Total Calls</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics.totalMinutes}</p>
                  <p className="text-sm text-gray-400">Total Minutes</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics.successfulCalls}</p>
                  <p className="text-sm text-gray-400">Successful Calls</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{analytics.successRate}%</p>
                  <p className="text-sm text-gray-400">Success Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{analytics.uniqueCustomers}</p>
                  <p className="text-sm text-gray-400">Unique Customers</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{analytics.avgCallDuration}</p>
                  <p className="text-sm text-gray-400">Avg Duration (min)</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600 rounded-lg">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{analytics.failedCalls}</p>
                  <p className="text-sm text-gray-400">Failed Calls</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Calls Chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Daily Calls</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="shortDate" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Minutes Chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Daily Minutes</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="shortDate" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar 
                    dataKey="minutes" 
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Status Distribution */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Call Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // @ts-ignore
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Success Rate Trend */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Success Rate Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="shortDate" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={12}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value) => [`${value}%`, 'Success Rate']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={(data) => data.calls > 0 ? Math.round((data.successful / data.calls) * 100) : 0}
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Hours Analysis */}
          {analytics.peakHours.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">Peak Hours Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {analytics.peakHours.map((hour: any, index: number) => (
                  <div key={hour.hour} className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{hour.hour}</div>
                    <div className="text-sm text-gray-400">{hour.calls} calls</div>
                    <div className="text-xs text-gray-500">#{index + 1} Peak Hour</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No data available for the selected date range</p>
          <p className="text-gray-500 text-sm mt-2">Try selecting a different date range or check if there are any calls for this agent.</p>
        </div>
      )}
    </div>
  )
}

export default Overview