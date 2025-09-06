'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  Settings, 
  Database, 
  Workflow, 
  DollarSign,
  Calendar,
  Clock,
  Save,
  AlertTriangle
} from 'lucide-react'
import Header from '@/components/shared/Header'

interface ConfigData {
  knowledgeBases: {
    costBase: number
    billingCycle: string
    dedicatedMode: boolean
    fixedPeriodCost: number
  }
  workflows: {
    costBase: number
    costPerMinute: number
    billingCycle: string
    dedicatedMode: boolean
    fixedPeriodCost: number
  }
}

export default function ConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ConfigData>({
    knowledgeBases: {
      costBase: 0.10,
      billingCycle: 'usage',
      dedicatedMode: false,
      fixedPeriodCost: 0
    },
    workflows: {
      costBase: 0.05,
      costPerMinute: 0.002,
      billingCycle: 'usage',
      dedicatedMode: false,
      fixedPeriodCost: 0
    }
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      if (response.ok) {
        alert('Configuration saved successfully!')
      } else {
        alert('Failed to save configuration')
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const updateKBConfig = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      knowledgeBases: {
        ...prev.knowledgeBases,
        [field]: value
      }
    }))
  }

  const updateWorkflowConfig = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      workflows: {
        ...prev.workflows,
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-orange-200 dark:bg-orange-800 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 gap-6">
              <Card className="bg-white dark:bg-orange-900/20">
                <CardContent className="p-6">
                  <div className="h-4 bg-orange-200 dark:bg-orange-700 rounded mb-2"></div>
                  <div className="h-8 bg-orange-200 dark:bg-orange-700 rounded"></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Configuration</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configure pricing and billing for Knowledge Bases and Workflows
            </p>
          </div>
          
          <Button 
            onClick={saveConfig} 
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <Tabs defaultValue="knowledge-bases" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="knowledge-bases" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Knowledge Bases
            </TabsTrigger>
            <TabsTrigger value="workflows" className="flex items-center gap-2">
              <Workflow className="w-4 h-4" />
              Workflows
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="knowledge-bases" className="space-y-6">
            <Card className="bg-white dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                  <Database className="w-5 h-5" />
                  Knowledge Bases Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-orange-700 dark:text-orange-300">Cost Base per Operation ($)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={config.knowledgeBases.costBase}
                      onChange={(e) => updateKBConfig('costBase', parseFloat(e.target.value) || 0)}
                      className="border-orange-200 dark:border-orange-800"
                    />
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      Base cost per KB search/query operation
                    </p>
                  </div>

                  <div>
                    <Label className="text-orange-700 dark:text-orange-300">Billing Cycle</Label>
                    <Select 
                      value={config.knowledgeBases.billingCycle}
                      onValueChange={(value) => updateKBConfig('billingCycle', value)}
                    >
                      <SelectTrigger className="border-orange-200 dark:border-orange-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usage">Pay-per-Use</SelectItem>
                        <SelectItem value="monthly">Monthly Fixed</SelectItem>
                        <SelectItem value="quarterly">Quarterly Fixed</SelectItem>
                        <SelectItem value="yearly">Yearly Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/40 rounded-lg">
                  <div>
                    <Label className="text-orange-700 dark:text-orange-300">Dedicated Mode</Label>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Enable dedicated resources with fixed period pricing
                    </p>
                  </div>
                  <Switch
                    checked={config.knowledgeBases.dedicatedMode}
                    onCheckedChange={(checked) => updateKBConfig('dedicatedMode', checked)}
                  />
                </div>

                {config.knowledgeBases.dedicatedMode && (
                  <div>
                    <Label className="text-orange-700 dark:text-orange-300">
                      Fixed Period Cost (${config.knowledgeBases.billingCycle === 'monthly' ? 'Monthly' : 
                                       config.knowledgeBases.billingCycle === 'quarterly' ? 'Quarterly' : 
                                       config.knowledgeBases.billingCycle === 'yearly' ? 'Yearly' : 'Period'})
                    </Label>
                    <Input
                      type="number"
                      step="1.00"
                      value={config.knowledgeBases.fixedPeriodCost}
                      onChange={(e) => updateKBConfig('fixedPeriodCost', parseFloat(e.target.value) || 0)}
                      className="border-orange-200 dark:border-orange-800"
                    />
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      Fixed cost for dedicated KB resources per billing period
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>Why you don't see dedicated/fixed costs:</strong> These settings only apply when 
                      "Dedicated Mode" is enabled and a fixed billing cycle is selected. Most workspaces use 
                      pay-per-use billing by default.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            <Card className="bg-white dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-teal-900 dark:text-teal-100">
                  <Workflow className="w-5 h-5" />
                  Workflows Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-teal-700 dark:text-teal-300">Cost Base per Execution ($)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={config.workflows.costBase}
                      onChange={(e) => updateWorkflowConfig('costBase', parseFloat(e.target.value) || 0)}
                      className="border-teal-200 dark:border-teal-800"
                    />
                    <p className="text-sm text-teal-600 dark:text-teal-400 mt-1">
                      Base cost per workflow execution
                    </p>
                  </div>

                  <div>
                    <Label className="text-teal-700 dark:text-teal-300">Cost per Minute ($)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={config.workflows.costPerMinute}
                      onChange={(e) => updateWorkflowConfig('costPerMinute', parseFloat(e.target.value) || 0)}
                      className="border-teal-200 dark:border-teal-800"
                    />
                    <p className="text-sm text-teal-600 dark:text-teal-400 mt-1">
                      Additional cost per minute of execution
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-teal-700 dark:text-teal-300">Billing Cycle</Label>
                  <Select 
                    value={config.workflows.billingCycle}
                    onValueChange={(value) => updateWorkflowConfig('billingCycle', value)}
                  >
                    <SelectTrigger className="border-teal-200 dark:border-teal-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usage">Pay-per-Use</SelectItem>
                      <SelectItem value="monthly">Monthly Fixed</SelectItem>
                      <SelectItem value="quarterly">Quarterly Fixed</SelectItem>
                      <SelectItem value="yearly">Yearly Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-900/40 rounded-lg">
                  <div>
                    <Label className="text-teal-700 dark:text-teal-300">Dedicated Mode</Label>
                    <p className="text-sm text-teal-600 dark:text-teal-400">
                      Enable dedicated workflow runners with fixed period pricing
                    </p>
                  </div>
                  <Switch
                    checked={config.workflows.dedicatedMode}
                    onCheckedChange={(checked) => updateWorkflowConfig('dedicatedMode', checked)}
                  />
                </div>

                {config.workflows.dedicatedMode && (
                  <div>
                    <Label className="text-teal-700 dark:text-teal-300">
                      Fixed Period Cost (${config.workflows.billingCycle === 'monthly' ? 'Monthly' : 
                                       config.workflows.billingCycle === 'quarterly' ? 'Quarterly' : 
                                       config.workflows.billingCycle === 'yearly' ? 'Yearly' : 'Period'})
                    </Label>
                    <Input
                      type="number"
                      step="1.00"
                      value={config.workflows.fixedPeriodCost}
                      onChange={(e) => updateWorkflowConfig('fixedPeriodCost', parseFloat(e.target.value) || 0)}
                      className="border-teal-200 dark:border-teal-800"
                    />
                    <p className="text-sm text-teal-600 dark:text-teal-400 mt-1">
                      Fixed cost for dedicated workflow runners per billing period
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Fixed Period Pricing:</strong> When dedicated mode is enabled, workflows run on 
                      reserved infrastructure with predictable costs. This is ideal for high-volume workloads 
                      but requires minimum commitments.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
