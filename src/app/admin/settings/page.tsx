'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIProvidersManagement from '@/components/admin/AIProvidersManagement'
import PricingManagement from '@/components/admin/PricingManagement'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import Header from '@/components/shared/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Settings, Shield, Zap, DollarSign } from 'lucide-react'

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <p className="text-gray-600 dark:text-gray-400">Vérification des permissions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <Card className="w-full max-w-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardHeader className="text-center">
              <Shield className="h-16 w-16 mx-auto text-red-500 dark:text-red-400 mb-4" />
              <CardTitle className="text-red-600 dark:text-red-400">Accès Refusé</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Seuls les super administrateurs peuvent accéder aux paramètres globaux.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Paramètres Administrateur
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez les fournisseurs IA, les modèles intégrés, le stockage S3 et les coûts globaux.
          </p>
        </div>

        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-slate-800">
            <TabsTrigger value="providers" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 text-gray-600 dark:text-gray-400">
              <Zap className="h-4 w-4" />
              Fournisseurs IA
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 text-gray-600 dark:text-gray-400">
              <DollarSign className="h-4 w-4" />
              Tarifs & Facturation
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="providers" className="mt-6">
            <AIProvidersManagement />
          </TabsContent>
          
          <TabsContent value="pricing" className="mt-6">
            <PricingManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
