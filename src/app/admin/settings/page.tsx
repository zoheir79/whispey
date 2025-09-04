'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIProvidersManagement from '@/components/admin/AIProvidersManagement'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Settings, Shield } from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const { globalRole, isSuperAdmin, isLoading } = useGlobalRole()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.push('/')
    }
  }, [isLoading, isSuperAdmin, router])

  if (!isClient || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Vérification des permissions...</p>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <CardTitle className="text-red-600">Accès Refusé</CardTitle>
            <CardDescription>
              Seuls les super administrateurs peuvent accéder aux paramètres globaux.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Paramètres Administrateur
          </h1>
        </div>
        <p className="text-gray-600">
          Configurez les fournisseurs IA, les modèles intégrés, le stockage S3 et les coûts globaux.
        </p>
      </div>

      <AIProvidersManagement />
    </div>
  )
}
