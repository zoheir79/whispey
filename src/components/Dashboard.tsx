'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft,
  BarChart3, 
  List 
} from 'lucide-react'
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
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header className="px-6 py-12 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
  <div className="max-w-7xl mx-auto flex row justify-between">
    <Button variant="ghost" onClick={onBack} className="mb-6 -ml-3 hover:bg-white/50">
      <ChevronLeft className="h-4 w-4 mr-2" />
      Back to Agents
    </Button>
    
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">

      {/* Right side - Enhanced Tabs */}
      <nav className="flex space-x-2 bg-white/70 backdrop-blur-sm rounded-xl p-2 shadow-sm border border-white/50 lg:flex-shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-md ring-1 ring-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
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
</header>

      {/* Tab Content */}
      <main className="flex-1">
        {activeTab === 'overview' && (
          <Overview project={project} agent={agent} />
        )}
        {activeTab === 'logs' && (
          <CallLogs project={project} agent={agent} onBack={onBack} />
        )}
      </main>
    </div>
  )
}

export default Dashboard