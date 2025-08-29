'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { 
  Phone, 
  Clock, 
  Users, 
  TrendingUp, 
  Activity, 
  Headphones,
  MessageSquare,
  Timer,
  Calendar,
  Star
} from 'lucide-react'

interface DashboardStats {
  totalCalls: number
  totalMinutes: number
  averageCallDuration: number
  activeAgents: number
  successRate: number
  todayCalls: number
}

interface CallData {
  date: string
  calls: number
  minutes: number
  success: number
}

interface AgentPerformance {
  name: string
  calls: number
  satisfaction: number
  avgDuration: number
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function WorkspaceDashboard({ workspace }: { workspace: any }) {
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    totalMinutes: 0,
    averageCallDuration: 0,
    activeAgents: 0,
    successRate: 0,
    todayCalls: 0
  })
  const [loading, setLoading] = useState(true)
  const [callsData, setCallsData] = useState<CallData[]>([])
  const [agentsData, setAgentsData] = useState<AgentPerformance[]>([])

  // Mock data - replace with real API calls
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Simulate API call
      setTimeout(() => {
        setStats({
          totalCalls: 1247,
          totalMinutes: 18642,
          averageCallDuration: 14.9,
          activeAgents: 12,
          successRate: 94.2,
          todayCalls: 87
        })

        setCallsData([
          { date: '01/01', calls: 45, minutes: 672, success: 96 },
          { date: '02/01', calls: 52, minutes: 784, success: 94 },
          { date: '03/01', calls: 38, minutes: 567, success: 98 },
          { date: '04/01', calls: 67, minutes: 1004, success: 92 },
          { date: '05/01', calls: 58, minutes: 843, success: 95 },
          { date: '06/01', calls: 73, minutes: 1095, success: 97 },
          { date: '07/01', calls: 87, minutes: 1305, success: 94 }
        ])

        setAgentsData([
          { name: 'Support Agent', calls: 342, satisfaction: 4.8, avgDuration: 12.3 },
          { name: 'Sales Rep', calls: 287, satisfaction: 4.6, avgDuration: 18.7 },
          { name: 'Tech Support', calls: 198, satisfaction: 4.9, avgDuration: 22.1 },
          { name: 'Customer Care', calls: 156, satisfaction: 4.7, avgDuration: 15.2 }
        ])

        setLoading(false)
      }, 1000)
    }

    fetchDashboardData()
  }, [workspace])

  const pieData = [
    { name: 'Réussi', value: stats.successRate },
    { name: 'Échec', value: 100 - stats.successRate }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-200 h-80 rounded-xl"></div>
            <div className="bg-gray-200 h-80 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-2xl shadow-lg mb-4">
          <Activity className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Tableau de Bord</h1>
        </div>
        <p className="text-gray-600">
          Statistiques en temps réel pour <span className="font-semibold text-blue-600">{workspace?.name || 'votre workspace'}</span>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Appels Totaux</p>
                <p className="text-3xl font-bold text-blue-900">{stats.totalCalls.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1">+{stats.todayCalls} aujourd'hui</p>
              </div>
              <Phone className="w-12 h-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Minutes Totales</p>
                <p className="text-3xl font-bold text-green-900">{stats.totalMinutes.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">≈ {Math.round(stats.totalMinutes / 60)} heures</p>
              </div>
              <Clock className="w-12 h-12 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Agents Actifs</p>
                <p className="text-3xl font-bold text-purple-900">{stats.activeAgents}</p>
                <p className="text-xs text-purple-600 mt-1">Durée moy: {stats.averageCallDuration}min</p>
              </div>
              <Headphones className="w-12 h-12 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-medium">Taux de Réussite</p>
                <p className="text-3xl font-bold text-amber-900">{stats.successRate}%</p>
                <p className="text-xs text-amber-600 mt-1">Performance excellente</p>
              </div>
              <TrendingUp className="w-12 h-12 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calls Trend */}
        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5" />
              Évolution des Appels (7 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={callsData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="calls" 
                  stroke="#3B82F6" 
                  fillOpacity={1} 
                  fill="url(#colorCalls)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Success Rate Pie */}
        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Répartition des Performances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Performance Table */}
      <Card className="bg-white shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Performance des Agents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Agent</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Appels</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Satisfaction</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Durée Moy.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agentsData.map((agent, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {agent.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 font-medium">
                        {agent.calls}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="font-semibold text-gray-900">{agent.satisfaction}/5</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{agent.avgDuration} min</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
