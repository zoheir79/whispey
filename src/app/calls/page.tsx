'use client'

import React from 'react'
import CallLogs from '@/components/calls/CallLogs'
import Header from '@/components/shared/Header'

export default function CallsPage() {
  // Mock project and agent for global context - CallLogs will fetch all calls
  const globalProject = { id: 'all', name: 'All Projects' }
  const globalAgent = { id: 'all', name: 'All Agents' }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <CallLogs 
        project={globalProject}
        agent={globalAgent}
        onBack={() => {}} // No back button in global context
      />
    </div>
  )
}
