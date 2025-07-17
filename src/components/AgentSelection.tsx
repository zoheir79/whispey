'use client'
import React from 'react'
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
}

interface AgentSelectionProps {
  project: any
  onAgentSelect: (agent: Agent) => void
  onBack: () => void
}

const AgentSelection: React.FC<AgentSelectionProps> = ({ project, onAgentSelect, onBack }) => {
  const { data: agents, loading, error } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active',
    filters: [
      { column: 'project_id', operator: 'eq', value: project.id },
      { column: 'is_active', operator: 'eq', value: true }
    ],
    orderBy: { column: 'created_at', ascending: false }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Error loading agents: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="border-b border-gray-800 px-6 py-4">
        <button 
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 mb-2"
        >
          ← Back to Projects
        </button>
        <h1 className="text-2xl font-bold">{project.name} - Agents</h1>
        <p className="text-gray-400 mt-1">Select an agent to view call logs</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents?.map((agent: Agent) => (
            <div
              key={agent.id}
              onClick={() => onAgentSelect(agent)}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{agent.name}</h3>
                  <p className="text-gray-400 text-sm">{agent.agent_type}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>

              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  agent.environment === 'production' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {agent.environment}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Created {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentSelection