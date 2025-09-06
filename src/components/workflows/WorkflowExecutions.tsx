'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  History,
  Search,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface WorkflowExecution {
  id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  start_time: string
  end_time: string | null
  duration: number | null
  cost: number
  input_data: any
  output_data: any
  error_message: string | null
  mcp_calls: number
  input_tokens: number
  output_tokens: number
}

interface WorkflowExecutionsProps {
  workflowId: string
  onExecutionUpdate: () => void
}

export default function WorkflowExecutions({ 
  workflowId, 
  onExecutionUpdate 
}: WorkflowExecutionsProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [estimatingCost, setEstimatingCost] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)

  useEffect(() => {
    fetchExecutions()
    // Set up polling for running executions
    const interval = setInterval(fetchExecutions, 5000)
    return () => clearInterval(interval)
  }, [workflowId])

  const fetchExecutions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workflows/${workflowId}/executions`)
      if (response.ok) {
        const data = await response.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error('Failed to fetch executions:', error)
    } finally {
      setLoading(false)
    }
  }

  const estimateExecutionCost = async () => {
    try {
      setEstimatingCost(true)
      const response = await fetch(`/api/workflows/${workflowId}/cost-estimate`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setEstimatedCost(data.estimated_cost)
      }
    } catch (error) {
      console.error('Failed to estimate cost:', error)
    } finally {
      setEstimatingCost(false)
    }
  }

  const executeWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchExecutions()
        onExecutionUpdate()
        setEstimatedCost(null)
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  const cancelExecution = async (executionId: string) => {
    if (!confirm('Are you sure you want to cancel this execution?')) return

    try {
      const response = await fetch(`/api/workflows/${workflowId}/executions/${executionId}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchExecutions()
      }
    } catch (error) {
      console.error('Failed to cancel execution:', error)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredExecutions = executions.filter(execution => 
    execution.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (execution.error_message && execution.error_message.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Execute New */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-teal-500" />
            Execute Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Execute this workflow manually or estimate the cost before running.
            </p>
            
            {estimatedCost !== null && (
              <Alert>
                <DollarSign className="w-4 h-4" />
                <AlertDescription>
                  Estimated execution cost: <strong>{formatCurrency(estimatedCost)}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={estimateExecutionCost}
                variant="outline"
                disabled={estimatingCost}
              >
                {estimatingCost && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <DollarSign className="w-4 h-4 mr-2" />
                Estimate Cost
              </Button>
              <Button
                onClick={executeWorkflow}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executions History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Execution History ({executions.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Search executions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No executions found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No executions match your search.' : 'Execute the workflow to see history.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExecutions.map((execution) => (
                <div key={execution.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(execution.status)}
                        <Badge className={`text-xs ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(execution.start_time).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                          <div className="font-medium">{formatDuration(execution.duration)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                          <div className="font-medium flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(execution.cost)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">MCP Calls:</span>
                          <div className="font-medium">{execution.mcp_calls}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Tokens:</span>
                          <div className="font-medium">
                            {execution.input_tokens + execution.output_tokens}
                          </div>
                        </div>
                      </div>

                      {execution.error_message && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                          <strong className="text-red-700 dark:text-red-400">Error:</strong>
                          <span className="text-red-600 dark:text-red-300 ml-2">
                            {execution.error_message}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/workflows/${workflowId}/executions/${execution.id}`, '_blank')}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      {execution.status === 'running' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelExecution(execution.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancel
                        </Button>
                      )}
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
