'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  AlertTriangle,
  Activity,
  BarChart3
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface WorkspaceCredit {
  workspace_id: string
  workspace_name: string
  current_balance: number
  total_usage_cost: number
  daily_usage: number
  weekly_usage: number
  monthly_usage: number
  status: 'active' | 'suspended' | 'warning'
  last_updated: string
}

interface CreditAlert {
  id: string
  workspace_id: string
  workspace_name: string
  alert_type: string
  status: string
  created_at: string
}

interface WorkspaceCreditMonitorProps {
  workspaces: WorkspaceCredit[]
  alerts: CreditAlert[]
  onRefresh: () => void
}

interface UsageData {
  period: string
  usage: number
  balance: number
}

export default function WorkspaceCreditMonitor({ 
  workspaces, 
  alerts, 
  onRefresh 
}: WorkspaceCreditMonitorProps) {
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsageData()
  }, [])

  const fetchUsageData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/usage-analytics')
      if (response.ok) {
        const data = await response.json()
        setUsageData(data.usage_data || [])
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getWorkspaceStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-500" />
    if (current < previous) return <TrendingDown className="w-4 h-4 text-green-500" />
    return <Activity className="w-4 h-4 text-gray-500" />
  }

  // Calculate summary statistics
  const totalBalance = workspaces.reduce((sum, ws) => sum + ws.current_balance, 0)
  const totalDailyUsage = workspaces.reduce((sum, ws) => sum + ws.daily_usage, 0)
  const totalWeeklyUsage = workspaces.reduce((sum, ws) => sum + ws.weekly_usage, 0)
  const totalMonthlyUsage = workspaces.reduce((sum, ws) => sum + ws.monthly_usage, 0)
  
  const criticalWorkspaces = workspaces.filter(ws => ws.current_balance < 0)
  const warningWorkspaces = workspaces.filter(ws => ws.current_balance < 50 && ws.current_balance >= 0)
  const activeAlerts = alerts.filter(alert => alert.status === 'active')

  // Top usage workspaces
  const topUsageWorkspaces = [...workspaces]
    .sort((a, b) => b.daily_usage - a.daily_usage)
    .slice(0, 5)

  // Low balance workspaces
  const lowBalanceWorkspaces = [...workspaces]
    .filter(ws => ws.current_balance < 100)
    .sort((a, b) => a.current_balance - b.current_balance)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Summary Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Balance</p>
                <p className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Daily Usage</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalDailyUsage)}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Workspaces</p>
                <p className="text-2xl font-bold text-red-600">
                  {criticalWorkspaces.length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Warning Workspaces</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {warningWorkspaces.length}
                </p>
              </div>
              <Users className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Usage Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'usage' ? formatCurrency(Number(value)) : formatCurrency(Number(value)), 
                    name === 'usage' ? 'Usage' : 'Balance'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="usage" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#10b981" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Usage and Low Balance Workspaces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Usage Workspaces */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Top Usage Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsageWorkspaces.map((workspace, index) => (
                <div key={workspace.workspace_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {workspace.workspace_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Balance: {formatCurrency(workspace.current_balance)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">
                      {formatCurrency(workspace.daily_usage)}
                    </p>
                    <Badge className={`text-xs ${getWorkspaceStatusColor(workspace.status)}`}>
                      {workspace.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Balance Workspaces */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Low Balance Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowBalanceWorkspaces.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No low balance workspaces</p>
                </div>
              ) : (
                lowBalanceWorkspaces.map((workspace, index) => (
                  <div key={workspace.workspace_id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {workspace.workspace_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Daily usage: {formatCurrency(workspace.daily_usage)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${workspace.current_balance < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {formatCurrency(workspace.current_balance)}
                      </p>
                      <Badge className={`text-xs ${getWorkspaceStatusColor(workspace.status)}`}>
                        {workspace.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Daily Usage</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalDailyUsage)}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(totalDailyUsage, totalWeeklyUsage / 7)}
                <span className="text-xs text-gray-500">vs avg weekly</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weekly Usage</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(totalWeeklyUsage)}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {getTrendIcon(totalWeeklyUsage, totalMonthlyUsage / 4)}
                <span className="text-xs text-gray-500">vs avg monthly</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly Usage</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalMonthlyUsage)}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Activity className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">current month</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
