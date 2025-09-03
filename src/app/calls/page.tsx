'use client'

import React from 'react'
import GlobalCallLogs from '@/components/calls/GlobalCallLogs'
import Header from '@/components/shared/Header'

export default function CallsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <GlobalCallLogs />
    </div>
  )
}
