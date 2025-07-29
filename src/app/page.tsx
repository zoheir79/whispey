'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../components/ProjectSelection'
import LoadingSpinner from '../components/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  // ✅ move useEffect before any return
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // ✅ safely return spinner or content
  if (!isLoaded) return <LoadingSpinner />
  if (!isSignedIn) return null // wait for redirect (or show message/spinner)

  return <ProjectSelection />
}
