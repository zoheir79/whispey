'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Database, 
  Upload, 
  FileText, 
  Trash2, 
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  BarChart3
} from 'lucide-react'
import Header from '@/components/shared/Header'
import KnowledgeBaseFiles from '@/components/knowledge-bases/KnowledgeBaseFiles'
import KnowledgeBaseSettings from '@/components/knowledge-bases/KnowledgeBaseSettings'
import KnowledgeBaseMetrics from '@/components/knowledge-bases/KnowledgeBaseMetrics'

interface KnowledgeBase {
  id: string
  name: string
  description: string
  workspace_id: string
  workspace_name: string
  s3_bucket?: string
  s3_bucket_name?: string
  s3_prefix?: string
  file_count: number
  total_size: number
  status: 'active' | 'processing' | 'error'
  created_at: string
  updated_at: string
}

export default function KnowledgeBasePage() {
  const params = useParams()
  const kbId = params.id as string
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('files')

  useEffect(() => {
    if (kbId) {
      fetchKnowledgeBase()
    }
  }, [kbId])

  const fetchKnowledgeBase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/knowledge-bases/${kbId}`)
      if (response.ok) {
        const data = await response.json()
        setKnowledgeBase(data.knowledge_base)
      }
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-orange-200 dark:bg-orange-800 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-orange-200 dark:bg-orange-800 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-white dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-6">
                    <div className="h-4 bg-orange-200 dark:bg-orange-700 rounded mb-2"></div>
                    <div className="h-8 bg-orange-200 dark:bg-orange-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!knowledgeBase) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Card className="text-center py-12 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardContent>
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Knowledge Base Not Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                The knowledge base you're looking for doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
      <Header breadcrumb={{ 
        project: 'Knowledge Bases', 
        item: knowledgeBase.name 
      }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Knowledge Base Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-8 h-8 text-orange-500" />
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {knowledgeBase.name}
                </h1>
                <div className="flex items-center gap-2">
                  {getStatusIcon(knowledgeBase.status)}
                  <Badge className={`text-sm ${getStatusColor(knowledgeBase.status)}`}>
                    {knowledgeBase.status}
                  </Badge>
                </div>
              </div>
              {knowledgeBase.description && (
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  {knowledgeBase.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Workspace: <strong>{knowledgeBase.workspace_name}</strong></span>
                <span>Created: {new Date(knowledgeBase.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Files</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {knowledgeBase.file_count}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Total Size</p>
                  <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                    {formatFileSize(knowledgeBase.total_size)}
                  </p>
                </div>
                <Database className="w-8 h-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">S3 Bucket</p>
                  <p className="text-lg font-semibold text-blue-900 dark:text-blue-100 truncate">
                    {knowledgeBase.s3_bucket_name || knowledgeBase.s3_bucket || 'Not configured'}
                  </p>
                </div>
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Files
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

          <TabsContent value="files" className="mt-6">
            <KnowledgeBaseFiles 
              knowledgeBaseId={knowledgeBase.id}
              onFileChange={fetchKnowledgeBase}
            />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <KnowledgeBaseMetrics knowledgeBaseId={knowledgeBase.id} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <KnowledgeBaseSettings 
              knowledgeBase={knowledgeBase}
              onUpdate={fetchKnowledgeBase}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
