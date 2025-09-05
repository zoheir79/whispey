"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/shared/Header'
import BillingDashboard from '@/components/admin/BillingDashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Shield } from 'lucide-react'

export default function AdminBillingPage() {
  const [userRole, setUserRole] = useState<string>('')
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      // Check user's global role
      const roleResponse = await fetch('/api/auth/me')
      if (roleResponse.ok) {
        const userData = await roleResponse.json()
        const globalRole = userData.user?.global_role

        if (globalRole !== 'super_admin') {
          router.push('/dashboard')
          return
        }

        setUserRole(globalRole)

        // Get current workspace ID
        const workspaceResponse = await fetch('/api/workspaces/current')
        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json()
          setWorkspaceId(workspaceData.workspace?.id || '')
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header breadcrumb={{ project: 'Admin', item: 'Facturation' }} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </>
    )
  }

  if (userRole !== 'super_admin') {
    return (
      <>
        <Header breadcrumb={{ project: 'Admin', item: 'Facturation' }} />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Accès refusé. Vous devez être Super Admin pour accéder à la gestion de facturation.
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  // Super admin can access billing without workspace selection
  // BillingDashboard will handle workspace selection internally

  return (
    <>
      <Header breadcrumb={{ project: 'Admin', item: 'Facturation' }} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Gestion Facturation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Générez et consultez les factures pour le workspace courant
          </p>
        </div>

        <BillingDashboard workspaceId={workspaceId || 'all'} />
      </div>
    </>
  )
}
