'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Workflow, 
  Play, 
  Pause, 
  Settings,
  BarChart3,
  History,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react'
import Header from '@/components/shared/Header'
import WorkflowExecutions from '@/components/workflows/WorkflowExecutions'
import WorkflowSettings from '@/components/workflows/WorkflowSettings'
import WorkflowMetrics from '@/components/workflows/WorkflowMetrics'

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
  mcp_config: any
  created_at: string
  updated_at: string
}

export default function WorkflowPage() {
  const params = useParams()
  const workflowId = params.id as string
  const [workflow, setWorkflow] = useState<WorkflowItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('executions')

  useEffect(() => {
    if (workflowId) {
      fetchWorkflow()
    }
  }, [workflowId])

  const fetchWorkflow = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workflows/${workflowId}`)
      if (response.ok) {
        const data = await response.json()
        setWorkflow(data.workflow)
      }
    } catch (error) {
      console.error('Failed to fetch workflow:', error)
    } finally {
      setLoading(false)
    }
  }

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
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'draft':
        return <Clock className="w-5 h-5 text-gray-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
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

  const toggleWorkflowStatus = async () => {
    if (!workflow) return

    try {
      const newStatus = workflow.status === 'active' ? 'paused' : 'active'
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchWorkflow()
      }
    } catch (error) {
      console.error('Failed to toggle workflow status:', error)
    }
  }

  const executeWorkflow = async () => {
    if (!workflow) return

    try {
      const response = await fetch(`/api/workflows/${workflow.id}/execute`, {
        method: 'POST'
      })

      if (response.ok) {
        // Refresh data and switch to executions tab
        fetchWorkflow()
        setActiveTab('executions')
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-800">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-800">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Workflow Not Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                The workflow you're looking for doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-800">
      <Header breadcrumb={{ 
        project: 'Workflows', 
        item: workflow.name 
      }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Workflow Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Workflow className="w-8 h-8 text-teal-500" />
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {workflow.name}
                </h1>
                <div className="flex items-center gap-2">
                  {getStatusIcon(workflow.status)}
                  <Badge className={`text-sm ${getStatusColor(workflow.status)}`}>
                    {workflow.status}
                  </Badge>
                </div>
              </div>
              {workflow.description && (
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  {workflow.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Workspace: <strong>{workflow.workspace_name}</strong></span>
                <span>Created: {new Date(workflow.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={executeWorkflow}
                disabled={workflow.status !== 'active'}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute Now
              </Button>
              <Button
                onClick={toggleWorkflowStatus}
                variant="outline"
                className={workflow.status === 'active' ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}
              >
                {workflow.status === 'active' ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Executions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {workflow.execution_count}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(workflow.total_cost)}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Runtime</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatExecutionTime(workflow.avg_execution_time)}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Run</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {workflow.last_execution 
                      ? new Date(workflow.last_execution).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="executions" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Executions
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="executions" className="mt-6">
            <WorkflowExecutions 
              workflowId={workflow.id}
              onExecutionUpdate={fetchWorkflow}
            />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <WorkflowMetrics workflowId={workflow.id} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <WorkflowSettings 
              workflow={workflow}
              onUpdate={fetchWorkflow}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
