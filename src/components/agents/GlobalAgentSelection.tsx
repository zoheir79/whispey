'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { 
  ChevronLeft, 
  Bot, 
  Search, 
  Plus, 
  Loader2, 
  AlertCircle, 
  MoreHorizontal, 
  Trash2, 
  Copy, 
  Settings, 
  Clock, 
  Filter, 
  SortDesc, 
  Grid3X3, 
  List,
  CheckCircle2,
  Pause,
  BarChart3,
  Terminal,
  Code2,
  Eye,
  Globe,
  MonitorSpeaker,
  ExternalLink
} from 'lucide-react'
import AgentCreationDialog from './AgentCreationDialog'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
  project_name?: string
}

const GlobalAgentSelection: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null)
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // State for agents
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  const router = useRouter()
  const { globalRole, permissions, isLoading: roleLoading } = useGlobalRole()

  // Fetch agents data from global API
  useEffect(() => {
    const fetchAgents = async () => {
      if (roleLoading) return

      setAgentsLoading(true)
      setAgentsError(null)

      try {
        const response = await fetch(`/api/agents`, {
          method: 'GET',
          headers: {
            'authorization': localStorage.getItem('token') || ''
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.status}`)
        }

        const data = await response.json()
        setAgents(data.agents || [])
      } catch (error) {
        console.error('Error fetching agents:', error)
        setAgentsError(error instanceof Error ? error.message : 'Failed to fetch agents')
      } finally {
        setAgentsLoading(false)
      }
    }

    fetchAgents()
  }, [roleLoading])

  // Filter agents based on search and status
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.agent_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (agent.project_name && agent.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && agent.is_active) ||
                         (statusFilter === 'inactive' && !agent.is_active)
    
    return matchesSearch && matchesStatus
  })

  const handleAgentSelect = (agentId: string) => {
    // Navigate to agent details page
    router.push(`/agents/${agentId}?tab=overview`)
  }

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      setDeletingAgent(agent.id)
      
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: {
          'authorization': localStorage.getItem('token') || ''
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete agent')
      }

      // Remove agent from list
      setAgents(prev => prev.filter(a => a.id !== agent.id))
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting agent:', error)
      alert('Failed to delete agent')
    } finally {
      setDeletingAgent(null)
    }
  }

  const handleCopyId = (agentId: string) => {
    navigator.clipboard.writeText(agentId)
    setCopiedAgentId(agentId)
    setTimeout(() => setCopiedAgentId(null), 2000)
  }

  if (roleLoading || agentsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading agents...</p>
          </div>
        </div>
      </div>
    )
  }

  if (agentsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-medium text-red-900">Error Loading Agents</h3>
          </div>
          <p className="text-red-700 mb-4">{agentsError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Bot className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {permissions?.canViewAllAgents ? 'All Agents' : 'My Agents'}
              </h1>
              {globalRole && globalRole !== 'user' && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {globalRole === 'super_admin' ? 'Super Admin' : globalRole === 'admin' ? 'Global Admin' : 'Owner'}
                </Badge>
              )}
            </div>
            <p className="text-gray-600">
              {permissions?.canViewAllAgents 
                ? `Manage all agents across all projects (${agents.length} total)`
                : `Manage your agents across your projects (${agents.length} total)`
              }
            </p>
          </div>
          
          <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </div>

        {/* Search and Controls */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search agents by name, type, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold">{agents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold">{agents.filter(a => a.is_active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Pause className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold">{agents.filter(a => !a.is_active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Projects</p>
                  <p className="text-2xl font-bold">{new Set(agents.map(a => a.project_id)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agents Display */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No agents found' : 'No agents yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : permissions?.canViewAllAgents 
                ? 'No agents have been created yet across any workspace.'
                : 'You don\'t have access to any agents yet.'
            }
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Your First Agent
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          : "space-y-4"
        }>
          {filteredAgents.map((agent) => (
            <Card 
              key={agent.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => handleAgentSelect(agent.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {agent.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <span className="text-xs text-gray-500">
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleAgentSelect(agent.id)
                      }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleCopyId(agent.id)
                      }}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedAgentId === agent.id ? 'Copied!' : 'Copy ID'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(agent)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Type:</span> {agent.agent_type}
                  </div>
                  {agent.project_name && (
                    <div>
                      <span className="font-medium">Project:</span> {agent.project_name}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Created:</span> {new Date(agent.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Dialog open={true} onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Agent</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                disabled={deletingAgent === showDeleteConfirm.id}
              >
                {deletingAgent === showDeleteConfirm.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Agent'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Agent Creation Dialog */}
      {showCreateDialog && (
        <AgentCreationDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onAgentCreated={(newAgent) => {
            setAgents(prev => [...prev, newAgent])
            setShowCreateDialog(false)
          }}
        />
      )}
    </div>
  )
}

export default GlobalAgentSelection
