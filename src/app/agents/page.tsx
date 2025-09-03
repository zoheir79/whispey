'use client'

import React from 'react'
import GlobalAgentSelection from '@/components/agents/GlobalAgentSelection'
import Header from '@/components/shared/Header'

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <GlobalAgentSelection />
    </div>
  )
}
