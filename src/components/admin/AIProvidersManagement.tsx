"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Cpu, 
  Plus, 
  Edit, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Server,
  X,
  Globe
} from 'lucide-react'

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

interface GlobalSettings {
  builtin_stt: {
    url: string
    api_key: string
    cost_per_minute: number
    cost_dedicated_monthly: number
  }
  builtin_tts: {
    url: string
    api_key: string
    cost_per_word: number
    cost_dedicated_monthly: number
  }
  builtin_llm: {
    url: string
    api_key: string
    cost_per_token: number
    cost_dedicated_monthly: number
  }
  s3_config: {
    endpoint: string
    access_key: string
    secret_key: string
    region: string
    bucket_prefix: string
    cost_per_gb: number
  }
  agent_subscription_costs: {
    voice_per_minute: number
    textonly_per_month: number
  }
}

interface ProviderFormData {
  id?: number
  name: string
  type: 'STT' | 'TTS' | 'LLM'
  api_url: string
  api_key: string
  unit: string
  cost_per_unit: number
  is_active: boolean
}

interface NotificationState {
  show: boolean
  message: string
  type: 'success' | 'error'
}

const PROVIDER_TYPES = [
  { value: 'STT', label: 'Speech-to-Text' },
  { value: 'TTS', label: 'Text-to-Speech' },
  { value: 'LLM', label: 'Large Language Model' }
]

const UNITS_BY_TYPE = {
  STT: ['minute', 'second'],
  TTS: ['word', 'character'],
  LLM: ['token', 'word']
}

export default function AIProvidersManagement() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [showBuiltinDialog, setShowBuiltinDialog] = useState(false)
  const [builtinEditType, setBuiltinEditType] = useState<'voice' | 'text'>('voice')
  
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    type: 'STT',
    api_url: '',
    api_key: '',
    unit: 'minute',
    cost_per_unit: 0,
    is_active: true
  })

  const [builtinSttSettings, setBuiltinSttSettings] = useState({
    url: 'http://localhost:8000/stt',
    api_key: '',
    cost_per_minute: 0.02,
    cost_dedicated_monthly: 50.00
  })

  const [builtinTtsSettings, setBuiltinTtsSettings] = useState({
    url: 'http://localhost:8000/tts',
    api_key: '',
    cost_per_word: 0.0001,
    cost_dedicated_monthly: 30.00
  })

  const [builtinLlmSettings, setBuiltinLlmSettings] = useState({
    url: 'http://localhost:8000/llm',
    api_key: '',
    cost_per_token: 0.00005,
    cost_dedicated_monthly: 100.00
  })

  const [s3Settings, setS3Settings] = useState({
    endpoint: 'https://s3.example.com',
    access_key: '',
    secret_key: '',
    region: 'us-east-1',
    bucket_prefix: 'whispey-agent-',
    cost_per_gb: 0.023
  })

  const [subscriptionSettings, setSubscriptionSettings] = useState({
    voice_per_minute: 0.10,
    textonly_per_month: 25.00
  })

  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: '',
    type: 'success'
  })

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ show: true, message, type })
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [providersRes, sttRes, ttsRes, llmRes, s3Res, subscriptionRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/settings/global?key=builtin_stt'),
        fetch('/api/settings/global?key=builtin_tts'),
        fetch('/api/settings/global?key=builtin_llm'),
        fetch('/api/settings/global?key=s3_config'),
        fetch('/api/settings/global?key=agent_subscription_costs')
      ])

      if (providersRes.ok) {
        const providersData = await providersRes.json()
        setProviders(providersData.providers || [])
      }

      const settings: GlobalSettings = {
        builtin_stt: {
          url: 'http://localhost:8000/stt',
          api_key: '',
          cost_per_minute: 0.02,
          cost_dedicated_monthly: 50.00
        },
        builtin_tts: {
          url: 'http://localhost:8000/tts',
          api_key: '',
          cost_per_word: 0.0001,
          cost_dedicated_monthly: 30.00
        },
        builtin_llm: {
          url: 'http://localhost:8000/llm',
          api_key: '',
          cost_per_token: 0.00005,
          cost_dedicated_monthly: 100.00
        },
        s3_config: {
          endpoint: 'https://s3.example.com',
          access_key: '',
          secret_key: '',
          region: 'us-east-1',
          bucket_prefix: 'whispey-agent-',
          cost_per_gb: 0.023
        },
        agent_subscription_costs: {
          voice_per_minute: 0.10,
          textonly_per_month: 25.00
        }
      }

      if (sttRes.ok) {
        const sttData = await sttRes.json()
        if (sttData.settings?.value) {
          settings.builtin_stt = sttData.settings.value
          setBuiltinSttSettings(sttData.settings.value)
        }
      }

      if (ttsRes.ok) {
        const ttsData = await ttsRes.json()
        if (ttsData.settings?.value) {
          settings.builtin_tts = ttsData.settings.value
          setBuiltinTtsSettings(ttsData.settings.value)
        }
      }

      if (llmRes.ok) {
        const llmData = await llmRes.json()
        if (llmData.settings?.value) {
          settings.builtin_llm = llmData.settings.value
          setBuiltinLlmSettings(llmData.settings.value)
        }
      }

      if (s3Res.ok) {
        const s3Data = await s3Res.json()
        if (s3Data.settings?.value) {
          settings.s3_config = s3Data.settings.value
          setS3Settings(s3Data.settings.value)
        }
      }

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json()
        if (subscriptionData.settings?.value) {
          settings.agent_subscription_costs = subscriptionData.settings.value
          setSubscriptionSettings(subscriptionData.settings.value)
        }
      }

      setGlobalSettings(settings)
    } catch (error) {
      console.error('Error fetching data:', error)
      showNotification('Erreur lors du chargement des données', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProvider = () => {
    setEditingProvider(null)
    setFormData({
      name: '',
      type: 'STT',
      api_url: '',
      api_key: '',
      unit: 'minute',
      cost_per_unit: 0,
      is_active: true
    })
    setShowDialog(true)
  }

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider)
    setFormData({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      api_url: provider.api_url,
      api_key: '', // Don't populate API key for security
      unit: provider.unit,
      cost_per_unit: provider.cost_per_unit,
      is_active: provider.is_active
    })
    setShowDialog(true)
  }

  const handleSubmitProvider = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingProvider ? `/api/providers/${editingProvider.id}` : '/api/providers'
      const method = editingProvider ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        showNotification(
          editingProvider ? 'Fournisseur mis à jour avec succès' : 'Fournisseur créé avec succès'
        )
        setShowDialog(false)
        await fetchData()
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors de la sauvegarde', 'error')
      }
    } catch (error) {
      console.error('Error saving provider:', error)
      showNotification('Erreur de connexion', 'error')
    }
  }

  const handleDeleteProvider = async (providerId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      return
    }

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showNotification('Fournisseur supprimé avec succès')
        await fetchData()
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors de la suppression', 'error')
      }
    } catch (error) {
      console.error('Error deleting provider:', error)
      showNotification('Erreur de connexion', 'error')
    }
  }

  const saveBuiltinSettings = async () => {
    try {
      const savePromises = []
      
      if (builtinEditType === 'stt') {
        savePromises.push(saveSettings('builtin_stt', builtinSttSettings, 'Configuration du modèle STT built-in'))
      } else if (builtinEditType === 'tts') {
        savePromises.push(saveSettings('builtin_tts', builtinTtsSettings, 'Configuration du modèle TTS built-in'))
      } else if (builtinEditType === 'llm') {
        savePromises.push(saveSettings('builtin_llm', builtinLlmSettings, 'Configuration du modèle LLM built-in'))
      }

      await Promise.all(savePromises)

      // Update global settings
      if (globalSettings) {
        if (globalSettings.builtin_stt) {
          setBuiltinSttSettings(globalSettings.builtin_stt)
        }

        if (globalSettings.builtin_tts) {
          setBuiltinTtsSettings(globalSettings.builtin_tts)
        }

        if (globalSettings.builtin_llm) {
          setBuiltinLlmSettings(globalSettings.builtin_llm)
        }

        if (globalSettings.s3_config) {
          setS3Settings(globalSettings.s3_config)
        }

        if (globalSettings.agent_subscription_costs) {
          setSubscriptionSettings(globalSettings.agent_subscription_costs)
        }
      }

      setShowBuiltinDialog(false)
      showNotification(`Configuration built-in ${builtinEditType === 'voice' ? 'voice' : 'text-only'} sauvegardée avec succès`)
    } catch (error) {
      console.error('Error saving builtin settings:', error)
      showNotification('Erreur lors de la sauvegarde', 'error')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cpu className="h-5 w-5" />
            <span>AI Providers Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Notification */}
      {notification.show && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="mb-6">
          {notification.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <div className="flex items-center justify-between w-full">
            <AlertDescription>{notification.message}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotification({ show: false, message: '', type: 'success' })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      {/* Built-in Models Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Built-in Models Configuration</span>
          </CardTitle>
          <CardDescription>
            Configurez les paramètres des modèles IA intégrés hébergés sur vos serveurs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Voice Agents Built-in */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Agents Voice (Built-in)</div>
                <div className="text-sm text-gray-500 mt-1">
                  URL: {globalSettings?.builtin_voice?.url || 'Non configuré'}
                </div>
                <div className="text-sm text-gray-500">
                  Coût: ${globalSettings?.builtin_voice?.cost_per_minute?.toFixed(4) || '0.0000'}/minute
                </div>
              </div>
              <Button variant="outline" onClick={() => {
                setBuiltinEditType('voice')
                setShowBuiltinDialog(true)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Configurer
              </Button>
            </div>
            
            {/* Text-only Agents Built-in */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Agents Text-only (Built-in)</div>
                <div className="text-sm text-gray-500 mt-1">
                  URL: {globalSettings?.builtin_text?.url || 'Non configuré'}
                </div>
                <div className="text-sm text-gray-500">
                  Coût: ${globalSettings?.builtin_text?.cost_per_token?.toFixed(6) || '0.000000'}/token
                </div>
              </div>
              <Button variant="outline" onClick={() => {
                setBuiltinEditType('text')
                setShowBuiltinDialog(true)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Configurer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* External Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>External AI Providers</span>
            </div>
            <Button onClick={handleCreateProvider}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter Fournisseur
            </Button>
          </CardTitle>
          <CardDescription>
            Gérez les fournisseurs IA externes (OpenAI, Google, ElevenLabs, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aucun fournisseur externe configuré. Ajoutez votre premier fournisseur pour commencer.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead>Coût/Unité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{provider.type}</Badge>
                    </TableCell>
                    <TableCell>{provider.unit}</TableCell>
                    <TableCell>${provider.cost_per_unit.toFixed(6)}</TableCell>
                    <TableCell>
                      <Badge variant={provider.is_active ? 'default' : 'secondary'}>
                        {provider.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProvider(provider)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProvider(provider.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Provider Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Modifier Fournisseur' : 'Ajouter Fournisseur'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitProvider} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="OpenAI Whisper"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <Select 
                value={formData.type} 
                onValueChange={(value: 'STT' | 'TTS' | 'LLM') => 
                  setFormData({ 
                    ...formData, 
                    type: value, 
                    unit: UNITS_BY_TYPE[value][0] 
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL API</label>
              <Input
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://api.openai.com/v1/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Clé API {editingProvider && '(laisser vide pour ne pas modifier)'}
              </label>
              <Input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Unité</label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_BY_TYPE[formData.type].map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Coût/Unité ($)</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formData.cost_per_unit}
                  onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                  placeholder="0.000015"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Fournisseur actif
              </label>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                {editingProvider ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Built-in Settings Dialog */}
      <Dialog open={showBuiltinDialog} onOpenChange={setShowBuiltinDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration Built-in - {builtinEditType === 'voice' ? 'Voice Agents' : 'Text-only Agents'}</DialogTitle>
            <DialogDescription>
              Configurez les paramètres pour les modèles IA {builtinEditType === 'voice' ? 'voice' : 'text-only'} intégrés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">URL du serveur</label>
              <Input
                value={builtinEditType === 'voice' ? builtinVoiceSettings.url : builtinTextSettings.url}
                onChange={(e) => {
                  if (builtinEditType === 'voice') {
                    setBuiltinVoiceSettings({ ...builtinVoiceSettings, url: e.target.value })
                  } else {
                    setBuiltinTextSettings({ ...builtinTextSettings, url: e.target.value })
                  }
                }}
                placeholder="http://localhost:8000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Clé API (optionnel)</label>
              <Input
                type="password"
                value={builtinEditType === 'voice' ? builtinVoiceSettings.api_key : builtinTextSettings.api_key}
                onChange={(e) => {
                  if (builtinEditType === 'voice') {
                    setBuiltinVoiceSettings({ ...builtinVoiceSettings, api_key: e.target.value })
                  } else {
                    setBuiltinTextSettings({ ...builtinTextSettings, api_key: e.target.value })
                  }
                }}
                placeholder="Clé d'authentification interne"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {builtinEditType === 'voice' ? 'Coût par minute ($)' : 'Coût par token ($)'}
              </label>
              <Input
                type="number"
                step={builtinEditType === 'voice' ? "0.0001" : "0.000001"}
                value={builtinEditType === 'voice' ? builtinVoiceSettings.cost_per_minute : builtinTextSettings.cost_per_token}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0
                  if (builtinEditType === 'voice') {
                    setBuiltinVoiceSettings({ ...builtinVoiceSettings, cost_per_minute: value })
                  } else {
                    setBuiltinTextSettings({ ...builtinTextSettings, cost_per_token: value })
                  }
                }}
                placeholder={builtinEditType === 'voice' ? "0.05" : "0.00005"}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBuiltinDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveBuiltinSettings}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
