// src/components/admin/AIProvidersManagementSimple.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Settings, Plus, Edit, Trash2, Database, Cloud } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'

interface Provider {
  id: number
  name: string
  type: 'STT' | 'TTS' | 'LLM'
  api_url: string
  unit: string
  cost_per_unit: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AIProvidersManagementSimple() {
  const { providers, globalSettings, loading, error, refetch } = useProviders()
  const [activeTab, setActiveTab] = useState<'providers' | 'builtin' | 's3'>('providers')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gestion des Fournisseurs IA
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <p>Chargement...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Settings className="h-5 w-5" />
            Erreur
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <p className="text-red-600">{error}</p>
          <Button onClick={refetch} className="mt-4">
            Réessayer
          </Button>
        </div>
      </Card>
    )
  }

  const renderProvidersTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Fournisseurs Externes</h3>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Ajouter Fournisseur
        </Button>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{provider.name}</h4>
                    <Badge variant={provider.is_active ? 'default' : 'secondary'}>
                      {provider.type}
                    </Badge>
                    <Badge variant={provider.is_active ? 'success' : 'destructive'}>
                      {provider.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {provider.cost_per_unit}€ par {provider.unit}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderBuiltinTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Modèles Built-in</h3>
      
      {/* STT Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Speech-to-Text (STT)</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>URL API</Label>
              <Input 
                value={globalSettings?.builtin_stt?.url || ''}
                placeholder="http://localhost:8000/stt"
                readOnly
              />
            </div>
            <div>
              <Label>Coût PAG (€/minute)</Label>
              <Input 
                type="number"
                value={globalSettings?.builtin_stt?.cost_per_minute || 0}
                readOnly
              />
            </div>
          </div>
          <div>
            <Label>Coût Dédié (€/mois)</Label>
            <Input 
              type="number"
              value={globalSettings?.builtin_stt?.cost_dedicated_monthly || 0}
              readOnly
            />
          </div>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Modifier STT
          </Button>
        </div>
      </Card>

      {/* TTS Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Text-to-Speech (TTS)</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>URL API</Label>
              <Input 
                value={globalSettings?.builtin_tts?.url || ''}
                placeholder="http://localhost:8000/tts"
                readOnly
              />
            </div>
            <div>
              <Label>Coût PAG (€/mot)</Label>
              <Input 
                type="number"
                value={globalSettings?.builtin_tts?.cost_per_word || 0}
                readOnly
              />
            </div>
          </div>
          <div>
            <Label>Coût Dédié (€/mois)</Label>
            <Input 
              type="number"
              value={globalSettings?.builtin_tts?.cost_dedicated_monthly || 0}
              readOnly
            />
          </div>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Modifier TTS
          </Button>
        </div>
      </Card>

      {/* LLM Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Large Language Model (LLM)</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>URL API</Label>
              <Input 
                value={globalSettings?.builtin_llm?.url || ''}
                placeholder="http://localhost:8000/llm"
                readOnly
              />
            </div>
            <div>
              <Label>Coût PAG (€/token)</Label>
              <Input 
                type="number"
                value={globalSettings?.builtin_llm?.cost_per_token || 0}
                readOnly
              />
            </div>
          </div>
          <div>
            <Label>Coût Dédié (€/mois)</Label>
            <Input 
              type="number"
              value={globalSettings?.builtin_llm?.cost_dedicated_monthly || 0}
              readOnly
            />
          </div>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Modifier LLM
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderS3Tab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Configuration Stockage S3</h3>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Stockage S3 Compatible (Ceph RGW)
          </CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Endpoint S3</Label>
              <Input 
                value={globalSettings?.s3_config?.endpoint || ''}
                placeholder="https://s3.example.com"
                readOnly
              />
            </div>
            <div>
              <Label>Région</Label>
              <Input 
                value={globalSettings?.s3_config?.region || ''}
                placeholder="us-east-1"
                readOnly
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Préfixe Bucket</Label>
              <Input 
                value={globalSettings?.s3_config?.bucket_prefix || ''}
                placeholder="whispey-agent-"
                readOnly
              />
            </div>
            <div>
              <Label>Coût par Go (€/mois)</Label>
              <Input 
                type="number"
                value={globalSettings?.s3_config?.cost_per_gb || 0}
                readOnly
              />
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">Coûts Subscription Agents</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agent Voice (€/minute)</Label>
                <Input 
                  type="number"
                  value={globalSettings?.agent_subscription_costs?.voice_per_minute || 0}
                  readOnly
                />
              </div>
              <div>
                <Label>Agent Text-Only (€/mois)</Label>
                <Input 
                  type="number"
                  value={globalSettings?.agent_subscription_costs?.textonly_per_month || 0}
                  readOnly
                />
              </div>
            </div>
          </div>

          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Modifier Configuration S3
          </Button>
        </div>
      </Card>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Gestion des Fournisseurs IA
        </CardTitle>
      </CardHeader>
      
      <div className="p-6">
        {/* Tabs */}
        <div className="flex space-x-1 mb-6 border-b">
          <Button
            variant={activeTab === 'providers' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('providers')}
            className="rounded-b-none"
          >
            <Database className="h-4 w-4 mr-2" />
            Fournisseurs Externes
          </Button>
          <Button
            variant={activeTab === 'builtin' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('builtin')}
            className="rounded-b-none"
          >
            <Settings className="h-4 w-4 mr-2" />
            Modèles Built-in
          </Button>
          <Button
            variant={activeTab === 's3' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('s3')}
            className="rounded-b-none"
          >
            <Cloud className="h-4 w-4 mr-2" />
            Configuration S3
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'providers' && renderProvidersTab()}
        {activeTab === 'builtin' && renderBuiltinTab()}
        {activeTab === 's3' && renderS3Tab()}
      </div>
    </Card>
  )
}
