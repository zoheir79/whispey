'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Database, CheckCircle, AlertCircle, Clock, Search, Eye, Edit, Trash2 } from 'lucide-react'
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

interface KnowledgeBase {
  id: string
  name: string
  description: string
  status: 'active' | 'processing' | 'error'
  workspace_id: string
  workspace_name: string
  created_at: string
  updated_at: string
  file_count: number
  total_size: number
}

export default function ProjectKnowledgeBasesPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const [project, setProject] = useState<Project | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null)
  const [deletingKB, setDeletingKB] = useState<KnowledgeBase | null>(null)
  const [knowledgeBaseDialog, setKnowledgeBaseDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${projectId}`)
        if (projectResponse.ok) {
          const projectData = await projectResponse.json()
          setProject(projectData)
        }

        // Fetch knowledge bases for this workspace
        const kbResponse = await fetch(`/api/knowledge-bases?workspace_id=${projectId}`)
        if (kbResponse.ok) {
          const kbData = await kbResponse.json()
          setKnowledgeBases(kbData.knowledge_bases || [])
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

  const handleNewKB = () => {
    router.push(`/knowledge-bases?workspace_id=${projectId}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-orange-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-50 dark:text-green-700 dark:border-green-200'
      case 'processing':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-50 dark:text-orange-700 dark:border-orange-200'
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-50 dark:text-red-700 dark:border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-50 dark:text-gray-700 dark:border-gray-200'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredKnowledgeBases = knowledgeBases.filter(kb => 
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading knowledge bases...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header breadcrumb={{ project: project?.name || 'Workspace', item: 'Knowledge Bases' }} />
      
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
                <Database className="w-7 h-7 text-orange-600" />
                Knowledge Bases
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage knowledge bases for {project?.name || 'this workspace'}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleNewKB}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Knowledge Base
          </Button>
        </div>

        {/* Search Bar */}
        {knowledgeBases.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                placeholder="Search knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {knowledgeBases.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-8">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No knowledge bases yet
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Create and manage knowledge bases specific to this workspace. 
                Upload documents and data to enhance your agents' capabilities.
              </p>
              <Button 
                onClick={handleNewKB}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Knowledge Base
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKnowledgeBases.map((kb) => (
              <Card key={kb.id} className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                        <Database className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{kb.name}</h3>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(kb.status)}`}>
                          {getStatusIcon(kb.status)}
                          <span className="ml-1 capitalize">{kb.status}</span>
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Action Icons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/${params.projectid}/knowledge-bases/${kb.id}`)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingKB(kb)
                          setKnowledgeBaseDialog(true)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeletingKB(kb)
                          setDeleteDialog(true)
                        }}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {kb.description || 'No description provided'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{kb.file_count || 0}</div>
                      <div>Files</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatFileSize(kb.total_size || 0)}
                      </div>
                      <div>Total Size</div>
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
