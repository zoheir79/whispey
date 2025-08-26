'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Clock, Phone } from 'lucide-react'

interface Agent {
  id: string
  name: string
  agent_type: string
  environment: string
  project_id: string
  configuration: any
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface AgentAnalyticsProps {
  agent: Agent
}

export default function AgentAnalytics({ agent }: AgentAnalyticsProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Agent Analytics</h1>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-50 p-4 rounded-full">
                <BarChart3 className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Analytics Coming Soon
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Detailed analytics and performance metrics for <strong>{agent.name}</strong> will be available soon. 
              This will include call metrics, success rates, response times, and more.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Calls</p>
                <p className="text-xl font-semibold text-gray-900">--</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-xl font-semibold text-gray-900">--%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-xl font-semibold text-gray-900">-- min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-xl font-semibold text-gray-900">--</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
