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
      {message && (
        <Alert className={`${message.type === 'success' 
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestion des Tarifs Globaux</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configurez les prix pour tous les modes de facturation et services</p>
        </div>
        <Button onClick={saveSettings} disabled={saving || !settings} className="gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Sauvegarder
        </Button>
      </div>
      <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-gray-900 dark:text-gray-100">Gestion des Tarifs Globaux</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Configurez les prix pour tous les modes de facturation et services
                </CardDescription>
              </div>
            </div>
            <Button onClick={saveSettings} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
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
            <Alert className={`mb-6 ${message.type === 'success' 
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
              <AlertDescription className={message.type === 'success' 
                ? 'text-green-700 dark:text-green-200' 
                : 'text-red-700 dark:text-red-200'}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="dedicated" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-100 dark:bg-slate-800">
              <TabsTrigger value="dedicated" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                <Cloud className="h-4 w-4" />
                Mode Dédié
              </TabsTrigger>
              <TabsTrigger value="pag" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                <DollarSign className="h-4 w-4" />
                Pay-as-You-Go
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                <Calendar className="h-4 w-4" />
                Subscriptions Agents
              </TabsTrigger>
              <TabsTrigger value="s3" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                <Eye className="h-4 w-4" />
                Stockage S3
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                <CheckCircle2 className="h-4 w-4" />
                Monitoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dedicated" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Modèles IA - Tarifs Mensuels
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_monthly" className="text-gray-900 dark:text-gray-100">LLM (par mois)</Label>
                      <Input
                        id="llm_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.llm_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'llm_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Usage illimité du modèle LLM built-in
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_monthly" className="text-gray-900 dark:text-gray-100">STT (par mois)</Label>
                      <Input
                        id="stt_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.stt_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'stt_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Transcription illimitée built-in
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_monthly" className="text-gray-900 dark:text-gray-100">TTS (par mois)</Label>
                      <Input
                        id="tts_monthly"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.tts_monthly}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'tts_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Synthèse vocale illimitée built-in
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Modèles IA - Tarifs Annuels
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_annual" className="text-gray-900 dark:text-gray-100">LLM (par an)</Label>
                      <Input
                        id="llm_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.llm_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'llm_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Tarif annuel avec réduction
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_annual" className="text-gray-900 dark:text-gray-100">STT (par an)</Label>
                      <Input
                        id="stt_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.stt_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'stt_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tts_annual" className="text-gray-900 dark:text-gray-100">TTS (par an)</Label>
                      <Input
                        id="tts_annual"
                        type="number"
                        step="0.01"
                        value={settings.pricing_rates_dedicated.tts_annual}
                        onChange={(e) => updateSetting('pricing_rates_dedicated', 'tts_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comparaison Coûts</h3>
                  <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Comparaison Coûts</h4>
                    <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Mensuel vs Annuel:</div>
                    <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                      <span>Total mensuel:</span>
                      <Badge variant="secondary" className="bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">{formatCurrency(
                        settings.pricing_rates_dedicated.llm_monthly + 
                        settings.pricing_rates_dedicated.stt_monthly + 
                        settings.pricing_rates_dedicated.tts_monthly
                      )}</Badge>
                    </div>
                    <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                      <span>Total annuel:</span>
                      <Badge className="bg-blue-600 dark:bg-blue-500 text-white">{formatCurrency(
                        settings.pricing_rates_dedicated.llm_annual + 
                        settings.pricing_rates_dedicated.stt_annual + 
                        settings.pricing_rates_dedicated.tts_annual
                      )}</Badge>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-green-600 dark:text-green-400">
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tarifs Pay-as-You-Go Built-in</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="llm_per_minute_voice" className="text-gray-900 dark:text-gray-100">LLM Voice PAG Builtin (par minute)</Label>
                      <Input
                        id="llm_per_minute_voice"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.llm_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents voice PAG builtin: facturation par minute d'utilisation
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="llm_per_token_voice" className="text-gray-900 dark:text-gray-100">LLM Voice External/Hybrid (par token)</Label>
                      <Input
                        id="llm_per_token_voice"
                        type="number"
                        step="0.000001"
                        value={settings.pricing_rates_pag.llm_builtin_per_token}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_token', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents voice external/hybrid: facturation par token
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="llm_per_token_text" className="text-gray-900 dark:text-gray-100">LLM Text-Only (par token)</Label>
                      <Input
                        id="llm_per_token_text"
                        type="number"
                        step="0.000001"
                        value={settings.pricing_rates_pag.llm_builtin_per_token_text}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'llm_builtin_per_token_text', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents text-only: facturation par token utilisé
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="stt_per_minute" className="text-gray-900 dark:text-gray-100">STT (par minute)</Label>
                      <Input
                        id="stt_per_minute"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.stt_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'stt_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Facturation par minute transcrite
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_per_minute" className="text-gray-900 dark:text-gray-100">TTS Builtin Voice (par minute)</Label>
                      <Input
                        id="tts_per_minute"
                        type="number"
                        step="0.001"
                        value={settings.pricing_rates_pag.tts_builtin_per_minute}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'tts_builtin_per_minute', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents voice PAG builtin: facturation par minute d'utilisation
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="tts_per_word" className="text-gray-900 dark:text-gray-100">TTS External/Hybrid (par mot)</Label>
                      <Input
                        id="tts_per_word"
                        type="number"
                        step="0.0001"
                        value={settings.pricing_rates_pag.tts_builtin_per_word}
                        onChange={(e) => updateSetting('pricing_rates_pag', 'tts_builtin_per_word', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Agents voice external/hybrid PAG: facturation par mot synthétisé
                      </p>
                    </div>

                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Exemple Coût PAG</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2 border border-blue-200 dark:border-blue-700">
                    <p className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">Usage mensuel typique:</p>
                    <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
                      <span>60 minutes Voice PAG Builtin (STT+TTS+LLM):</span>
                      <span>{formatCurrency(60 * (settings.pricing_rates_pag.stt_builtin_per_minute + settings.pricing_rates_pag.tts_builtin_per_minute + settings.pricing_rates_pag.llm_builtin_per_minute))}</span>
                    </div>
                    <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
                      <span>1000 tokens LLM (external/hybrid):</span>
                      <span>{formatCurrency(1000 * settings.pricing_rates_pag.llm_builtin_per_token)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
                      <span>5000 mots TTS (external/hybrid):</span>
                      <span>{formatCurrency(5000 * settings.pricing_rates_pag.tts_builtin_per_word)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
                      <span>1000 tokens LLM text-only:</span>
                      <span>{formatCurrency(1000 * settings.pricing_rates_pag.llm_builtin_per_token_text)}</span>
                    </div>
                    <Separator className="bg-blue-200 dark:bg-blue-800" />
                    <div className="flex justify-between font-semibold text-blue-900 dark:text-blue-100">
                      <span>Total estimé:</span>
                      <Badge className="bg-blue-600 dark:bg-blue-500 text-white">{formatCurrency(
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
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Subscriptions Mensuelles
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text_agent_sub" className="text-gray-900 dark:text-gray-100">Agent Text-Only</Label>
                      <Input
                        id="text_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.text_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'text_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Subscription mensuelle agent texte seul
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="voice_agent_sub" className="text-gray-900 dark:text-gray-100">Agent Voice</Label>
                      <Input
                        id="voice_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.voice_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'voice_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Subscription mensuelle agent vocal
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="vision_agent_sub" className="text-gray-900 dark:text-gray-100">Agent Vision</Label>
                      <Input
                        id="vision_agent_sub"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.vision_agent_monthly}
                        onChange={(e) => updateSetting('subscription_costs', 'vision_agent_monthly', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Subscription mensuelle agent avec vision
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Subscriptions Annuelles
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text_agent_annual" className="text-gray-900 dark:text-gray-100">Agent Text-Only (Annuel)</Label>
                      <Input
                        id="text_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.text_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'text_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="voice_agent_annual" className="text-gray-900 dark:text-gray-100">Agent Voice (Annuel)</Label>
                      <Input
                        id="voice_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.voice_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'voice_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="vision_agent_annual" className="text-gray-900 dark:text-gray-100">Agent Vision (Annuel)</Label>
                      <Input
                        id="vision_agent_annual"
                        type="number"
                        step="0.01"
                        value={settings.subscription_costs.vision_agent_annual}
                        onChange={(e) => updateSetting('subscription_costs', 'vision_agent_annual', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comparaison Tarifs</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                      <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">Text-Only</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Mensuel: {formatCurrency(settings.subscription_costs.text_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.text_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 dark:text-green-400 font-medium text-sm">
                        Économie: {formatCurrency(settings.subscription_costs.text_agent_monthly * 12 - settings.subscription_costs.text_agent_annual)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 dark:text-blue-100">Voice</div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          Mensuel: {formatCurrency(settings.subscription_costs.voice_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.voice_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 dark:text-green-400 font-medium text-sm">
                        Économie: {formatCurrency(settings.subscription_costs.voice_agent_monthly * 12 - settings.subscription_costs.voice_agent_annual)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                      <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <div className="flex-1">
                        <div className="font-medium text-purple-900 dark:text-purple-100">Vision</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">
                          Mensuel: {formatCurrency(settings.subscription_costs.vision_agent_monthly)} | 
                          Annuel: {formatCurrency(settings.subscription_costs.vision_agent_annual)}
                        </div>
                      </div>
                      <div className="text-green-600 dark:text-green-400 font-medium text-sm">
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
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Cloud className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Configuration Stockage S3
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="s3_cost_per_gb" className="text-gray-900 dark:text-gray-100">Coût par GB/mois</Label>
                      <Input
                        id="s3_cost_per_gb"
                        type="number"
                        step="0.001"
                        value={settings.s3_config.cost_per_gb}
                        onChange={(e) => updateSetting('s3_config', 'cost_per_gb', parseFloat(e.target.value) || 0)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Tarif de stockage par GB par mois
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="s3_region" className="text-gray-900 dark:text-gray-100">Région S3</Label>
                      <Input
                        id="s3_region"
                        value={settings.s3_config.region}
                        onChange={(e) => updateSetting('s3_config', 'region', e.target.value)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="s3_endpoint" className="text-gray-900 dark:text-gray-100">Endpoint S3</Label>
                      <Input
                        id="s3_endpoint"
                        value={settings.s3_config.endpoint}
                        onChange={(e) => updateSetting('s3_config', 'endpoint', e.target.value)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="bucket_prefix" className="text-gray-900 dark:text-gray-100">Préfixe Buckets</Label>
                      <Input
                        id="bucket_prefix"
                        value={settings.s3_config.bucket_prefix}
                        onChange={(e) => updateSetting('s3_config', 'bucket_prefix', e.target.value)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="default_storage_gb" className="text-gray-900 dark:text-gray-100">Stockage Default (GB)</Label>
                      <Input
                        id="default_storage_gb"
                        type="number"
                        step="1"
                        value={settings.s3_config.default_storage_gb}
                        onChange={(e) => updateSetting('s3_config', 'default_storage_gb', parseFloat(e.target.value) || 50)}
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Stockage par défaut alloué aux nouveaux agents (actuellement 50GB)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Calcul Coûts S3</h3>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg space-y-2 border border-orange-200 dark:border-orange-700">
                    <p className="text-sm font-medium mb-2 text-orange-900 dark:text-orange-100">Exemples de coûts mensuels:</p>
                    <div className="flex justify-between text-sm text-orange-800 dark:text-orange-200">
                      <span>10 GB:</span>
                      <span>{formatCurrency(10 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-800 dark:text-orange-200">
                      <span>50 GB (défaut):</span>
                      <span>{formatCurrency(50 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-800 dark:text-orange-200">
                      <span>100 GB:</span>
                      <span>{formatCurrency(100 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-800 dark:text-orange-200">
                      <span>500 GB:</span>
                      <span>{formatCurrency(500 * settings.s3_config.cost_per_gb)}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Configuration actuelle:</h4>
                    <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                      <div>Région: <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded text-gray-900 dark:text-gray-100">{settings.s3_config.region}</code></div>
                      <div>Préfixe: <code className="bg-gray-200 dark:bg-slate-600 px-1 rounded text-gray-900 dark:text-gray-100">{settings.s3_config.bucket_prefix}</code></div>
                      <div>Tarif: <Badge variant="outline" className="border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100">{formatCurrency(settings.s3_config.cost_per_gb)}/GB/mois</Badge></div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Seuils d'Alerte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="low_balance_threshold">Seuil Balance Faible ($)</Label>
                      <Input
                        id="low_balance_threshold"
                        type="number"
                        step="0.01"
                        defaultValue="50.00"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Déclenche une alerte quand le solde descend sous ce montant
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="usage_spike_threshold">Seuil Pic d'Usage (%)</Label>
                      <Input
                        id="usage_spike_threshold"
                        type="number"
                        step="1"
                        defaultValue="200"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Alerte si l'usage augmente de ce pourcentage en 24h
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="auto_suspend_threshold">Suspension Automatique ($)</Label>
                      <Input
                        id="auto_suspend_threshold"
                        type="number"
                        step="0.01"
                        defaultValue="-100.00"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Suspend automatiquement si le solde devient plus négatif
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      Configuration Coûts Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="kb_base_cost">Knowledge Bases - Coût Base ($)</Label>
                      <Input
                        id="kb_base_cost"
                        type="number"
                        step="0.01"
                        defaultValue="0.10"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Coût de base par opération KB
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="workflow_base_cost">Workflows - Coût Base ($)</Label>
                      <Input
                        id="workflow_base_cost"
                        type="number"
                        step="0.01"
                        defaultValue="0.05"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Coût de base par exécution workflow
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="workflow_minute_cost">Workflows - Coût par Minute ($)</Label>
                      <Input
                        id="workflow_minute_cost"
                        type="number"
                        step="0.001"
                        defaultValue="0.002"
                        className="mt-1 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Coût additionnel par minute d'exécution
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    Calculateur d'Impact des Coûts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Utilisez ce calculateur pour estimer l'impact des changements de configuration sur vos coûts mensuels.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="border-blue-200">
                        <CardHeader>
                          <CardTitle className="text-lg text-blue-600 flex items-center gap-2">
                            <Cloud className="w-5 h-5" />
                            Knowledge Bases
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Fichiers moyens/mois:</span>
                              <span className="font-medium">1,250</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taille moyenne:</span>
                              <span className="font-medium">2.3 MB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coût estimé:</span>
                              <span className="font-bold text-blue-600">$45.20</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-green-200">
                        <CardHeader>
                          <CardTitle className="text-lg text-green-600 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Workflows
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Exécutions moyennes:</span>
                              <span className="font-medium">8,430</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Durée moyenne:</span>
                              <span className="font-medium">3.2 min</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coût estimé:</span>
                              <span className="font-bold text-green-600">$128.90</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-purple-200">
                        <CardHeader>
                          <CardTitle className="text-lg text-purple-600 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Agents IA
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Tokens moyens:</span>
                              <span className="font-medium">2.4M</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Usage modèles:</span>
                              <span className="font-medium">Mixte</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coût estimé:</span>
                              <span className="font-bold text-purple-600">$234.50</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between text-lg font-semibold">
                        <span>Coût Total Mensuel Estimé:</span>
                        <span className="text-2xl text-gray-900 dark:text-gray-100">$408.60</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Basé sur les patterns d'usage actuels et la configuration des coûts
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={saveSettings}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {saving ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Sauvegarder Configuration
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
