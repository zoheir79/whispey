import { useState, useEffect } from 'react'
import { useApiClient } from './useApiClient'

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
  const { callRPC, fetchFromTable } = useApiClient()
  
  // 🔍 DEBUG: Hook called
  console.log('🔍 useOverviewQuery HOOK CALLED with params:', { agentId, dateFrom, dateTo })

  useEffect(() => {
    const fetchOverviewData = async () => {
      console.log('🚀 fetchOverviewData STARTED')
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 About to call callRPC with refreshCallSummary')
    
        // 🔄 Call the PostgreSQL function to refresh the materialized view
        const refreshResult = await callRPC('refreshCallSummary', {})
        console.log('🔍 callRPC RESPONSE received:', refreshResult)
        if (refreshResult.error) throw refreshResult.error

        console.log('✅ refreshCallSummary SUCCESS - Now fetching data from materialized view')
    
        // ✅ Then query the refreshed materialized view
        console.log('🔍 About to call fetchFromTable with:', {
          table: 'call_summary_materialized',
          agentId, dateFrom, dateTo
        })
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
        
        console.log('🔍 fetchFromTable RESPONSE received:', { 
          success: !queryError,
          error: queryError,
          dataLength: dailyStats?.length || 0,
          dailyStats: dailyStats
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
        
        // 🔧 Force numeric conversion to prevent concatenation
        const totalCalls = typedDailyStats.reduce((sum, day) => sum + Number(day.calls || 0), 0)
        const successfulCalls = typedDailyStats.reduce((sum, day) => sum + Number(day.successful_calls || 0), 0)
        const totalCost = typedDailyStats.reduce((sum, day) => sum + Number(day.total_cost || 0), 0)
        
        console.log('🔍 DEBUG - PostgreSQL raw data:', typedDailyStats);
        console.log('🔍 DEBUG - Individual calls values:', typedDailyStats.map(d => ({ calls: d.calls, type: typeof d.calls })));
        console.log('🔍 DEBUG - Calculated totals:', { totalCalls, successfulCalls, totalCost });


    
        const typedData: OverviewData = {
          totalCalls,
          totalCost,
          totalMinutes: typedDailyStats.reduce((sum, day) => sum + Number(day.total_minutes || 0), 0),
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
        console.error('❌ CRITICAL ERROR in fetchOverviewData:', err)
        console.error('❌ Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : 'No stack trace',
          errorObject: err
        })
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        console.log('🏁 fetchOverviewData FINISHED (finally block)')
        setLoading(false)
      }
    }
    

    // 🔍 DEBUG: Check conditions before executing
    console.log('🔍 useOverviewQuery CONDITIONS:', {
      agentId: !!agentId,
      dateFrom: !!dateFrom, 
      dateTo: !!dateTo,
      allConditionsMet: !!(agentId && dateFrom && dateTo)
    })
    
    if (agentId && dateFrom && dateTo) {
      console.log('✅ CONDITIONS MET - Calling fetchOverviewData')
      fetchOverviewData()
    } else {
      console.log('❌ CONDITIONS NOT MET - fetchOverviewData NOT called')
    }
  }, [agentId, dateFrom, dateTo, callRPC, fetchFromTable])

  return { data, loading, error }
}