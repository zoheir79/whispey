import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface OverviewData {
  totalCalls: number
  totalMinutes: number
  successfulCalls: number
  successRate: number
  averageLatency: number
  uniqueCustomers: number
  dailyData: Array<{
    date: string
    dateKey: string
    calls: number
    minutes: number
  }>
}

interface UseOverviewQueryProps {
  agentId: string
  dateFrom: string // 'YYYY-MM-DD'
  dateTo: string   // 'YYYY-MM-DD'
}

export const useOverviewQuery = ({ agentId, dateFrom, dateTo }: UseOverviewQueryProps) => {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Single RPC call to get all overview data
        const { data: overviewData, error: rpcError } = await supabase
          .rpc('get_overview_data', {
            p_agent_id: agentId,
            p_date_from: `${dateFrom}T00:00:00`,
            p_date_to: `${dateTo}T23:59:59`
          })
          
        if (rpcError) throw rpcError

        // Type the response data
        const typedData: OverviewData = {
          totalCalls: overviewData.totalCalls || 0,
          totalMinutes: overviewData.totalMinutes || 0,
          successfulCalls: overviewData.successfulCalls || 0,
          successRate: overviewData.successRate || 0,
          averageLatency: overviewData.averageLatency || 0,
          uniqueCustomers: overviewData.uniqueCustomers || 0,
          dailyData: overviewData.dailyData || []
        }

        setData(typedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (agentId && dateFrom && dateTo) {
      fetchOverviewData()
    }
  }, [agentId, dateFrom, dateTo])

  return { data, loading, error }
}