'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Bot, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Header from '@/components/shared/Header'

interface Project {
  id: string
  name: string
  description: string
}

export default function ProjectWorkflowsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`)
        if (response.ok) {
          const data = await response.json()
          setProject(data)
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      fetchProject()
    }
  }, [projectId])

  const handleBack = () => {
    router.push('/')
  }

  const handleNewWorkflow = () => {
    router.push('/workflows')
  }

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

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Workflow className="h-8 w-8 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Workflows for {project?.name}
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
      </div>
    </div>
  )
}
