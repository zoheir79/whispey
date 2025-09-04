"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  builtin_models: {
    url: string
    api_key: string
    cost_per_minute: number
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
  
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    type: 'STT',
    api_url: '',
    api_key: '',
    unit: 'minute',
    cost_per_unit: 0,
    is_active: true
  })

  const [builtinSettings, setBuiltinSettings] = useState({
    url: 'http://localhost:8000',
    api_key: '',
    cost_per_minute: 0.05
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
      const [providersRes, settingsRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/settings/global?key=builtin_models')
      ])

      if (providersRes.ok) {
        const providersData = await providersRes.json()
        setProviders(providersData.providers || [])
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.settings?.value) {
          setGlobalSettings({ builtin_models: settingsData.settings.value })
          setBuiltinSettings(settingsData.settings.value)
        }
      }
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

  const handleBuiltinSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'builtin_models',
          value: builtinSettings,
          description: 'Configuration for built-in AI models including URL, API key and cost per minute'
        })
      })

      if (response.ok) {
        showNotification('Paramètres des modèles intégrés mis à jour avec succès')
        setShowBuiltinDialog(false)
        await fetchData()
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors de la sauvegarde', 'error')
      }
    } catch (error) {
      console.error('Error saving builtin settings:', error)
      showNotification('Erreur de connexion', 'error')
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
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Modèles IA Intégrés</div>
              <div className="text-sm text-gray-500 mt-1">
                URL: {globalSettings?.builtin_models?.url || 'Non configuré'}
              </div>
              <div className="text-sm text-gray-500">
                Coût: ${globalSettings?.builtin_models?.cost_per_minute?.toFixed(4) || '0.0000'}/minute
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowBuiltinDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Configurer
            </Button>
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
            <DialogTitle>Configuration Modèles Intégrés</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBuiltinSettingsSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">URL du serveur</label>
              <Input
                value={builtinSettings.url}
                onChange={(e) => setBuiltinSettings({ ...builtinSettings, url: e.target.value })}
                placeholder="http://localhost:8000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Clé API (optionnel)</label>
              <Input
                type="password"
                value={builtinSettings.api_key}
                onChange={(e) => setBuiltinSettings({ ...builtinSettings, api_key: e.target.value })}
                placeholder="Clé d'authentification interne"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Coût par minute ($)</label>
              <Input
                type="number"
                step="0.0001"
                value={builtinSettings.cost_per_minute}
                onChange={(e) => setBuiltinSettings({ ...builtinSettings, cost_per_minute: parseFloat(e.target.value) || 0 })}
                placeholder="0.05"
                required
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowBuiltinDialog(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Sauvegarder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
