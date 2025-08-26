'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Plus, Settings, Activity, Calendar } from 'lucide-react';
import { useGlobalRole } from '@/hooks/useGlobalRole';

interface Agent {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  project_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { globalRole, permissions, isLoading: roleLoading } = useGlobalRole();

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (!response.ok) {
          throw new Error('Failed to fetch agents');
        }
        const data = await response.json();
        setAgents(data.agents || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      fetchAgents();
    }
  }, [roleLoading]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading agents</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const pageTitle = permissions?.canViewAllAgents ? 'All Agents' : 'My Agents';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Bot className="w-8 h-8 text-blue-600" />
                {pageTitle}
              </h1>
              <p className="mt-2 text-gray-600">
                {permissions?.canViewAllAgents 
                  ? `Manage all agents across all workspaces (${agents.length} total)`
                  : `Manage your agents (${agents.length} total)`
                }
              </p>
            </div>
            
            {/* Global Role Badge */}
            {globalRole && globalRole !== 'user' && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {globalRole.replace('_', ' ').toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600">
              {permissions?.canViewAllAgents 
                ? 'No agents exist in any workspace yet.'
                : 'You don\'t have access to any agents yet.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    agent.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {agent.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-500">
                  {agent.project_name && (
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>Project: {agent.project_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {new Date(agent.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>Updated: {new Date(agent.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
