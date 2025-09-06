'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  CreditCard, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Plus,
  Minus,
  RefreshCw,
  Eye,
  Edit,
  Pause,
  Play
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface UserCredit {
  id: string
  workspace_id: string
  workspace_name: string
  user_id: string
  user_email: string
  current_balance: number
  credit_limit: number
  auto_recharge_enabled: boolean
  auto_recharge_amount: number
  auto_recharge_threshold: number
  is_suspended: boolean
  last_transaction_date: string
  created_at: string
  updated_at: string
}

interface CreditTransaction {
  id: string
  user_credit_id: string
  transaction_type: 'deduction' | 'recharge' | 'refund' | 'adjustment'
  amount: number
  balance_before: number
  balance_after: number
  description: string
  service_type?: string
  service_id?: string
  call_id?: string
  created_at: string
  created_by: string
}

interface CreditAlert {
  id: string
  workspace_id: string
  user_id: string
  user_email: string
  alert_type: 'low_balance' | 'service_suspended' | 'recharge_failed'
  severity: 'info' | 'warning' | 'critical'
  message: string
  is_read: boolean
  created_at: string
}

interface CreditStats {
  total_users: number
  total_credits: number
  suspended_users: number
  low_balance_users: number
  monthly_consumption: number
  monthly_recharges: number
}

export function CreditManagement() {
  const [loading, setLoading] = useState(false)
  const [userCredits, setUserCredits] = useState<UserCredit[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [alerts, setAlerts] = useState<CreditAlert[]>([])
  const [stats, setStats] = useState<CreditStats | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserCredit | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const { isSuperAdmin } = useGlobalRole()

  // Dialog states
  const [adjustCreditDialog, setAdjustCreditDialog] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add')

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCreditData()
    }
  }, [isSuperAdmin])

  const fetchCreditData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchUserCredits(),
        fetchCreditStats(),
        fetchCreditAlerts()
      ])
    } catch (error) {
      setError('Erreur lors du chargement des données de crédit')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserCredits = async () => {
    const response = await fetch('/api/admin/credits')
    if (!response.ok) throw new Error('Failed to fetch user credits')
    const data = await response.json()
    setUserCredits(data)
  }

  const fetchCreditStats = async () => {
    const response = await fetch('/api/admin/credits/stats')
    if (!response.ok) throw new Error('Failed to fetch credit stats')
    const data = await response.json()
    setStats(data)
  }

  const fetchCreditAlerts = async () => {
    const response = await fetch('/api/admin/credits/alerts')
    if (!response.ok) throw new Error('Failed to fetch credit alerts')
    const data = await response.json()
    setAlerts(data)
  }

  const fetchUserTransactions = async (userCreditId: string) => {
    const response = await fetch(`/api/admin/credits/${userCreditId}/transactions`)
    if (!response.ok) throw new Error('Failed to fetch transactions')
    const data = await response.json()
    setTransactions(data)
  }

  const handleAdjustCredit = async () => {
    if (!selectedUser || !adjustAmount) return

    setLoading(true)
    try {
      const amount = adjustType === 'add' ? parseFloat(adjustAmount) : -parseFloat(adjustAmount)
      
      const response = await fetch(`/api/admin/credits/${selectedUser.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: adjustReason || `Ajustement manuel de crédits (${adjustType === 'add' ? '+' : '-'}${adjustAmount})`
        })
      })

      if (!response.ok) throw new Error('Failed to adjust credits')

      setSuccess(`Crédits ajustés avec succès pour ${selectedUser.user_email}`)
      setAdjustCreditDialog(false)
      setAdjustAmount('')
      setAdjustReason('')
      await fetchUserCredits()
    } catch (error) {
      setError('Erreur lors de l\'ajustement des crédits')
    } finally {
      setLoading(false)
    }
  }

  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/credits/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend })
      })

      if (!response.ok) throw new Error('Failed to update suspension status')

      setSuccess(`Utilisateur ${suspend ? 'suspendu' : 'réactivé'} avec succès`)
      await fetchUserCredits()
    } catch (error) {
      setError('Erreur lors de la mise à jour du statut de suspension')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateAutoRecharge = async (userId: string, enabled: boolean, amount?: number, threshold?: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/credits/${userId}/auto-recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled, 
          amount: amount || 0, 
          threshold: threshold || 0 
        })
      })

      if (!response.ok) throw new Error('Failed to update auto-recharge')

      setSuccess('Configuration de recharge automatique mise à jour')
      await fetchUserCredits()
    } catch (error) {
      setError('Erreur lors de la mise à jour de la recharge automatique')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = userCredits.filter(user => {
    const matchesSearch = user.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.workspace_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === 'all') return matchesSearch
    if (filterStatus === 'suspended') return matchesSearch && user.is_suspended
    if (filterStatus === 'low_balance') return matchesSearch && user.current_balance < (user.credit_limit * 0.2)
    if (filterStatus === 'auto_recharge') return matchesSearch && user.auto_recharge_enabled
    
    return matchesSearch
  })

  if (!isSuperAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Accès réservé aux super administrateurs
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Crédits</h1>
          <p className="text-gray-600">Administration des crédits utilisateurs et facturation</p>
        </div>
        <Button onClick={fetchCreditData} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crédits Total</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.total_credits.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspendus</CardTitle>
              <Pause className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.suspended_users}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance Faible</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.low_balance_users}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Rechercher par email ou workspace..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="suspended">Suspendus</SelectItem>
                <SelectItem value="low_balance">Balance Faible</SelectItem>
                <SelectItem value="auto_recharge">Auto-Recharge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{user.user_email}</p>
                          <p className="text-sm text-gray-500">{user.workspace_name}</p>
                        </div>
                        <div className="flex gap-2">
                          {user.is_suspended && <Badge variant="destructive">Suspendu</Badge>}
                          {user.current_balance < (user.credit_limit * 0.2) && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">Balance Faible</Badge>
                          )}
                          {user.auto_recharge_enabled && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">Auto-Recharge</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">${user.current_balance.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">Limite: ${user.credit_limit.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            fetchUserTransactions(user.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Dialog open={adjustCreditDialog} onOpenChange={setAdjustCreditDialog}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ajuster les Crédits</DialogTitle>
                              <DialogDescription>
                                Utilisateur: {selectedUser?.user_email}
                                <br />
                                Balance actuelle: ${selectedUser?.current_balance.toFixed(2)}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <Button
                                  variant={adjustType === 'add' ? 'default' : 'outline'}
                                  onClick={() => setAdjustType('add')}
                                  className="flex-1"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ajouter
                                </Button>
                                <Button
                                  variant={adjustType === 'subtract' ? 'default' : 'outline'}
                                  onClick={() => setAdjustType('subtract')}
                                  className="flex-1"
                                >
                                  <Minus className="h-4 w-4 mr-2" />
                                  Retirer
                                </Button>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Montant</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={adjustAmount}
                                  onChange={(e) => setAdjustAmount(e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Raison (optionnel)</Label>
                                <Textarea
                                  value={adjustReason}
                                  onChange={(e) => setAdjustReason(e.target.value)}
                                  placeholder="Raison de l'ajustement..."
                                />
                              </div>
                            </div>
                            
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setAdjustCreditDialog(false)}>
                                Annuler
                              </Button>
                              <Button onClick={handleAdjustCredit} disabled={!adjustAmount || loading}>
                                Confirmer
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant={user.is_suspended ? "default" : "destructive"} 
                          size="sm"
                          onClick={() => handleSuspendUser(user.id, !user.is_suspended)}
                        >
                          {user.is_suspended ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions Récentes</CardTitle>
              <CardDescription>
                {selectedUser ? `Transactions pour ${selectedUser.user_email}` : 'Sélectionnez un utilisateur pour voir ses transactions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount > 0 ? '+' : ''}${transaction.amount.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Balance: ${transaction.balance_after.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Aucune transaction à afficher
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alertes de Crédits</CardTitle>
              <CardDescription>Alertes de balance faible et suspensions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${
                        alert.severity === 'critical' ? 'text-red-500' : 
                        alert.severity === 'warning' ? 'text-orange-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-gray-500">{alert.user_email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.alert_type}
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(alert.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
