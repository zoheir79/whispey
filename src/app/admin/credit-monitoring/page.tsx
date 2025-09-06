'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  AlertTriangle, 
  DollarSign, 
  TrendingDown, 
  Bell, 
  Webhook,
  Pause,
  Play,
  Search,
  Settings,
  Users,
  Activity
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import Header from '@/components/shared/Header'
import CreditAlertsManager from '@/components/admin/CreditAlertsManager'
import WorkspaceCreditMonitor from '@/components/admin/WorkspaceCreditMonitor'
import WebhookNotifications from '@/components/admin/WebhookNotifications'

interface CreditAlert {
  id: string
  workspace_id: string
  workspace_name: string
  alert_type: 'low_balance' | 'negative_balance' | 'usage_spike'
  threshold_value: number
  current_value: number
  status: 'active' | 'acknowledged' | 'resolved'
  created_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}

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

export default function CreditMonitoringPage() {
  const [alerts, setAlerts] = useState<CreditAlert[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const { isSuperAdmin } = useGlobalRole()

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCreditData()
      // Set up real-time polling
      const interval = setInterval(fetchCreditData, 30000) // Every 30 seconds
      return () => clearInterval(interval)
    }
  }, [isSuperAdmin])

  const fetchCreditData = async () => {
    try {
      setLoading(true)
      const [alertsResponse, workspacesResponse] = await Promise.all([
        fetch('/api/admin/credit-alerts'),
        fetch('/api/admin/workspace-credits')
      ])

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlerts(alertsData.alerts || [])
      }

      if (workspacesResponse.ok) {
        const workspacesData = await workspacesResponse.json()
        setWorkspaces(workspacesData.workspaces || [])
      }
    } catch (error) {
      console.error('Failed to fetch credit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/credit-alerts/${alertId}/acknowledge`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchCreditData()
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const suspendWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to suspend this workspace?')) return

    try {
      const response = await fetch(`/api/workspace/${workspaceId}/suspend`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchCreditData()
      }
    } catch (error) {
      console.error('Failed to suspend workspace:', error)
    }
  }

  const reactivateWorkspace = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/reactivate`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchCreditData()
      }
    } catch (error) {
      console.error('Failed to reactivate workspace:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getAlertColor = (alertType: string) => {
    switch (alertType) {
      case 'low_balance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'negative_balance':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'usage_spike':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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

  const activeAlerts = alerts.filter(alert => alert.status === 'active')
  const criticalWorkspaces = workspaces.filter(ws => ws.current_balance < 0 || ws.status === 'suspended')

  const filteredWorkspaces = workspaces.filter(workspace => 
    workspace.workspace_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Access Denied
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Only super administrators can access credit monitoring.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
      <Header breadcrumb={{ project: 'Admin', item: 'Credit Monitoring' }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-500" />
                Credit Monitoring Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Monitor workspace credits, alerts, and automated actions
              </p>
            </div>
            <Button
              onClick={fetchCreditData}
              variant="outline"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Critical Alerts Banner */}
        {activeAlerts.length > 0 && (
          <div className="mb-6">
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">
                    {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}
                  </h3>
                </div>
                <div className="space-y-2">
                  {activeAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between text-sm">
                      <span className="text-red-700 dark:text-red-300">
                        <strong>{alert.workspace_name}</strong>: {alert.alert_type.replace('_', ' ')} 
                        ({formatCurrency(alert.current_value)})
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="text-red-600 border-red-300 hover:bg-red-100"
                      >
                        Acknowledge
                      </Button>
                    </div>
                  ))}
                  {activeAlerts.length > 3 && (
                    <p className="text-red-600 text-sm">
                      +{activeAlerts.length - 3} more alerts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Workspaces</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {workspaces.length}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Alerts</p>
                  <p className="text-2xl font-bold text-red-600">
                    {activeAlerts.length}
                  </p>
                </div>
                <Bell className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Workspaces</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {criticalWorkspaces.length}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Daily Usage</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(workspaces.reduce((sum, ws) => sum + ws.daily_usage, 0))}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <WorkspaceCreditMonitor 
              workspaces={workspaces}
              alerts={alerts}
              onRefresh={fetchCreditData}
            />
          </TabsContent>

          <TabsContent value="workspaces" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Workspace Credit Status
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search workspaces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredWorkspaces.map((workspace) => (
                    <div key={workspace.workspace_id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {workspace.workspace_name}
                            </h3>
                            <Badge className={`text-xs ${getWorkspaceStatusColor(workspace.status)}`}>
                              {workspace.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Balance:</span>
                              <div className={`font-medium ${workspace.current_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(workspace.current_balance)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Daily Usage:</span>
                              <div className="font-medium">{formatCurrency(workspace.daily_usage)}</div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Weekly Usage:</span>
                              <div className="font-medium">{formatCurrency(workspace.weekly_usage)}</div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Total Usage:</span>
                              <div className="font-medium">{formatCurrency(workspace.total_usage_cost)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/admin/workspace/${workspace.workspace_id}/credits`, '_blank')}
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Manage
                          </Button>
                          {workspace.status === 'suspended' ? (
                            <Button
                              size="sm"
                              onClick={() => reactivateWorkspace(workspace.workspace_id)}
                              className="text-green-600 hover:bg-green-50"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => suspendWorkspace(workspace.workspace_id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Pause className="w-3 h-3 mr-1" />
                              Suspend
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-6">
            <CreditAlertsManager 
              alerts={alerts}
              onAlertsUpdate={fetchCreditData}
            />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhookNotifications onRefresh={fetchCreditData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
