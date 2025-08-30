'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Clock, Phone, DollarSign, MessageSquare, Mic, Volume2 } from 'lucide-react'

interface Agent {
  id: string
  name: string
  agent_type: string
  environment: string
  project_id: string
  configuration: any
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface AgentAnalyticsProps {
  agent: Agent
}

interface TimeSeriesData {
  date: string
  calls: number
  total_cost: number
  llm_cost: number
  tts_cost: number
  stt_cost: number
  total_call_duration: number
  llm_tokens_input: number
  llm_tokens_output: number
  stt_duration: number
  tts_characters: number
}

// Helper functions
const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

const formatCurrency = (amount: number): string => {
  return `₹${amount.toFixed(2)}`
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}

export default function AgentAnalytics({ agent }: AgentAnalyticsProps) {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [loading, setLoading] = useState(true)

  // Fetch agent metrics
  useEffect(() => {
    const fetchAgentMetrics = async () => {
      try {
        setLoading(true)
        console.log('🚀 AgentAnalytics - Starting fetch for agent:', agent.id, 'period:', selectedPeriod)
        const url = `/api/metrics/timeseries?period=${selectedPeriod}&agentId=${agent.id}`
        console.log('🌍 AgentAnalytics - Fetching URL:', url)
        const response = await fetch(url)
        const data = await response.json()
        console.log('📊 AgentAnalytics - API Response:', data)
        if (data.data && Array.isArray(data.data)) {
          setTimeSeriesData(data.data)
          console.log('✅ AgentAnalytics - Data set:', data.data.length, 'items')
        } else {
          console.error('❌ AgentAnalytics - API Error or no data:', data.error || 'No data array found')
        }
      } catch (error) {
        console.error('💥 AgentAnalytics - Fetch Error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (agent?.id) {
      fetchAgentMetrics()
    } else {
      console.warn('⚠️ AgentAnalytics - No agent.id provided:', agent)
    }
  }, [agent.id, selectedPeriod])

  // Calculate usage metrics
  const usageMetrics = {
    llm: {
      totalTokens: timeSeriesData.reduce((sum, item) => {
        const tokens = (item.llm_tokens_input || 0) + (item.llm_tokens_output || 0)
        return sum + tokens
      }, 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.llm_cost || 0), 0)
    },
    stt: {
      duration: timeSeriesData.reduce((sum, item) => sum + (item.stt_duration || 0), 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.stt_cost || 0), 0)
    },
    tts: {
      characters: timeSeriesData.reduce((sum, item) => sum + (item.tts_characters || 0), 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.tts_cost || 0), 0)
    },
    totalMinutes: timeSeriesData.reduce((sum, item) => sum + (item.total_call_duration || 0), 0) / 60,
    totalCost: timeSeriesData.reduce((sum, item) => sum + (item.total_cost || 0), 0)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-gray-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Agent Analytics</h1>
        </div>
        
        {/* Period Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['7d', '30d', '90d'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* LLM Usage Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Usage LLM</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-gray-900">
                    {loading ? '--' : formatLargeNumber(usageMetrics.llm.totalTokens)}
                  </p>
                  <span className="text-xs text-gray-500">tokens</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {loading ? '₹0.00' : formatCurrency(usageMetrics.llm.cost)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STT Usage Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-50 p-2 rounded-lg">
                <Mic className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Usage STT</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-gray-900">
                    {loading ? '--' : formatDuration(usageMetrics.stt.duration)}
                  </p>
                  <span className="text-xs text-gray-500">duration</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {loading ? '₹0.00' : formatCurrency(usageMetrics.stt.cost)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TTS Usage Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Volume2 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Usage TTS</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-gray-900">
                    {loading ? '--' : formatLargeNumber(usageMetrics.tts.characters)}
                  </p>
                  <span className="text-xs text-gray-500">characters</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {loading ? '₹0.00' : formatCurrency(usageMetrics.tts.cost)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Usage Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Usage Minutes</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-gray-900">
                    {loading ? '--' : `${Math.round(usageMetrics.totalMinutes)}min`}
                  </p>
                  <span className="text-xs text-gray-500">duration</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {loading ? '₹0.00' : formatCurrency(usageMetrics.totalCost)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Calls</p>
                <p className="text-xl font-semibold text-gray-900">
                  {loading ? '--' : timeSeriesData.reduce((sum, item) => sum + (item.calls || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-xl font-semibold text-gray-900">
                  {loading ? '-- min' : formatDuration(usageMetrics.totalMinutes * 60 / Math.max(timeSeriesData.reduce((sum, item) => sum + (item.calls || 0), 0), 1))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Daily Average</p>
                <p className="text-xl font-semibold text-gray-900">
                  {loading ? '--' : Math.round(timeSeriesData.reduce((sum, item) => sum + (item.calls || 0), 0) / Math.max(timeSeriesData.length, 1))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="text-xl font-semibold text-gray-900">
                  {loading ? '₹--' : formatCurrency(usageMetrics.totalCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
