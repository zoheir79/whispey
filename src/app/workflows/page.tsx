'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Workflow, 
  Plus, 
  Search, 
  Play, 
  Pause, 
  Settings, 
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import Header from '@/components/shared/Header'
import WorkflowDialog from '@/components/workflows/WorkflowDialog'

interface WorkflowItem {
  id: string
  name: string
  description: string
  workspace_id: string
  workspace_name: string
  status: 'active' | 'paused' | 'error' | 'draft'
  execution_count: number
  last_execution: string | null
  total_cost: number
  avg_execution_time: number
  created_at: string
  updated_at: string
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const { isAdmin, isSuperAdmin } = useGlobalRole()

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/workflows')
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data.workflows || [])
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWorkflows = workflows.filter(workflow => 
    (workflow.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (workflow.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (workflow.workspace_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null || isNaN(amount)) return '$0.0000'
    return `$${amount.toFixed(4)}`
  }

  const formatExecutionTime = (seconds: number | null | undefined) => {
    if (seconds == null || isNaN(seconds)) return '0s'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'draft':
        return <Clock className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const toggleWorkflowStatus = async (workflowId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active'
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchWorkflows()
      }
    } catch (error) {
      console.error('Failed to toggle workflow status:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
      <Header breadcrumb={{ project: 'Workflows' }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Workflow className="w-8 h-8 text-teal-500" />
                {isAdmin ? 'All Workflows' : 'My Workflows'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage and monitor your automated workflows
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Workflows Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card className="text-center py-12 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardContent>
              <Workflow className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No workflows found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchQuery ? 'No workflows match your search.' : 'Get started by creating your first workflow.'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-teal-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
                        {workflow.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {workflow.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {getStatusIcon(workflow.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Workspace:</span>
                      <Badge variant="outline" className="text-xs">
                        {workflow.workspace_name}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Executions:</span>
                      <span className="font-medium">{workflow.execution_count || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Total Cost:</span>
                      <span className="font-medium flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(workflow.total_cost)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Avg Runtime:</span>
                      <span className="font-medium">{formatExecutionTime(workflow.avg_execution_time)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <Badge className={`text-xs ${getStatusColor(workflow.status)}`}>
                        {workflow.status}
                      </Badge>
                    </div>

                    {workflow.last_execution && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Last run:</span>
                        <span className="text-xs">
                          {new Date(workflow.last_execution).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => window.location.href = `/workflows/${workflow.id}`}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                          className={workflow.status === 'active' ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}
                        >
                          {workflow.status === 'active' ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `/workflows/${workflow.id}/settings`}
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Workflow Dialog */}
      {showCreateDialog && (
        <WorkflowDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchWorkflows()
          }}
        />
      )}
    </div>
  )
}
