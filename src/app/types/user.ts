export interface PyveVoiceUser {
    id?: number
    user_id: string
    email: string
    name: string | null
    profile_image_url: string | null
    created_at?: string
    updated_at?: string
    // Add any other existing columns you have
  }
  
  export interface UserProfileUpdate {
    email?: string
    name?: string | null
    profile_image_url?: string | null
  }
  
  export interface DatabaseResponse<T> {
    data: T | null
    error: string | null
  }