'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Bot, Workflow, CheckCircle, Pause, AlertCircle, Clock, Play, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Header from '@/components/shared/Header'

interface Project {
  id: string
  name: string
  description: string
}

interface WorkflowItem {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'error' | 'draft'
  workspace_id: string
  workspace_name: string
  created_at: string
  updated_at: string
  executions: number
  avg_runtime: number
  total_cost: number
}

export default function ProjectWorkflowsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const [project, setProject] = useState<Project | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${projectId}`)
        if (projectResponse.ok) {
          const projectData = await projectResponse.json()
          setProject(projectData)
        }

        // Fetch workflows for this workspace
        const workflowsResponse = await fetch(`/api/workflows?workspace_id=${projectId}`)
        if (workflowsResponse.ok) {
          const workflowsData = await workflowsResponse.json()
          setWorkflows(workflowsData.workflows || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      fetchData()
    }
  }, [projectId])

  const handleBack = () => {
    router.push(`/${projectId}`)
  }

  const handleNewWorkflow = () => {
    router.push(`/workflows?workspace_id=${projectId}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />
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
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-50 dark:text-green-700 dark:border-green-200'
      case 'paused':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-50 dark:text-orange-700 dark:border-orange-200'
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-50 dark:text-red-700 dark:border-red-200'
      case 'draft':
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-50 dark:text-gray-700 dark:border-gray-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-50 dark:text-gray-700 dark:border-gray-200'
    }
  }

  const filteredWorkflows = workflows.filter(workflow => 
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workflow.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading workflows...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header breadcrumb={{ project: project?.name || 'Workspace', item: 'Workflows' }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Workflow className="w-7 h-7 text-teal-600" />
                Workflows
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage workflows for {project?.name || 'this workspace'}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleNewWorkflow}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>

        {/* Search Bar */}
        {workflows.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {workflows.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-8">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Workflow className="h-8 w-8 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No workflows yet
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Create and manage automated workflows specific to this workspace. 
                Each workflow can process tasks and integrate with your agents.
              </p>
              <Button 
                onClick={handleNewWorkflow}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Workflow
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-center justify-center">
                        <Workflow className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{workflow.name}</h3>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(workflow.status)}`}>
                          {getStatusIcon(workflow.status)}
                          <span className="ml-1 capitalize">{workflow.status}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {workflow.description || 'No description provided'}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{workflow.executions || 0}</div>
                      <div>Executions</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {workflow.avg_runtime ? `${workflow.avg_runtime}s` : '0s'}
                      </div>
                      <div>Avg Runtime</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        ${(workflow.total_cost || 0).toFixed(4)}
                      </div>
                      <div>Total Cost</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
