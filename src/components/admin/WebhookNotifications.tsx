'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Webhook, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react'

interface WebhookConfig {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  last_sent: string | null
  success_count: number
  failure_count: number
  created_at: string
}

interface WebhookNotificationsProps {
  onRefresh: () => void
}

export default function WebhookNotifications({ onRefresh }: WebhookNotificationsProps) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null)
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[]
  })

  const availableEvents = [
    'credit_alert_low_balance',
    'credit_alert_negative_balance', 
    'credit_alert_usage_spike',
    'workspace_suspended',
    'workspace_reactivated',
    'cost_threshold_exceeded'
  ]

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/webhooks')
      if (response.ok) {
        const data = await response.json()
        setWebhooks(data.webhooks || [])
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const method = editingWebhook ? 'PUT' : 'POST'
      const url = editingWebhook 
        ? `/api/admin/webhooks/${editingWebhook.id}` 
        : '/api/admin/webhooks'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchWebhooks()
        handleCloseDialog()
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to save webhook:', error)
    }
  }

  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    setEditingWebhook(null)
    setFormData({ name: '', url: '', events: [] })
  }

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook)
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events
    })
    setShowCreateDialog(true)
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      const response = await fetch(`/api/admin/webhooks/${webhookId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchWebhooks()
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error)
    }
  }

  const toggleWebhook = async (webhookId: string, active: boolean) => {
    try {
      const response = await fetch(`/api/admin/webhooks/${webhookId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active })
      })
      if (response.ok) {
        await fetchWebhooks()
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error)
    }
  }

  const testWebhook = async (webhookId: string) => {
    try {
      setTestingWebhook(webhookId)
      const response = await fetch(`/api/admin/webhooks/${webhookId}/test`, {
        method: 'POST'
      })
      
      if (response.ok) {
        alert('Test webhook sent successfully!')
      } else {
        alert('Failed to send test webhook')
      }
    } catch (error) {
      console.error('Failed to test webhook:', error)
      alert('Failed to send test webhook')
    } finally {
      setTestingWebhook(null)
    }
  }

  const handleEventToggle = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }))
  }

  const getSuccessRate = (webhook: WebhookConfig) => {
    const total = webhook.success_count + webhook.failure_count
    if (total === 0) return 0
    return Math.round((webhook.success_count / total) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Webhook Notifications
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure webhooks to receive notifications about credit events
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No webhooks configured
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Set up webhooks to receive real-time notifications about credit events.
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Webhook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id} className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {webhook.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {webhook.url}
                      </p>
                    </div>
                    <Badge className={webhook.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Success Rate:</span>
                        <div className="font-medium text-green-600">
                          {getSuccessRate(webhook)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Total Calls:</span>
                        <div className="font-medium">
                          {webhook.success_count + webhook.failure_count}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Events:</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {webhook.last_sent && (
                      <div className="text-xs text-gray-500">
                        Last sent: {new Date(webhook.last_sent).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id}
                      >
                        {testingWebhook === webhook.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleWebhook(webhook.id, webhook.active)}
                      >
                        {webhook.active ? (
                          <XCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        )}
                        {webhook.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(webhook)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(webhook.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-purple-500" />
              {editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Webhook Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Webhook"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Webhook URL</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://your-server.com/webhook"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Events to Subscribe</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableEvents.map((event) => (
                  <label key={event} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event)}
                      onChange={() => handleEventToggle(event)}
                      className="rounded"
                    />
                    <span className="text-sm">{event.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formData.events.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {editingWebhook ? 'Update' : 'Create'} Webhook
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
