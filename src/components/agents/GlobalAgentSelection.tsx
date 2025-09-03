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
// Removed direct db-service import - using API calls instead
import AgentCreationDialog from './AgentCreationDialog'
import Header from '../shared/Header'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}

interface GlobalAgentSelectionProps {
  // No props needed for global view
}

const GlobalAgentSelection: React.FC<GlobalAgentSelectionProps> = () => {
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null)
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [breadcrumb, setBreadcrumb] = useState<{
    project?: string;
    item?: string;
  }>({
    project: '',
    item: ''
  })

  // State for projects - not used in global view but kept for compatibility
  const [projects, setProjects] = useState<any[]>([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

  // State for agents
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  // Load all agents globally
  const loadGlobalAgents = async () => {
    try {
      setAgentsLoading(true)
      setAgentsError(null)
      
      const response = await fetch('/api/agents')
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      // API returns { agents: [...], userRole: string }
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error loading global agents:', error)
      setAgentsError(error instanceof Error ? error.message : 'Unknown error occurred')
      setAgents([])
    } finally {
      setAgentsLoading(false)
    }
  }

  useEffect(() => {
    loadGlobalAgents()
  }, [])

  const handleAgentClick = (agent: Agent) => {
    router.push(`/agents/${agent.id}?tab=overview`)
  }

  const handleDeleteAgent = async (agent: Agent) => {
    if (!agent) return
    
    try {
      setDeletingAgent(agent.id)
      
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete agent')
      }
      
      // Remove from local state
      setAgents(prevAgents => prevAgents.filter(a => a.id !== agent.id))
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting agent:', error)
      alert('Failed to delete agent. Please try again.')
    } finally {
      setDeletingAgent(null)
    }
  }

  const handleCopyAgentId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    setCopiedAgentId(id)
    setTimeout(() => setCopiedAgentId(null), 2000)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getAgentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return <Terminal className="w-5 h-5 text-green-600" />
      case 'outbound':
        return <ExternalLink className="w-5 h-5 text-blue-600" />
      case 'webhook':
        return <Globe className="w-5 h-5 text-purple-600" />
      case 'voice':
        return <MonitorSpeaker className="w-5 h-5 text-orange-600" />
      default:
        return <Bot className="w-5 h-5 text-gray-600" />
    }
  }

  // Filter agents based on search and status
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !searchQuery || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.agent_type.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && agent.is_active) ||
      (statusFilter === 'inactive' && !agent.is_active)
    
    return matchesSearch && matchesStatus
  })

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading global agents...</span>
      </div>
    )
  }

  if (agentsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error loading agents</h3>
        <p className="text-muted-foreground mb-4">{agentsError}</p>
        <Button onClick={loadGlobalAgents} variant="outline">
          <Loader2 className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">All Agents</h1>
          <p className="text-sm text-gray-500">
            Manage agents across all workspaces. {filteredAgents.length} of {agents.length} agents
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              />
            </div>

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Agents
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                  Active Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
                  Inactive Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>

            {/* Create Agent Button - disabled in global view */}
            <Button 
              disabled 
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
            >
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="group">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Agents</h3>
                  <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{agents.length}</p>
                  <p className="text-xs text-gray-400 font-medium">All workspaces</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-bold text-green-600">Running</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</h3>
                  <p className="text-2xl font-light text-green-600 tracking-tight">{agents.filter(a => a.is_active).length}</p>
                  <p className="text-xs text-gray-400 font-medium">Online agents</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                    <Pause className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-500">Stopped</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inactive</h3>
                  <p className="text-2xl font-light text-red-600 tracking-tight">{agents.filter(a => !a.is_active).length}</p>
                  <p className="text-xs text-gray-400 font-medium">Offline agents</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Globe className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Workspaces</h3>
                  <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{new Set(agents.map(a => a.project_id)).size}</p>
                  <p className="text-xs text-gray-400 font-medium">Different projects</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agents List */}
        {filteredAgents.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No agents found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search criteria' : 'No agents have been created yet'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className={`group p-6 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                  selectedAgent === agent.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleAgentClick(agent)}
              >
                <div className="flex items-center justify-between">
                  {/* Left: Agent Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                      {getAgentTypeIcon(agent.agent_type)}
                      <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                        agent.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                        <span className="text-sm text-gray-500">
                          {agent.agent_type}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          agent.environment === 'production' || agent.environment === 'prod'
                            ? 'bg-red-100 text-red-700'
                            : agent.environment === 'staging' || agent.environment === 'stage'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {agent.environment}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>ID: {agent?.id?.slice(0, 8)}...{agent?.id?.slice(-4)}</span>
                        <span>Created {formatDate(agent.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/agents/${agent.id}?tab=overview`)
                        }} className="text-sm">
                          <Eye className="h-4 w-4 mr-3 text-gray-500" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/agents/${agent.id}?tab=analytics`)
                        }} className="text-sm">
                          <BarChart3 className="h-4 w-4 mr-3 text-gray-500" />
                          Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/agents/${agent.id}?tab=settings`)
                        }} className="text-sm">
                          <Settings className="h-4 w-4 mr-3 text-gray-500" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleCopyAgentId(agent.id, e)
                        }} className="text-sm">
                          <Copy className="h-4 w-4 mr-3 text-gray-500" />
                          Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(agent)
                        }} className="text-red-600 focus:text-red-600 text-sm">
                          <Trash2 className="h-4 w-4 mr-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className={`group cursor-pointer transition-all duration-300 ${
                  selectedAgent === agent.id ? 'ring-1 ring-blue-500' : ''
                }`}
                onClick={() => handleAgentClick(agent)}
              >
                <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                  <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                        {getAgentTypeIcon(agent.agent_type)}
                        <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                          agent.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{agent.agent_type}</p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleCopyAgentId(agent.id, e)
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(agent)
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Environment Badge */}
                  <div className="mb-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                      agent.environment === 'production' || agent.environment === 'prod'
                        ? 'bg-red-100 text-red-700'
                        : agent.environment === 'staging' || agent.environment === 'stage'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {agent.environment}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created {formatDate(agent.created_at)}</span>
                    <span className={`font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Agent
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{showDeleteConfirm?.name}"? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              disabled={deletingAgent !== null}
              className="flex-1 border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDeleteConfirm && handleDeleteAgent(showDeleteConfirm)}
              disabled={deletingAgent !== null}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingAgent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GlobalAgentSelection
