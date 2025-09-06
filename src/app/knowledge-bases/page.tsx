'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Database, 
  Plus, 
  Search, 
  Upload, 
  FileText, 
  Trash2, 
  Edit, 
  Eye,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import Header from '@/components/shared/Header'
import KnowledgeBaseDialog from '@/components/knowledge-bases/KnowledgeBaseDialog'

interface KnowledgeBase {
  id: string
  name: string
  description: string
  workspace_id: string
  workspace_name: string
  s3_bucket?: string
  s3_prefix?: string
  file_count: number
  total_size: number
  status: 'active' | 'processing' | 'error'
  created_at: string
  updated_at: string
}

export default function KnowledgeBasesPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const { isAdmin, isSuperAdmin } = useGlobalRole()

  useEffect(() => {
    fetchKnowledgeBases()
  }, [])

  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/knowledge-bases')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeBases(data.knowledge_bases || [])
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.workspace_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleEdit = (kb: KnowledgeBase) => {
    setSelectedKB(kb)
    setShowEditDialog(true)
  }

  const handleDelete = async (kb: KnowledgeBase) => {
    if (!confirm(`Are you sure you want to delete "${kb.name}"? This action cannot be undone.`)) {
      return
    }

    setDeleteLoading(kb.id)
    try {
      const response = await fetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete knowledge base')
      }

      await fetchKnowledgeBases()
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete knowledge base')
    } finally {
      setDeleteLoading(null)
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
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
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

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
      <Header breadcrumb={{ project: 'Knowledge Bases' }} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Database className="w-8 h-8 text-orange-500" />
                {isAdmin ? 'All Knowledge Bases' : 'My Knowledge Bases'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your knowledge bases and document collections
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Knowledge Base
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              type="text"
              placeholder="Search knowledge bases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Knowledge Bases Grid */}
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
        ) : filteredKnowledgeBases.length === 0 ? (
          <Card className="text-center py-12 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
            <CardContent>
              <Database className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No knowledge bases found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchQuery ? 'No knowledge bases match your search.' : 'Get started by creating your first knowledge base.'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Knowledge Base
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKnowledgeBases.map((kb) => (
              <Card key={kb.id} className="bg-white dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                          <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-orange-900 dark:text-orange-100 truncate">
                            {kb.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-orange-600 dark:text-orange-400">
                            <span>{kb.workspace_name}</span>
                            <span>{kb.file_count} files</span>
                            <span>{formatFileSize(kb.total_size)}</span>
                          </div>
                        </div>
                      </div>
                      {kb.description && (
                        <p className="text-sm text-orange-700 dark:text-orange-300 line-clamp-2">
                          {kb.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-auto">
                      <Badge className={`text-xs ${getStatusColor(kb.status)}`}>
                        {kb.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-orange-200 dark:border-orange-700">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.location.href = `/knowledge-bases/${kb.id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/knowledge-bases/${kb.id}/files`}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Files
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(kb)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDelete(kb)}
                        disabled={deleteLoading === kb.id}
                      >
                        {deleteLoading === kb.id ? (
                          <div className="w-3 h-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Knowledge Base Dialog */}
      {showCreateDialog && (
        <KnowledgeBaseDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchKnowledgeBases()
          }}
        />
      )}

      {/* Edit Knowledge Base Dialog */}
      {showEditDialog && selectedKB && (
        <KnowledgeBaseDialog
          open={showEditDialog}
          knowledgeBase={selectedKB}
          onClose={() => {
            setShowEditDialog(false)
            setSelectedKB(null)
          }}
          onSuccess={() => {
            setShowEditDialog(false)
            setSelectedKB(null)
            fetchKnowledgeBases()
          }}
        />
      )}
    </div>
  )
}
