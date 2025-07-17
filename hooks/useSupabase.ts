'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export const useSupabaseQuery = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from(table)
        .select(options.select || '*')
      
      if (options.filters) {
        options.filters.forEach((filter: any) => {
          query = query.filter(filter.column, filter.operator, filter.value)
        })
      }
      
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending })
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      setData(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(options)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export const useInfiniteScroll = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const limit = options.limit || 50

  const fetchData = useCallback(async (reset = false) => {
    if (loading) return
    
    setLoading(true)
    setError(null)
    
    try {
      const offset = reset ? 0 : offsetRef.current
      let query = supabase
        .from(table)
        .select(options.select || '*')
        .range(offset, offset + limit - 1)
      
      if (options.filters) {
        options.filters.forEach((filter: any) => {
          query = query.filter(filter.column, filter.operator, filter.value)
        })
      }
      
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending })
      }
      
      const { data: newData, error } = await query
      
      if (error) throw error
      
      if (reset) {
        setData(newData || [])
        offsetRef.current = newData?.length || 0
      } else {
        setData(prev => [...prev, ...(newData || [])])
        offsetRef.current += newData?.length || 0
      }
      
      setHasMore((newData?.length || 0) === limit)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(options), limit, loading])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchData(false)
    }
  }, [fetchData, loading, hasMore])

  const refresh = useCallback(() => {
    offsetRef.current = 0
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    fetchData(true)
  }, [])

  return { data, loading, hasMore, error, loadMore, refresh }
}
