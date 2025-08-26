'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { useGlobalRole } from '@/hooks/useGlobalRole';
import Link from 'next/link';

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
  const [searchQuery, setSearchQuery] = useState('');
  const { globalRole, permissions, isLoading: roleLoading } = useGlobalRole();

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.status}`);
        }
        const data = await response.json();
        setAgents(data.agents || []);
      } catch (err: any) {
        console.error('Error fetching agents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      fetchAgents();
    }
  }, [roleLoading]);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-8 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {permissions?.canViewAllAgents ? 'All Agents' : 'My Agents'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {error ? 'Unable to load agents' : 
                  permissions?.canViewAllAgents 
                    ? `${filteredAgents.length} agent${filteredAgents.length !== 1 ? 's' : ''} across all workspaces`
                    : `${filteredAgents.length} of your agent${filteredAgents.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Global Role Badge */}
              {globalRole && globalRole !== 'user' && (
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-sm font-medium border border-blue-200">
                  {globalRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                </div>
              )}
              
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors duration-200">
                <Plus className="w-4 h-4" />
                New Agent
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-6">
          {error ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading agents</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No agents found' : 'No agents yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : permissions?.canViewAllAgents 
                    ? 'No agents have been created yet across any workspace.'
                    : 'You don\'t have access to any agents yet.'
                }
              </p>
              {!searchQuery && (
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors duration-200">
                  Create Your First Agent
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}?tab=overview`}
                  className="group bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
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
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {agent.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {agent.description}
                    </p>
                  )}

                  <div className="space-y-2 text-xs text-gray-500">
                    {agent.project_name && (
                      <div>Project: {agent.project_name}</div>
                    )}
                    <div>Created: {new Date(agent.created_at).toLocaleDateString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
