'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CreditCard, AlertTriangle, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UserCredit {
  id: string
  current_balance: number
  credit_limit: number
  auto_recharge_enabled: boolean
  auto_recharge_amount: number
  auto_recharge_threshold: number
  is_suspended: boolean
  last_transaction_date: string
}

interface CreditDisplayProps {
  className?: string
  variant?: 'header' | 'sidebar' | 'card'
  showDetails?: boolean
}

export function CreditDisplay({ className, variant = 'header', showDetails = false }: CreditDisplayProps) {
  const [credits, setCredits] = useState<UserCredit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchCredits = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/credits')
      if (!response.ok) throw new Error('Failed to fetch credits')
      const data = await response.json()
      setCredits(data)
      setError('')
    } catch (error) {
      console.error('Error fetching credits:', error)
      setError('Erreur lors du chargement des crédits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredits()
    // Refresh credits every 5 minutes
    const interval = setInterval(fetchCredits, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getCreditStatus = () => {
    if (!credits) return { status: 'unknown', color: 'gray' }
    
    const balancePercentage = (credits.current_balance / credits.credit_limit) * 100
    
    if (credits.is_suspended) {
      return { status: 'suspended', color: 'red' }
    } else if (balancePercentage <= 10) {
      return { status: 'critical', color: 'red' }
    } else if (balancePercentage <= 25) {
      return { status: 'low', color: 'orange' }
    } else {
      return { status: 'good', color: 'green' }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (loading && variant === 'header') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <CreditCard className="h-4 w-4 animate-pulse text-gray-400" />
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <Badge variant="destructive" className="text-xs">Erreur</Badge>
      </div>
    )
  }

  if (!credits) return null

  const { status, color } = getCreditStatus()

  // Header variant - compact display
  if (variant === 'header') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
          >
            <CreditCard className={`h-4 w-4 ${
              color === 'red' ? 'text-red-500' : 
              color === 'orange' ? 'text-orange-500' : 
              'text-green-500'
            }`} />
            <Badge 
              variant={color === 'red' ? 'destructive' : color === 'orange' ? 'secondary' : 'default'}
              className={`text-xs ${
                color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''
              }`}
            >
              {formatCurrency(credits.current_balance)}
            </Badge>
            {credits.is_suspended && (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Crédits Disponibles</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchCredits}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {credits.is_suspended && (
              <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  Services suspendus - Balance insuffisante
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Balance actuelle:</span>
                <span className={`font-bold ${
                  color === 'red' ? 'text-red-600' : 
                  color === 'orange' ? 'text-orange-600' : 
                  'text-green-600'
                }`}>
                  {formatCurrency(credits.current_balance)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Limite de crédit:</span>
                <span className="font-medium">{formatCurrency(credits.credit_limit)}</span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    color === 'red' ? 'bg-red-500' : 
                    color === 'orange' ? 'bg-orange-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((credits.current_balance / credits.credit_limit) * 100, 100)}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>0%</span>
                <span>{((credits.current_balance / credits.credit_limit) * 100).toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>

            {credits.auto_recharge_enabled && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Auto-Recharge Activée
                  </span>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-200 space-y-1">
                  <div>Seuil: {formatCurrency(credits.auto_recharge_threshold)}</div>
                  <div>Montant: {formatCurrency(credits.auto_recharge_amount)}</div>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Dernière transaction: {credits.last_transaction_date ? 
                new Date(credits.last_transaction_date).toLocaleDateString('fr-FR') : 
                'Aucune'
              }
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Card variant - detailed display
  if (variant === 'card') {
    return (
      <div className={`p-4 border rounded-lg bg-white dark:bg-gray-800 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className={`h-5 w-5 ${
              color === 'red' ? 'text-red-500' : 
              color === 'orange' ? 'text-orange-500' : 
              'text-green-500'
            }`} />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Crédits</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCredits} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {credits.is_suspended && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              Services suspendus - Balance insuffisante
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              color === 'red' ? 'text-red-600' : 
              color === 'orange' ? 'text-orange-600' : 
              'text-green-600'
            }`}>
              {formatCurrency(credits.current_balance)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              sur {formatCurrency(credits.credit_limit)}
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                color === 'red' ? 'bg-red-500' : 
                color === 'orange' ? 'bg-orange-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min((credits.current_balance / credits.credit_limit) * 100, 100)}%` }}
            />
          </div>

          {credits.auto_recharge_enabled && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900 dark:text-blue-100">Auto-Recharge</span>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                Recharge de {formatCurrency(credits.auto_recharge_amount)} quand sous {formatCurrency(credits.auto_recharge_threshold)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Sidebar variant - minimal display
  return (
    <div className={`flex items-center justify-between p-2 ${className}`}>
      <div className="flex items-center gap-2">
        <CreditCard className={`h-4 w-4 ${
          color === 'red' ? 'text-red-500' : 
          color === 'orange' ? 'text-orange-500' : 
          'text-green-500'
        }`} />
        <span className="text-sm font-medium">Crédits</span>
      </div>
      <Badge 
        variant={color === 'red' ? 'destructive' : color === 'orange' ? 'secondary' : 'default'}
        className={`text-xs ${
          color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
          color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''
        }`}
      >
        {formatCurrency(credits.current_balance)}
      </Badge>
    </div>
  )
}
