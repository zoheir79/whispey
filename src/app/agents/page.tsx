'use client'

import React from 'react'
import AgentSelection from '@/components/agents/AgentSelection'
import Header from '@/components/shared/Header'

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <AgentSelection 
        projectId="all" // Global context - fetch all agents
      />
    </div>
  )
}
