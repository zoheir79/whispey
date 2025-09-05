'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  DollarSign, 
  Cloud, 
  Mic, 
  MessageSquare, 
  Eye,
  Save, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from 'lucide-react'

interface PricingSettings {
  pricing_rates_dedicated: {
    llm_monthly: number
    llm_annual: number
    stt_monthly: number
    stt_annual: number
    tts_monthly: number
    tts_annual: number
    text_agent_monthly: number
    text_agent_annual: number
    voice_agent_monthly: number
    voice_agent_annual: number
    vision_agent_monthly: number
    vision_agent_annual: number
    s3_storage_per_gb_monthly: number
  }
  pricing_rates_pag: {
    llm_builtin_per_token: number
    llm_builtin_per_token_text: number
    llm_builtin_per_minute: number
    stt_builtin_per_minute: number
    tts_builtin_per_word: number
    tts_builtin_per_minute: number
    s3_storage_per_gb_monthly: number
  }
  s3_config: {
    region: string
    endpoint: string
    access_key: string
    secret_key: string
    cost_per_gb: number
    bucket_prefix: string
    default_storage_gb: number
  }
  subscription_costs: {
    text_agent_monthly: number
    text_agent_annual: number
    voice_agent_monthly: number
    voice_agent_annual: number
    vision_agent_monthly: number
    vision_agent_annual: number
  }
}

export default function PricingManagement() {
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load settings
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/global')
      if (!response.ok) throw new Error('Failed to fetch settings')
      
      const data = await response.json()
      const settingsMap: any = {}
      
      if (Array.isArray(data.settings)) {
        data.settings.forEach((setting: any) => {
          try {
            settingsMap[setting.key] = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
          } catch (e) {
            console.warn(`Failed to parse setting ${setting.key}:`, setting.value)
            settingsMap[setting.key] = setting.value
          }
        })
      }

      // Set defaults if not found
      const defaultSettings: PricingSettings = {
        pricing_rates_dedicated: settingsMap.pricing_rates_dedicated || {
          llm_monthly: 25.00,
          llm_annual: 250.00,
          stt_monthly: 15.00,
          stt_annual: 150.00,
          tts_monthly: 12.00,
          tts_annual: 120.00,
          text_agent_monthly: 19.99,
          text_agent_annual: 199.90,
          voice_agent_monthly: 29.99,
          voice_agent_annual: 299.90,
          vision_agent_monthly: 39.99,
          vision_agent_annual: 399.90,
          s3_storage_per_gb_monthly: 0.10
        },
        pricing_rates_pag: settingsMap.pricing_rates_pag || {
          llm_builtin_per_token: 0.000015,
          llm_builtin_per_token_text: 0.000010,
          llm_builtin_per_minute: 0.002,
          stt_builtin_per_minute: 0.005,
          tts_builtin_per_word: 0.002,
          tts_builtin_per_minute: 0.003,
          s3_storage_per_gb_monthly: 0.10
        },
        s3_config: settingsMap.s3_config || {
          region: 'us-east-1',
          endpoint: 'https://s3.example.com',
          access_key: '',
          secret_key: '',
          cost_per_gb: 0.023,
          bucket_prefix: 'whispey-agent-',
          default_storage_gb: 50
        },
        subscription_costs: settingsMap.subscription_costs || {
          text_agent_monthly: 19.99,
          text_agent_annual: 199.90,
          voice_agent_monthly: 29.99,
          voice_agent_annual: 299.90,
          vision_agent_monthly: 39.99,
          vision_agent_annual: 399.90
        }
      }

      setSettings(defaultSettings)
    } catch (error) {
      console.error('Error fetching settings:', error)
      setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres' })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      
      // Save each setting category
      const settingsToSave = [
        { key: 'pricing_rates_dedicated', value: settings.pricing_rates_dedicated, description: 'Monthly rates for dedicated models and subscriptions' },
        { key: 'pricing_rates_pag', value: settings.pricing_rates_pag, description: 'Pay-as-you-go rates for built-in models' },
        { key: 's3_config', value: settings.s3_config, description: 'Configuration stockage S3 compatible (Ceph RGW) avec coût par Go' },
        { key: 'subscription_costs', value: settings.subscription_costs, description: 'Monthly subscription costs for dedicated agent types' }
      ]

      for (const setting of settingsToSave) {
        const response = await fetch('/api/settings/global', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setting)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to save setting')
        }
      }

      setMessage({ type: 'success', text: 'Paramètres de tarification sauvegardés avec succès !' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (category: keyof PricingSettings, key: string, value: any) => {
    if (!settings) return
    
    setSettings(prev => ({
      ...prev!,
      [category]: {
        ...prev![category],
        [key]: value
      }
    }))
  }

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '$0.0000'
    }
    return `$${value.toFixed(4)}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <CardTitle>Chargement des tarifs...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-green-600" />
              <div>
                <CardTitle>Gestion des Tarifs Globaux</CardTitle>
                <CardDescription>
                  Configurez les prix pour tous les modes de facturation et services
                </CardDescription>
              </div>
            </div>
            <Button onClick={saveSettings} disabled={saving} className="gap-2">
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Sauvegarder
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {message && (
            <Alert className={`mb-6 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="dedicated" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dedicated">Mode Dédié</TabsTrigger>
              <TabsTrigger value="pag">Pay-as-You-Go</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions Agents</TabsTrigger>
              <TabsTrigger value="s3">Stockage S3</TabsTrigger>
            </TabsList>

            <TabsContent value="dedicated" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Mic className="h-5 w-5 text-blue-600" />
                    Modèles IA - Tarifs Mensuels
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_monthly">LLM (par mois)</Label>
                      <Input
                        id="llm_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.llm_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'llm_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Usage illimité du modèle LLM built-in
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_monthly">STT (par mois)</Label>
                      <Input
                        id="stt_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.stt_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'stt_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Transcription illimitée built-in
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_monthly">TTS (par mois)</Label>
                      <Input
                        id="tts_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.tts_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'tts_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Synthèse vocale illimitée built-in
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Modèles IA - Tarifs Annuels
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_annual">LLM (par an)</Label>
                      <Input
                        id="llm_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.llm_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'llm_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Tarif annuel avec réduction
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_annual">STT (par an)</Label>
                      <Input
                        id="stt_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.stt_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'stt_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tts_annual">TTS (par an)</Label>
                      <Input
                        id="tts_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.tts_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'tts_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comparaison Coûts</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                    <div className="text-sm font-medium mb-2">Mensuel vs Annuel:</div>
                    <div className="flex justify-between text-sm">
                      <span>Total mensuel:</span>
                      <Badge variant="secondary">{formatCurrency(
                        settings.pricing_rates_dedicated.llm_monthly + 
                        settings.pricing_rates_dedicated.stt_monthly + 
                        settings.pricing_rates_dedicated.tts_monthly
                      )}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total annuel:</span>
                      <Badge>{formatCurrency(
                        settings.pricing_rates_dedicated.llm_annual + 
                        settings.pricing_rates_dedicated.stt_annual + 
                        settings.pricing_rates_dedicated.tts_annual
                      )}</Badge>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-green-600">
                      <span>Économie annuelle:</span>
                      <span>{formatCurrency(
                        (settings.pricing_rates_dedicated.llm_monthly + 
                         settings.pricing_rates_dedicated.stt_monthly + 
                         settings.pricing_rates_dedicated.tts_monthly) * 12 -
                        (settings.pricing_rates_dedicated.llm_annual + 
                         settings.pricing_rates_dedicated.stt_annual + 
                         settings.pricing_rates_dedicated.tts_annual)
                      )}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pag" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Tarifs Pay-as-You-Go Built-in</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_per_minute_voice">LLM Voice PAG Builtin (par minute)</Label>
                      <Input
                        id="llm_per_minute_voice"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.llm_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Agents voice PAG builtin: facturation par minute d'utilisation
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="llm_per_token_voice">LLM Voice External/Hybrid (par token)</Label>
                      <Input
                        id="llm_per_token_voice"
                        type="number"
                        step="0.000001"
                        value={settings.pricing_rates_pag.llm_builtin_per_token}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_token', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Agents voice external/hybrid: facturation par token
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="llm_per_token_text">LLM Text-Only (par token)</Label>
                      <Input
                        id="llm_per_token_text"
                        type="number"
                        step="0.000001"
                        value={settings.pricing_rates_pag.llm_builtin_per_token_text}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_token_text', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Agents text-only: facturation par token utilisé
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_per_minute">STT (par minute)</Label>
                      <Input
                        id="stt_per_minute"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.stt_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'stt_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Facturation par minute transcrite
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_per_minute">TTS Builtin Voice (par minute)</Label>
                      <Input
                        id="tts_per_minute"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.tts_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'tts_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Agents voice PAG builtin: facturation par minute d'utilisation
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_per_word">TTS External/Hybrid (par mot)</Label>
                      <Input
                        id="tts_per_word"
                        type="number"
                        step="0.0001"
                        value={settings.pricing_rates_pag.tts_builtin_per_word}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'tts_builtin_per_word', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Agents voice external/hybrid PAG: facturation par mot synthétisé
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Exemple Coût PAG</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium mb-2">Usage mensuel typique:</p>
                    <div className="flex justify-between text-sm">
                      <span>60 minutes Voice PAG Builtin (STT+TTS+LLM):</span>
                      <span>{formatCurrency(60 * (settings.pricing_rates_pag.stt_builtin_per_minute + settings.pricing_rates_pag.tts_builtin_per_minute + settings.pricing_rates_pag.llm_builtin_per_minute))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>1000 tokens LLM (external/hybrid):</span>
                      <span>{formatCurrency(1000 * settings.pricing_rates_pag.llm_builtin_per_token)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>5000 mots TTS (external/hybrid):</span>
                      <span>{formatCurrency(5000 * settings.pricing_rates_pag.tts_builtin_per_word)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>1000 tokens LLM text-only:</span>
                      <span>{formatCurrency(1000 * settings.pricing_rates_pag.llm_builtin_per_token_text)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total estimé:</span>
                      <Badge>{formatCurrency(
                        1000 * settings.pricing_rates_pag.llm_builtin_per_token +
                        60 * settings.pricing_rates_pag.stt_builtin_per_minute +
                        5000 * settings.pricing_rates_pag.tts_builtin_per_word
                      )}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    Subscriptions Mensuelles
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text_agent_sub">Agent Text-Only</Label>
                      <Input
                        id="text_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.text_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'text_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Subscription mensuelle agent texte seul
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="voice_agent_sub">Agent Voice</Label>
                      <Input
                        id="voice_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.voice_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'voice_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Subscription mensuelle agent vocal
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="vision_agent_sub">Agent Vision</Label>
                      <Input
                        id="vision_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.vision_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'vision_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Subscription mensuelle agent avec vision
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    Subscriptions Annuelles
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text_agent_annual">Agent Text-Only (Annuel)</Label>
                      <Input
                        id="text_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.text_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'text_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="voice_agent_annual">Agent Voice (Annuel)</Label>
                      <Input
                        id="voice_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.voice_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'voice_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="vision_agent_annual">Agent Vision (Annuel)</Label>
                      <Input
                        id="vision_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.vision_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'vision_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comparaison Tarifs</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-gray-600" />
                      <div className="flex-1">
                        <div className="font-medium">Text-Only</div>
                        <div className="text-sm text-gray-500">
                          Mensuel: {formatCurrency(settings.subscription_costs.text_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.text_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 font-medium text-sm">
                        Économie: {formatCurrency(settings.subscription_costs.text_agent_monthly * 12 - settings.subscription_costs.text_agent_annual)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Mic className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium">Voice</div>
                        <div className="text-sm text-gray-500">
                          Mensuel: {formatCurrency(settings.subscription_costs.voice_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.voice_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 font-medium text-sm">
                        Économie: {formatCurrency(settings.subscription_costs.voice_agent_monthly * 12 - settings.subscription_costs.voice_agent_annual)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <Eye className="h-5 w-5 text-purple-600" />
                      <div className="flex-1">
                        <div className="font-medium">Vision</div>
                        <div className="text-sm text-gray-500">
                          Mensuel: {formatCurrency(settings.subscription_costs.vision_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.vision_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 font-medium text-sm">
                        Économie: {formatCurrency(settings.subscription_costs.vision_agent_monthly * 12 - settings.subscription_costs.vision_agent_annual)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="s3" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-orange-600" />
                    Configuration Stockage S3
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="s3_cost_per_gb">Coût par GB/mois</Label>
                      <Input
                        id="s3_cost_per_gb"
                        type="number"
                        step="0.001"
                        value={settings.s3_config.cost_per_gb}
                        onChange={(e) => updateSetting('s3_config', 'cost_per_gb', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Tarif de stockage par GB par mois
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="s3_region">Région S3</Label>
                      <Input
                        id="s3_region"
                        value={settings.s3_config.region}
                        onChange={(e) => updateSetting('s3_config', 'region', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="s3_endpoint">Endpoint S3</Label>
                      <Input
                        id="s3_endpoint"
                        value={settings.s3_config.endpoint}
                        onChange={(e) => updateSetting('s3_config', 'endpoint', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="bucket_prefix">Préfixe Buckets</Label>
                      <Input
                        id="bucket_prefix"
                        value={settings.s3_config.bucket_prefix}
                        onChange={(e) => updateSetting('s3_config', 'bucket_prefix', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="default_storage_gb">Stockage Default (GB)</Label>
                      <Input
                        id="default_storage_gb"
                        type="number"
                        step="1"
                        value={settings.s3_config.default_storage_gb}
                        onChange={(e) => updateSetting('s3_config', 'default_storage_gb', parseFloat(e.target.value) || 50)}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Stockage par défaut alloué aux nouveaux agents (actuellement 50GB)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Calcul Coûts S3</h3>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium mb-2">Exemples de coûts mensuels:</p>
                    <div className="flex justify-between text-sm">
                      <span>10 GB:</span>
                      <span>{formatCurrency(10 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>50 GB (défaut):</span>
                      <span>{formatCurrency(50 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>100 GB:</span>
                      <span>{formatCurrency(100 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>500 GB:</span>
                      <span>{formatCurrency(500 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Configuration actuelle:</h4>
                    <div className="text-sm space-y-1">
                      <div>Région: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{settings.s3_config.region}</code></div>
                      <div>Préfixe: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{settings.s3_config.bucket_prefix}</code></div>
                      <div>Tarif: <Badge variant="outline">{formatCurrency(settings.s3_config.cost_per_gb)}/GB/mois</Badge></div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
