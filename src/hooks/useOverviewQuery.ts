import { useState, useEffect } from 'react'
import { callRPC } from '../lib/db-rpc'
import { fetchFromTable } from '../lib/db-service'

interface OverviewData {
  totalCalls: number
  totalMinutes: number
  successfulCalls: number
  successRate: number
  averageLatency: number
  totalCost:number
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
    
        // 🔄 Call the PostgreSQL function to refresh the materialized view
        const { data: refreshData, error: refreshError } = await callRPC<any>('refresh_call_summary', {})
        if (refreshError) throw refreshError

    
        // ✅ Then query the refreshed materialized view
        const { data: dailyStats, error: queryError } = await fetchFromTable({
          table: 'call_summary_materialized',
          select: '*',
          filters: [
            { column: 'agent_id', operator: '=', value: agentId },
            { column: 'call_date', operator: '>=', value: dateFrom },
            { column: 'call_date', operator: '<=', value: dateTo }
          ],
          orderBy: { column: 'call_date', ascending: true }
        })

        if (queryError) throw queryError
            
        
        // Typage des données reçues
        type DailyStatRow = {
          call_date: string;
          calls: number;
          total_minutes: number;
          avg_latency: number;
          unique_customers: number;
          successful_calls: number;
          success_rate: number;
          total_cost: number;
        };
        
        // Conversion du tableau any[] en tableau typé
        const typedDailyStats = Array.isArray(dailyStats) ? dailyStats as unknown as DailyStatRow[] : [];
        
        const totalCalls = typedDailyStats.reduce((sum, day) => sum + day.calls, 0)
        const successfulCalls = typedDailyStats.reduce((sum, day) => sum + day.successful_calls, 0)
        const totalCost = typedDailyStats.reduce((sum, day) => sum + day.total_cost, 0)


    
        const typedData: OverviewData = {
          totalCalls,
          totalCost,
          totalMinutes: typedDailyStats.reduce((sum, day) => sum + day.total_minutes, 0),
          successfulCalls,
          successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
          averageLatency: typedDailyStats.length > 0
            ? typedDailyStats.reduce((sum, day) => sum + day.avg_latency, 0) / typedDailyStats.length
            : 0,
          uniqueCustomers: typedDailyStats.reduce((sum, day) => sum + day.unique_customers, 0),
          dailyData: typedDailyStats.map(day => ({
            date: day.call_date,
            dateKey: day.call_date,
            calls: day.calls,
            minutes: day.total_minutes,
            avg_latency: day.avg_latency
          }))
          
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