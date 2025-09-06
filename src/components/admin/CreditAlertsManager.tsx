'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search,
  Eye,
  Check,
  X,
  Loader2
} from 'lucide-react'

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

interface CreditAlertsManagerProps {
  alerts: CreditAlert[]
  onAlertsUpdate: () => void
}

export default function CreditAlertsManager({ alerts, onAlertsUpdate }: CreditAlertsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const acknowledgeAlert = async (alertId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/credit-alerts/${alertId}/acknowledge`, {
        method: 'POST'
      })
      if (response.ok) {
        onAlertsUpdate()
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    } finally {
      setLoading(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/credit-alerts/${alertId}/resolve`, {
        method: 'POST'
      })
      if (response.ok) {
        onAlertsUpdate()
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissAlert = async (alertId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/credit-alerts/${alertId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        onAlertsUpdate()
      }
    } catch (error) {
      console.error('Failed to dismiss alert:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'low_balance':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'negative_balance':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'usage_spike':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-4 h-4 text-red-500" />
      case 'acknowledged':
        return <Eye className="w-4 h-4 text-yellow-500" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.workspace_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.alert_type.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || alert.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const activeAlertsCount = alerts.filter(alert => alert.status === 'active').length
  const acknowledgedAlertsCount = alerts.filter(alert => alert.status === 'acknowledged').length
  const resolvedAlertsCount = alerts.filter(alert => alert.status === 'resolved').length

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Alerts</p>
                <p className="text-2xl font-bold text-red-600">
                  {activeAlertsCount}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Acknowledged</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {acknowledgedAlertsCount}
                </p>
              </div>
              <Eye className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolved</p>
                <p className="text-2xl font-bold text-green-600">
                  {resolvedAlertsCount}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            Credit Alerts Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('active')}
                size="sm"
              >
                Active
              </Button>
              <Button
                variant={filterStatus === 'acknowledged' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('acknowledged')}
                size="sm"
              >
                Acknowledged
              </Button>
              <Button
                variant={filterStatus === 'resolved' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('resolved')}
                size="sm"
              >
                Resolved
              </Button>
            </div>
          </div>

          {/* Alerts List */}
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No alerts found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No alerts match your search criteria.' : 'No credit alerts at this time.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getAlertIcon(alert.alert_type)}
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {alert.workspace_name}
                        </h3>
                        <Badge className={`text-xs ${getAlertColor(alert.alert_type)}`}>
                          {alert.alert_type.replace('_', ' ')}
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(alert.status)}`}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(alert.status)}
                            {alert.status}
                          </div>
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Current Value:</span>
                          <div className="font-medium text-red-600">
                            {formatCurrency(alert.current_value)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Threshold:</span>
                          <div className="font-medium">{formatCurrency(alert.threshold_value)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Created:</span>
                          <div className="font-medium">
                            {new Date(alert.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {alert.acknowledged_at && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Acknowledged:</span>
                            <div className="font-medium">
                              {new Date(alert.acknowledged_at).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {alert.acknowledged_by && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Acknowledged by: {alert.acknowledged_by}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {alert.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                            disabled={loading}
                            className="text-yellow-600 hover:bg-yellow-50"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => resolveAlert(alert.id)}
                            disabled={loading}
                            className="text-green-600 hover:bg-green-50"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        </>
                      )}
                      
                      {alert.status === 'acknowledged' && (
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          disabled={loading}
                          className="text-green-600 hover:bg-green-50"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dismissAlert(alert.id)}
                        disabled={loading}
                        className="text-red-600 hover:bg-red-50"
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
