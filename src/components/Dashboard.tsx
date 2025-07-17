'use client'
import React, { useState } from 'react'
import { BarChart3, List } from 'lucide-react'
import Overview from './Overview'
import CallLogs from './CallLogs'

interface DashboardProps {
  project: any
  agent: any
  onBack: () => void
}

const Dashboard: React.FC<DashboardProps> = ({ project, agent, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'Call Logs', icon: List }
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <button 
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 mb-2"
        >
          ← Back to Agents
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-gray-400 mt-1">{project.name}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'overview' && (
          <Overview project={project} agent={agent} />
        )}
        {activeTab === 'logs' && (
          <CallLogs project={project} agent={agent} onBack={onBack} />
        )}
      </div>
    </div>
  )
}

export default Dashboard