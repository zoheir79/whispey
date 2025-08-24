// lib/user-data.ts
import { fetchFromTable } from './db-service'
import { headers } from 'next/headers'
import { verifyUserAuth } from './auth'

export interface PyveVoiceUser {
  id?: number
  user_id: string // Changed from clerk_id to user_id
  email: string
  name: string | null // Combined first_name and last_name
  profile_image_url: string | null
  created_at?: string
  updated_at?: string
}

// Server-side function to get current user's data from your database
export async function getCurrentUserProfile(): Promise<{
  data: PyveVoiceUser | null
  error: string | null
}> {
  try {
    // Check authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth()
    
    if (!isAuthenticated || !userId) {
      return { data: null, error: 'Not authenticated' }
    }
    
    const { data, error } = await fetchFromTable({
      table: 'pype_voice_users',
      select: '*',
      filters: [{ column: 'user_id', operator: '=', value: userId }]
    })
      
    if (error) {
      return { data: null, error: error.message }
    }
    
    // Extraire le premier utilisateur des résultats
    const userData = Array.isArray(data) && data.length > 0 ? data[0] : null;
    
    // Vérifier que l'utilisateur a toutes les propriétés requises
    if (userData && typeof userData === 'object' && 'user_id' in userData && 'email' in userData) {
      // Conversion sécurisée en utilisant une conversion explicite via Record
      const userRecord = userData as Record<string, unknown>;
      
      const typedUser: PyveVoiceUser = {
        user_id: String(userRecord.user_id),
        email: String(userRecord.email),
        name: userRecord.name as string | null,
        profile_image_url: userRecord.profile_image_url as string | null,
        id: userRecord.id as number | undefined,
        created_at: userRecord.created_at as string | undefined,
        updated_at: userRecord.updated_at as string | undefined
      };
      return { data: typedUser, error: null };
    }
    
    return { data: null, error: 'User data format invalid' }
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Server-side function to get current user from JWT auth
export async function getCurrentJWTUser() {
  try {
    // Check authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth()
    if (!isAuthenticated || !userId) {
      console.error('User not authenticated')
      return null
    }
    return { id: userId }
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

// Client-side hook for React components
export function useUserData() {
  // This would be used in client components
  // Use fetch('/api/auth/me') to get user data on the client side
  // Implementation depends on your specific needs
}