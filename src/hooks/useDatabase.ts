'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// Hook pour effectuer des requêtes à notre API qui utilise PostgreSQL
export const useQuery = (endpoint: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Construire l'URL avec les paramètres de requête
      let url = `/api/${endpoint}`
      
      // Ajouter les paramètres de requête
      if (options.params) {
        const queryParams = new URLSearchParams()
        Object.entries(options.params).forEach(([key, value]: [string, any]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString())
          }
        })
        
        const queryString = queryParams.toString()
        if (queryString) {
          url += `?${queryString}`
        }
      }
      
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      })
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }
      
      const result = await response.json()
      setData(result.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint, JSON.stringify(options)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// Hook pour l'infinite scroll avec notre API
export const useInfiniteScroll = (endpoint: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const offsetRef = useRef(0)
  const loadingRef = useRef(false) // Prevent concurrent requests
  const limit = options.limit || 50

  // Memoize options to prevent unnecessary re-renders
  const optionsHash = JSON.stringify(options)

  const fetchData = useCallback(async (reset = false) => {
    // Prevent concurrent requests
    if (loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const offset = reset ? 0 : offsetRef.current
      
      // Construire l'URL avec les paramètres de requête
      let url = `/api/${endpoint}`
      
      // Ajouter les paramètres de requête
      const queryParams = new URLSearchParams()
      queryParams.append('limit', limit.toString())
      queryParams.append('offset', offset.toString())
      
      // Ajouter d'autres paramètres
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]: [string, any]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString())
          }
        })
      }
      
      const queryString = queryParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
      
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      })
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }
      
      const result = await response.json()
      const fetchedData = result.data || []
      
      if (reset) {
        setData(fetchedData)
        offsetRef.current = fetchedData.length
      } else {
        // Remove duplicates by checking existing IDs
        setData(prevData => {
          const existingIds = new Set(prevData.map((item: any) => item.id))
          const uniqueNewData = fetchedData.filter((item: any) => !existingIds.has(item.id))
          return [...prevData, ...uniqueNewData]
        })
        offsetRef.current += fetchedData.length
      }
      
      setHasMore(fetchedData.length === limit)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [endpoint, optionsHash, limit])

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore && !initialLoad) {
      fetchData(false)
    }
  }, [fetchData, hasMore, initialLoad])

  const refresh = useCallback(() => {
    offsetRef.current = 0
    setInitialLoad(true)
    fetchData(true).then(() => setInitialLoad(false))
  }, [fetchData])

  // Initial load
  useEffect(() => {
    if (initialLoad) {
      fetchData(true).then(() => setInitialLoad(false))
    }
  }, [fetchData, initialLoad])

  return { data, loading, hasMore, error, loadMore, refresh }
}
