'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Phone, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Loader2,
  AlertCircle,
  Users,
  CalendarDays
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useSupabaseQuery } from '../../hooks/useSupabase'

const formatDate = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
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

interface OverviewProps {
  project: any
  agent: any
}

interface DateRange {
  from: Date | undefined
  to?: Date | undefined
}

const Overview: React.FC<OverviewProps> = ({ project, agent }) => {
  const [quickFilter, setQuickFilter] = useState('7d')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [isCustomRange, setIsCustomRange] = useState(false)

  // Quick filter options
  const quickFilters = [
    { id: '1d', label: '1 Day', days: 1 },
    { id: '7d', label: '7 Days', days: 7 },
    { id: '30d', label: '30 Days', days: 30 }
  ]

  // Calculate date range for API
  const apiDateRange = useMemo(() => {
    if (isCustomRange && dateRange.from && dateRange.to) {
      return {
        from: formatDateISO(dateRange.from),
        to: formatDateISO(dateRange.to)
      }
    }
    
    const days = quickFilters.find(f => f.id === quickFilter)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    return {
      from: formatDateISO(startDate),
      to: formatDateISO(endDate)
    }
  }, [quickFilter, dateRange, isCustomRange])

  // Handle quick filter selection
  const handleQuickFilter = (filterId: string) => {
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
  }

  // Handle custom date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range)
      setIsCustomRange(true)
      setQuickFilter('')
    }
  }

  // Fetch calls data
  const { data: calls, loading, error } = useSupabaseQuery('pype_voice_call_logs', {
    select: 'id, call_ended_reason, duration_seconds, created_at, customer_number',
    filters: [
      { column: 'agent_id', operator: 'eq', value: agent.id },
      { column: 'created_at', operator: 'gte', value: `${apiDateRange.from}T00:00:00` },
      { column: 'created_at', operator: 'lte', value: `${apiDateRange.to}T23:59:59` }
    ],
    orderBy: { column: 'created_at', ascending: false }
  })

  // Calculate simple analytics
  const analytics = useMemo(() => {
    if (!calls?.length) return null

    const totalCalls = calls.length
    const totalMinutes = Math.round(calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / 60)
    const successfulCalls = calls.filter(call => call.call_ended_reason === 'completed').length
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0
    const uniqueCustomers = new Set(calls.map(call => call.customer_number)).size

    // Simple daily data for charts
    const dailyData = calls.reduce((acc, call) => {
      const date = formatDate(new Date(call.created_at))
      if (!acc[date]) {
        acc[date] = { date, calls: 0, minutes: 0 }
      }
      acc[date].calls += 1
      acc[date].minutes += Math.round((call.duration_seconds || 0) / 60)
      return acc
    }, {} as any)

    const chartData = Object.values(dailyData)

    return {
      totalCalls,
      totalMinutes,
      successfulCalls,
      successRate,
      uniqueCustomers,
      chartData
    }
  }, [calls])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Unable to load data</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Date Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* Quick Filters */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {quickFilters.map((filter) => (
            <Button
              key={filter.id}
              variant={quickFilter === filter.id && !isCustomRange ? "default" : "ghost"}
              size="sm"
              onClick={() => handleQuickFilter(filter.id)}
              className="px-4 py-2"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={isCustomRange ? "default" : "outline"}
              className="w-[300px] justify-start text-left font-normal"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {formatDateDisplay(dateRange.from)} - {formatDateDisplay(dateRange.to)}
                  </>
                ) : (
                  formatDateDisplay(dateRange.from)
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {analytics ? (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.totalCalls}</p>
                    <p className="text-sm text-gray-600">Total Calls</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.totalMinutes}</p>
                    <p className="text-sm text-gray-600">Total Minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.successfulCalls}</p>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.successRate}%</p>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Calls */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Calls</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.chartData}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="calls" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily Minutes */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Minutes</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <Bar 
                        dataKey="minutes" 
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <Card className="border-0 bg-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{analytics.uniqueCustomers}</p>
                  <p className="text-sm text-gray-600">Unique Customers</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {analytics.totalCalls > 0 ? Math.round(analytics.totalMinutes / analytics.totalCalls) : 0}
                  </p>
                  <p className="text-sm text-gray-600">Avg Duration (min)</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{analytics.totalCalls - analytics.successfulCalls}</p>
                  <p className="text-sm text-gray-600">Failed Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-0 bg-white">
          <CardContent className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No data available</h3>
            <p className="text-gray-600">
              No calls found for the selected time period. Try selecting a different date range.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Overview