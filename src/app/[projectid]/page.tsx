'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Bot, Database, Workflow, BarChart3, Settings, Users, Key, RefreshCw, Trash2, Building2, Circle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Header from '@/components/shared/Header'
import WorkspaceMetrics from '@/components/workspace/WorkspaceMetrics'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
  agent_count?: number
  s3_enabled?: boolean
  s3_region?: string
  s3_endpoint?: string
  s3_bucket_prefix?: string
  s3_cost_per_gb?: number
  s3_default_storage_gb?: number
}

export default function WorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const { globalRole, permissions, isAdmin, isSuperAdmin, isLoading: roleLoading } = useGlobalRole()

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

  const handleNavigation = (section: string) => {
    router.push(`/${projectId}/${section}`)
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'staging':
      case 'stage':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-600'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const getWorkspaceInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <p className="text-sm text-gray-600">Workspace not found</p>
            <Button onClick={handleBack} className="mt-4">
              Back to Workspaces
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header breadcrumb={{ project: project.name, item: 'Overview' }} />
      
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
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg">
                {getWorkspaceInitials(project.name)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  {project.name}
                  <div className={`w-3 h-3 rounded-full ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className={`text-xs font-medium border ${getEnvironmentColor(project.environment)}`}
                  >
                    {project.environment}
                  </Badge>
                  {project.token_hash && (
                    <Badge variant="outline" className="text-xs font-medium bg-green-50 text-green-700 border-green-200">
                      <Key className="h-3 w-3 mr-1" />
                      API Enabled
                    </Badge>
                  )}
                  {project.s3_enabled && (
                    <Badge variant="outline" className="text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                      S3 Storage
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="mb-8">
            <Card className="bg-white dark:bg-slate-800 shadow-sm">
              <CardContent className="p-6">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {project.description}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 mt-4">
                  <Clock className="w-3 h-3" />
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Workspace Metrics */}
        <div className="mb-8">
          <WorkspaceMetrics projectId={projectId} />
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-blue-500"
            onClick={() => handleNavigation('agents')}
          >
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Agents</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Manage voice agents and their configurations
                </p>
                <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                  {project.agent_count || 0} agents
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-teal-500"
            onClick={() => handleNavigation('workflows')}
          >
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Workflow className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Workflows</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create and manage automated workflows
                </p>
                <Badge variant="outline" className="text-xs font-medium bg-teal-50 text-teal-700 border-teal-200">
                  Coming Soon
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-orange-500"
            onClick={() => handleNavigation('knowledge-bases')}
          >
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Database className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Knowledge Bases</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Upload and manage knowledge documents
                </p>
                <Badge variant="outline" className="text-xs font-medium bg-orange-50 text-orange-700 border-orange-200">
                  Available
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-purple-500"
            onClick={() => handleNavigation('analytics')}
          >
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Analytics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  View performance metrics and insights
                </p>
                <Badge variant="outline" className="text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                  Coming Soon
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {isSuperAdmin && (
          <div className="mb-8">
            <Card className="bg-white dark:bg-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Workspace Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" className="text-gray-600 dark:text-gray-300">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                  <Button variant="outline" size="sm" className="text-gray-600 dark:text-gray-300">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button variant="outline" size="sm" className="text-gray-600 dark:text-gray-300">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate API Token
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
