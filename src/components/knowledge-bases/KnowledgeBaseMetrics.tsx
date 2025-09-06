'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  DollarSign,
  Clock,
  Database
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface KnowledgeBaseMetricsProps {
  knowledgeBaseId: string
}

interface MetricData {
  uploads_over_time: Array<{ date: string; count: number; cost: number }>
  file_types: Array<{ type: string; count: number; size: number }>
  total_stats: {
    total_files: number
    total_size: number
    total_cost: number
    avg_file_size: number
  }
}

export default function KnowledgeBaseMetrics({ knowledgeBaseId }: KnowledgeBaseMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [knowledgeBaseId])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/metrics`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(4)}`
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No metrics available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Upload some files to see metrics and analytics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.total_stats.total_files}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Size</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatFileSize(metrics.total_stats.total_size)}
                </p>
              </div>
              <Database className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(metrics.total_stats.total_cost)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg File Size</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatFileSize(metrics.total_stats.avg_file_size)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uploads Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Uploads Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.uploads_over_time}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [
                      name === 'count' ? value : formatCurrency(Number(value)), 
                      name === 'count' ? 'Files' : 'Cost'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="count"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="cost"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* File Types Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              File Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.file_types}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="type" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'count' ? value : formatFileSize(Number(value)), 
                      name === 'count' ? 'Files' : 'Total Size'
                    ]}
                  />
                  <Bar dataKey="count" fill="#10b981" name="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* File Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>File Types Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Type</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Files</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Total Size</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Avg Size</th>
                </tr>
              </thead>
              <tbody>
                {metrics.file_types.map((fileType) => (
                  <tr key={fileType.type} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 px-4 font-medium">{fileType.type}</td>
                    <td className="py-3 px-4 text-right">{fileType.count}</td>
                    <td className="py-3 px-4 text-right">{formatFileSize(fileType.size)}</td>
                    <td className="py-3 px-4 text-right">
                      {formatFileSize(fileType.size / fileType.count)}
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
