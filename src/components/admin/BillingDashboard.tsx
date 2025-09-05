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
  Receipt, 
  Plus, 
  Eye, 
  Download, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  DollarSign,
  Calendar,
  TrendingUp,
  X
} from 'lucide-react'

interface BillingInvoice {
  id: string
  period_start: string
  period_end: string
  billing_cycle: 'monthly' | 'annual'
  total_amount: number
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  currency: string
  created_at: string
  updated_at: string
}

interface BillingItem {
  agent_id: string
  agent_name: string
  platform_mode: 'dedicated' | 'pag' | 'hybrid'
  billing_cycle: 'monthly' | 'annual'
  
  total_calls: number
  total_minutes: number
  total_stt_minutes: number
  total_tts_words: number
  total_llm_tokens: number
  
  stt_cost: number
  tts_cost: number
  llm_cost: number
  agent_cost: number
  s3_cost: number
  total_cost: number
  
  consumption_details: any
}

interface BillingPreview {
  workspace_id: string
  period_start: string
  period_end: string
  billing_cycle: 'monthly' | 'annual'
  items: BillingItem[]
  total_amount: number
  status: string
  currency: string
}

interface NotificationState {
  show: boolean
  message: string
  type: 'success' | 'error'
}

export default function BillingDashboard({ workspaceId }: { workspaceId: string }) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [currentPreview, setCurrentPreview] = useState<BillingPreview | null>(null)
  
  const [billingForm, setBillingForm] = useState({
    period_start: '',
    period_end: '',
    billing_cycle: 'monthly' as 'monthly' | 'annual'
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
    if (workspaceId) {
      fetchInvoices()
    }
  }, [workspaceId])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/billing/generate?workspace_id=${workspaceId}&limit=20`)
      
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices || [])
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors du chargement des factures', 'error')
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
      showNotification('Erreur de connexion', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = async () => {
    try {
      setGenerating(true)
      
      const response = await fetch('/api/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...billingForm,
          preview: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentPreview(data.invoice)
        setShowPreviewDialog(true)
        showNotification('Aperçu généré avec succès')
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors de la génération', 'error')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      showNotification('Erreur de connexion', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const generateInvoice = async () => {
    try {
      setGenerating(true)
      
      const response = await fetch('/api/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...billingForm,
          preview: false
        })
      })

      if (response.ok) {
        const data = await response.json()
        showNotification(data.message || 'Facture générée avec succès')
        setShowDialog(false)
        setShowPreviewDialog(false)
        await fetchInvoices()
      } else {
        const errorData = await response.json()
        showNotification(errorData.error || 'Erreur lors de la génération', 'error')
      }
    } catch (error) {
      console.error('Error generating invoice:', error)
      showNotification('Erreur de connexion', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default'
      case 'sent': return 'secondary'
      case 'draft': return 'outline'
      case 'cancelled': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Payée'
      case 'sent': return 'Envoyée'
      case 'draft': return 'Brouillon'
      case 'cancelled': return 'Annulée'
      default: return status
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="h-5 w-5" />
            <span>Gestion Facturation</span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Factures ce mois
                </p>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => 
                    new Date(i.created_at).getMonth() === new Date().getMonth()
                  ).length}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Montant total
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    invoices.reduce((sum, i) => sum + i.total_amount, 0)
                  )}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Factures payées
                </p>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'paid').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5" />
              <span>Historique des Factures</span>
            </div>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Générer Facture
            </Button>
          </CardTitle>
          <CardDescription>
            Consultez et gérez toutes les factures générées pour ce workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aucune facture générée. Créez votre première facture pour commencer.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {invoice.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {getStatusText(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-3 w-3" />
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

      {/* Generate Invoice Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Générer Nouvelle Facture</DialogTitle>
            <DialogDescription>
              Définissez la période et le type de facturation pour générer une nouvelle facture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date de début</label>
              <Input
                type="date"
                value={billingForm.period_start}
                onChange={(e) => setBillingForm({ ...billingForm, period_start: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date de fin</label>
              <Input
                type="date"
                value={billingForm.period_end}
                onChange={(e) => setBillingForm({ ...billingForm, period_end: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cycle de facturation</label>
              <Select 
                value={billingForm.billing_cycle} 
                onValueChange={(value: 'monthly' | 'annual') => 
                  setBillingForm({ ...billingForm, billing_cycle: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="annual">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="outline" 
              onClick={generatePreview}
              disabled={generating || !billingForm.period_start || !billingForm.period_end}
            >
              <Eye className="h-4 w-4 mr-2" />
              Aperçu
            </Button>
            <Button 
              onClick={generateInvoice}
              disabled={generating || !billingForm.period_start || !billingForm.period_end}
            >
              {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {currentPreview && (
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aperçu Facture {currentPreview.billing_cycle === 'monthly' ? 'Mensuelle' : 'Annuelle'}</DialogTitle>
              <DialogDescription>
                Période: {formatDate(currentPreview.period_start)} - {formatDate(currentPreview.period_end)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Montant Total: {formatCurrency(currentPreview.total_amount, currentPreview.currency)}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Appels</TableHead>
                    <TableHead>STT</TableHead>
                    <TableHead>TTS</TableHead>
                    <TableHead>LLM</TableHead>
                    <TableHead>Coût Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPreview.items.map((item) => (
                    <TableRow key={item.agent_id}>
                      <TableCell className="font-medium">{item.agent_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.platform_mode.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.total_calls}</TableCell>
                      <TableCell>
                        {formatCurrency(item.stt_cost)}
                        <div className="text-xs text-gray-500">
                          {item.total_stt_minutes.toFixed(2)} min
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.tts_cost)}
                        <div className="text-xs text-gray-500">
                          {item.total_tts_words} mots
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.llm_cost)}
                        <div className="text-xs text-gray-500">
                          {item.total_llm_tokens} tokens
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(item.total_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Fermer
              </Button>
              <Button 
                onClick={generateInvoice}
                disabled={generating}
              >
                {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Confirmer et Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
