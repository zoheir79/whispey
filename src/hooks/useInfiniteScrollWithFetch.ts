'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// Client-safe API call function
const fetchFromAPI = async (query: any) => {
  const response = await fetch('/api/db-rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'fetchFromTable',
      params: query
    })
  })

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'API call failed')
  }
  
  return result.data
}

export const useInfiniteScrollWithFetch = (table: string, options: any = {}) => {
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
      
      const query = {
        table: table,
        select: options.select || '*',
        filters: options.filters || [],
        orderBy: options.orderBy,
        limit: limit,
        offset: offset
      }
      
      const fetchedData = await fetchFromAPI(query)
      
      if (!fetchedData || !Array.isArray(fetchedData)) {
        throw new Error('Invalid response format')
      }
      
      if (reset) {
        setData(fetchedData)
        offsetRef.current = fetchedData.length
      } else {
        // Remove duplicates by checking existing IDs
        setData(prevData => {
          const existingIds = new Set(prevData.map(item => item.id))
          const uniqueNewData = fetchedData.filter(item => !existingIds.has(item.id))
          return [...prevData, ...uniqueNewData]
        })
        offsetRef.current += fetchedData.length
      }
      
      setHasMore(fetchedData.length === limit)
      
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [table, optionsHash, limit])

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

// Alternative: Simple query hook without infinite scroll
export const useQueryWithFetch = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const optionsHash = JSON.stringify(options)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const query = {
        table: table,
        select: options.select || '*',
        filters: options.filters || [],
        orderBy: options.orderBy,
        limit: options.limit
      }
      
      const fetchedData = await fetchFromAPI(query)
      
      if (!fetchedData || !Array.isArray(fetchedData)) {
        throw new Error('Invalid response format')
      }
      
      setData(fetchedData)
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [table, optionsHash])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh }
}
