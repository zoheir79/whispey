'use client'

import ProjectSelection from '../components/projects/ProjectSelection'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Vérifier si l'utilisateur est authentifié en vérifiant le cookie
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          router.push('/sign-in') // Rediriger vers la page de connexion
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error)
        setIsAuthenticated(false)
        router.push('/sign-in')
      }
    }

    checkAuth()
  }, [router])

  if (isAuthenticated === null) return <LoadingSpinner />
  if (!isAuthenticated) return <LoadingSpinner />

  return <ProjectSelection />
}