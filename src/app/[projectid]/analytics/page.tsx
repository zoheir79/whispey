'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import Header from '@/components/shared/Header'

interface Project {
  id: string
  name: string
  description: string
}

export default function ProjectAnalyticsPage() {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800">
      <Header breadcrumb={{ project: project?.name || 'Workspace', item: 'Analytics' }} />
      
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
                <BarChart3 className="w-7 h-7 text-blue-600" />
                Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Analytics and insights for {project?.name || 'this workspace'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Analytics for {project?.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              View detailed analytics and performance metrics for all agents, 
              workflows, and knowledge bases in this workspace.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Analytics dashboard coming soon...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
