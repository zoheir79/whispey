'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WorkspaceMetrics from './WorkspaceMetrics'
import { BarChart3, TrendingUp, Users, Phone, DollarSign, Activity, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'

interface WorkspaceOverviewProps {
  projectId: string
  projectName: string
}

interface RecentCall {
  id: string
  agent_name: string
  duration: number
  cost: number
  status: 'completed' | 'failed' | 'in_progress'
  created_at: string
  customer_phone?: string
}

interface TopAgent {
  id: string
  name: string
  total_calls: number
  success_rate: number
  avg_cost: number
  status: 'active' | 'inactive'
}

interface CostBreakdown {
  provider: string
  amount: number
  percentage: number
  color: string
}

const WorkspaceOverview: React.FC<WorkspaceOverviewProps> = ({ projectId, projectName }) => {
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [topAgents, setTopAgents] = useState<TopAgent[]>([])
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    fetchDashboardData()
  }, [projectId])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Simulate API calls - replace with actual endpoints
      await Promise.all([
        fetchRecentCalls(),
        fetchTopAgents(),
        fetchCostBreakdown()
      ])
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentCalls = async () => {
    // Mock data - replace with actual API call
    setRecentCalls([
      {
        id: 'call_001',
        agent_name: 'Support Bot',
        duration: 156,
        cost: 0.12,
        status: 'completed',
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        customer_phone: '+1 (555) 123-4567'
      },
      {
        id: 'call_002',
        agent_name: 'Sales Agent',
        duration: 89,
        cost: 0.08,
        status: 'failed',
        created_at: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
        customer_phone: '+1 (555) 987-6543'
      },
      {
        id: 'call_003',
        agent_name: 'Marketing Bot',
        duration: 203,
        cost: 0.15,
        status: 'completed',
        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        customer_phone: '+1 (555) 456-7890'
      }
    ])
  }

  const fetchTopAgents = async () => {
    // Mock data - replace with actual API call
    setTopAgents([
      {
        id: 'agent_001',
        name: 'Support Bot v2.1',
        total_calls: 342,
        success_rate: 94.2,
        avg_cost: 0.11,
        status: 'active'
      },
      {
        id: 'agent_002',
        name: 'Sales Agent Pro',
        total_calls: 256,
        success_rate: 89.1,
        avg_cost: 0.15,
        status: 'active'
      },
      {
        id: 'agent_003',
        name: 'Marketing Assistant',
        total_calls: 189,
        success_rate: 96.8,
        avg_cost: 0.09,
        status: 'active'
      }
    ])
  }

  const fetchCostBreakdown = async () => {
    // Mock data - replace with actual API call
    setCostBreakdown([
      { provider: 'OpenAI', amount: 245.67, percentage: 45, color: 'bg-blue-500' },
      { provider: 'Deepgram', amount: 134.23, percentage: 25, color: 'bg-green-500' },
      { provider: 'ElevenLabs', amount: 89.45, percentage: 16, color: 'bg-purple-500' },
      { provider: 'Azure', amount: 67.89, percentage: 12, color: 'bg-orange-500' },
      { provider: 'Others', amount: 12.76, percentage: 2, color: 'bg-gray-500' }
    ])
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    const hours = Math.floor(diffInMinutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{projectName} Overview</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time metrics and analytics for your voice agents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 border-gray-300 text-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

      {/* Key Metrics */}
      <WorkspaceMetrics projectId={projectId} />

      {/* Main Dashboard */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Recent Calls</TabsTrigger>
          <TabsTrigger value="agents">Top Agents</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="bg-white dark:bg-blue-900 border border-gray-200 dark:border-blue-700 rounded-lg">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentCalls.slice(0, 3).map((call) => (
                    <div key={call.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{call.agent_name}</p>
                          <p className="text-xs text-gray-500">{call.customer_phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs ${getStatusColor(call.status)}`}>
                          {call.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{getTimeAgo(call.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4 border-gray-300 text-gray-700">
                  View All Calls
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </div>

            {/* Top Performing Agents */}
            <div className="bg-white dark:bg-blue-900 border border-gray-200 dark:border-blue-700 rounded-lg">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Performers
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {topAgents.slice(0, 3).map((agent, index) => (
                    <div key={agent.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                          <p className="text-xs text-gray-500">{agent.total_calls} calls</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{agent.success_rate}%</p>
                        <p className="text-xs text-gray-500">{formatCurrency(agent.avg_cost)}/call</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4 border-gray-300 text-gray-700">
                  View All Agents
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Recent Calls
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Badge className={`${getStatusColor(call.status)}`}>
                        {call.status}
                      </Badge>
                      <div>
                        <p className="font-medium text-gray-900">{call.agent_name}</p>
                        <p className="text-sm text-gray-500">{call.customer_phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="text-center">
                        <p className="font-medium">{formatDuration(call.duration)}</p>
                        <p className="text-xs text-gray-500">Duration</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatCurrency(call.cost)}</p>
                        <p className="text-xs text-gray-500">Cost</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{getTimeAgo(call.created_at)}</p>
                        <p className="text-xs text-gray-500">Time</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agent Performance
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {topAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-sm text-gray-500">{agent.total_calls} total calls</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-gray-900">{agent.success_rate}%</p>
                        <p className="text-xs text-gray-500">Success Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(agent.avg_cost)}</p>
                        <p className="text-xs text-gray-500">Avg Cost</p>
                      </div>
                      <Badge className={`${agent.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown by Provider
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {costBreakdown.map((item) => (
                  <div key={item.provider} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${item.color}`}></div>
                      <span className="font-medium text-gray-900">{item.provider}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                        <p className="text-sm text-gray-500">{item.percentage}%</p>
                      </div>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${item.color}`} 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-800">Cost Optimization Tip</p>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  Consider implementing conversation summarization to reduce OpenAI costs by up to 30%.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  )
}

export default WorkspaceOverview
