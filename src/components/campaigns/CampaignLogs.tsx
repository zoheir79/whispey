'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Phone,
  Clock,
  Building2,
  FileText,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Upload,
  Calendar,
  Trash2,
  CheckCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignLog {
  id: string
  phoneNumber: string
  alternative_number?: string
  fpoName: string
  fpoLoginId: string
  call_status: string
  masterMobileNo
 :string
  attempt_count: number
  sourceFile: string
  createdAt: string
  alternateMobile:string
  uploadedAt: string
  real_attempt_count: number
  system_error_count: number
}

interface PaginationMeta {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextPage: number | null
  previousPage: number | null
}

interface CampaignLogsResponse {
  items: CampaignLog[]
  pagination: PaginationMeta
  filters: any
  scannedCount: number
}

interface CampaignLogsProps {
  project: any
  agent: any
  onBack: () => void
}

const CALL_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'in_progress', label: 'In Progress' }
]

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'call_status', label: 'Status' },
]

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

const CampaignLogs: React.FC<CampaignLogsProps> = ({ project, agent, onBack }) => {
  // Data state
  const [logs, setLogs] = useState<CampaignLog[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFileFilter, setSourceFileFilter] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'phoneNumber' | 'call_status'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // UI state
  const [refreshing, setRefreshing] = useState(false)
  
  // Dialog states
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false) 
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  
  // Schedule form data
  const [scheduleData, setScheduleData] = useState({
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    concurrency: 10,
    retry_config: {
      '408': 60,
      '480': 60,
      '486': 60,
      '504': 60,
      '600': 60
    }
  })
  
  // Delete All states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<any>(null)

  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  // Memoized project ID
  const projectId = agent?.project_id || project?.id

  // Fetch logs function with improved error handling and caching
  const fetchLogs = useCallback(async (resetPage = false) => {
    if (!projectId) {
      setError('Project ID not available')
      setLoading(false)
      return
    }

    try {
      const pageToFetch = resetPage ? 1 : currentPage
      
      if (resetPage) {
        setCurrentPage(1)
        setLogs([])
        setPagination(null)
      }

      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.append('project_id', projectId)
      params.append('page', pageToFetch.toString())
      params.append('limit', itemsPerPage.toString())
      params.append('sort_by', sortBy)
      params.append('sort_order', sortOrder)

      if (statusFilter && statusFilter !== 'all') {
        params.append('call_status', statusFilter)
      }

      if (sourceFileFilter && sourceFileFilter.trim()) {
        params.append('source_file', sourceFileFilter.trim())
      }

      if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim())
      }

      const url = `/api/campaign-logs?${params.toString()}`

      const response = await fetch(url)
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch campaign logs'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If we can't parse the error response, use the default message
        }
        
        if (response.status === 403) {
          throw new Error('Campaign logs are only available for enhanced projects')
        }
        if (response.status === 400) {
          throw new Error(`Bad request: ${errorMessage}`)
        }
        throw new Error(errorMessage)
      }

      const data: CampaignLogsResponse = await response.json()
      
      setLogs(data.items)
      setPagination(data.pagination)


    } catch (err: any) {
      console.error('Error fetching campaign logs:', err)
      setError(err.message || 'Failed to fetch campaign logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId, currentPage, itemsPerPage, statusFilter, sourceFileFilter, debouncedSearchQuery, sortBy, sortOrder])

  // Refresh function
  const refresh = useCallback(() => {
    setRefreshing(true)
    fetchLogs(true)
  }, [fetchLogs])

  // Effects
  useEffect(() => {
    if (projectId) {
      fetchLogs(true)
    }
  }, [projectId, itemsPerPage, statusFilter, sourceFileFilter, debouncedSearchQuery, sortBy, sortOrder])

  useEffect(() => {
    if (projectId && !refreshing) {
      fetchLogs(false)
    }
  }, [currentPage, fetchLogs])

  // Set default dates when schedule dialog opens
  useEffect(() => {
    if (showScheduleDialog) {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      setScheduleData(prev => ({
        ...prev,
        start_date: today.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0]
      }))
    }
  }, [showScheduleDialog])

  // Helper functions
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-600'
    }
  }

  const exportLogs = () => {
    const csvContent = [
      // Header
      'Phone Number,Alternative Number,FPO Name,FPO Login ID,Status,Real Attempts,Source File,Created At,Uploaded At',
      // Data rows
      ...logs.map(log => 
        `"${log.phoneNumber}","${log.alternative_number || ''}","${log.fpoName}","${log.fpoLoginId}","${log.call_status}",${log.real_attempt_count},"${log.sourceFile}","${log.createdAt}","${log.uploadedAt}"`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `campaign-logs-page-${currentPage}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSort = (column: 'createdAt' | 'phoneNumber' | 'call_status') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />
  }

  const goToPage = (page: number) => {
    if (page >= 1 && pagination && page <= pagination.totalPages) {
      setCurrentPage(page)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSourceFileFilter('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setCurrentPage(1)
  }

  // Upload CSV handler (same as before)
  const handleUpload = async () => {
    if (!csvFile) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('project_id', projectId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload CSV')
      }

      const result = await response.json()
      
      const alertMessage = [
        result.message,
        `File: ${result.fileName} (${(result.fileSize / 1024).toFixed(1)} KB)`,
        result.s3Key && result.s3Key !== 'upload_successful_but_key_unavailable' 
          ? `S3 Key: ${result.s3Key}` 
          : 'Upload completed successfully',
        result.uploadUrl ? `URL: ${result.uploadUrl}` : ''
      ].filter(Boolean).join('\n')
      
      alert(alertMessage)
      
      setShowUploadDialog(false)
      setCsvFile(null)
      
      // Refresh logs after upload
      setTimeout(() => {
        refresh()
      }, 2000)
      
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload CSV: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // Schedule Campaign handler (same as before)
  const handleSchedule = async () => {
    if (!scheduleData.start_date || !scheduleData.end_date) {
      alert('Please select start date and end date')
      return
    }

    setScheduling(true)
    try {
      const schedulePayload = {
        project_id: projectId,
        start_date: scheduleData.start_date,
        end_date: scheduleData.end_date,
        start_time: scheduleData.start_time,
        end_time: scheduleData.end_time,
        concurrency: scheduleData.concurrency,
        retry_config: scheduleData.retry_config
      }

      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create schedule')
      }

      const result = await response.json()
      
      const alertMessage = [
        result.message,
        `Schedule ID: ${result.scheduleId}`,
        `Period: ${result.schedule.start_date} to ${result.schedule.end_date}`,
        `Time: ${result.schedule.start_time} - ${result.schedule.end_time}`,
        `Concurrency: ${result.schedule.concurrency} calls`,
        result.retry_configuration ? 'Retry configuration updated' : ''
      ].filter(Boolean).join('\n')
      
      alert(alertMessage)
      setShowScheduleDialog(false)
      
    } catch (error) {
      console.error('Schedule error:', error)
      alert('Failed to create schedule: ' + (error as Error).message)
    } finally {
      setScheduling(false)
    }
  }

  // Delete All handler (similar to before but with improved UI feedback)
  const handleDeleteAll = async () => {
    if (deleteConfirmText !== 'DELETE ALL LOGS') return
    
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/campaign-logs?project_id=${projectId}&confirm=DELETE_ALL_CAMPAIGN_LOGS`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete logs')
      }

      setDeleteResult({
        success: true,
        message: result.message,
        count: result.deletedCount,
        batchCount: result.batchCount
      })

      // Reset data
      setLogs([])
      setPagination(null)
      setCurrentPage(1)
      
      setShowDeleteDialog(false)
      setDeleteConfirmText('')
      
      // Refresh after delay
      setTimeout(() => {
        fetchLogs(true)
      }, 1000)

    } catch (err: any) {
      console.error('Error deleting logs:', err)
      setDeleteResult({
        success: false,
        message: err.message || 'Failed to delete logs'
      })
    } finally {
      setDeleting(false)
    }
  }

  // Render pagination component
  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null

    const { currentPage: page, totalPages, hasNextPage, hasPreviousPage } = pagination

    // Calculate page numbers to show
    const getPageNumbers = () => {
      const pages = []
      const showPages = 5 // Number of page buttons to show
      
      let startPage = Math.max(1, page - Math.floor(showPages / 2))
      let endPage = Math.min(totalPages, startPage + showPages - 1)
      
      if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1)
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
      
      return pages
    }

    const pageNumbers = getPageNumbers()

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div>
            Showing {((page - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(page * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Rows per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPreviousPage || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers[0] > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={loading}
                >
                  1
                </Button>
                {pageNumbers[0] > 2 && (
                  <span className="px-2 text-gray-400">...</span>
                )}
              </>
            )}

            {pageNumbers.map(pageNum => (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="sm"
                onClick={() => goToPage(pageNum)}
                disabled={loading}
                className={pageNum === page ? "bg-blue-600 text-white" : ""}
              >
                {pageNum}
              </Button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-2 text-gray-400">...</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={loading}
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNextPage || loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Unable to Load Campaign Logs</h2>
          <p className="text-gray-600">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => fetchLogs(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Campaign Logs</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowUploadDialog(true)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowScheduleDialog(true)}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportLogs}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
                disabled={logs.length === 0 || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
            >
              {CALL_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Source File Filter */}
            <Input
              placeholder="Filter by source file..."
              value={sourceFileFilter}
              onChange={(e) => setSourceFileFilter(e.target.value)}
              className="bg-white/80 backdrop-blur-sm"
            />

            {/* Sort Options */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as 'createdAt' | 'phoneNumber' | 'call_status')
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white/80 backdrop-blur-sm"
            >
              {SORT_OPTIONS.map(option => (
                <React.Fragment key={option.value}>
                  <option value={`${option.value}-desc`}>
                    {option.label} ↓
                  </option>
                  <option value={`${option.value}-asc`}>
                    {option.label} ↑
                  </option>
                </React.Fragment>
              ))}
            </select>

            {/* Clear Filters */}
            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="bg-white/80 backdrop-blur-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      </header>

      {/* Table */}
      <main className="flex-1 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading campaign logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No campaign logs found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all' || sourceFileFilter 
                ? 'Try adjusting your search criteria' 
                : 'No contacts have been uploaded yet'
              }
            </p>
            {(searchQuery || statusFilter !== 'all' || sourceFileFilter) && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto">
              <div className="min-w-full" style={{ minWidth: "1500px" }}>
                <Table className="w-full">
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                      <TableHead 
                        className="w-[140px] font-semibold text-foreground pl-6 cursor-pointer hover:bg-muted/60"
                        onClick={() => handleSort('phoneNumber')}
                      >
                        <div className="flex items-center gap-2">
                          Phone Number
                          {getSortIcon('phoneNumber')}
                        </div>
                      </TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground">Alternative</TableHead>
                      <TableHead className="w-[160px] font-semibold text-foreground">FPO Name</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">FPO Login ID</TableHead>
                      <TableHead 
                        className="w-[100px] font-semibold text-foreground cursor-pointer hover:bg-muted/60"
                        onClick={() => handleSort('call_status')}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon('call_status')}
                        </div>
                      </TableHead>
                      <TableHead className="w-[90px] font-semibold text-foreground">Retry Attempts</TableHead>
                      <TableHead className="w-[200px] font-semibold text-foreground">System Error</TableHead>
                      <TableHead 
                        className="w-[140px] font-semibold text-foreground pr-6 cursor-pointer hover:bg-muted/60"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-2">
                          Created At
                          {getSortIcon('createdAt')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-default hover:bg-muted/30 transition-all duration-200 border-b border-border/50"
                      >
                        <TableCell className="font-medium pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Phone className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">{log.masterMobileNo
}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600">{log.alternateMobile || '-'}</span>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{log.fpoName}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <code className="text-xs bg-muted/60 px-2 py-1 rounded font-mono">
                            {log.fpoLoginId}
                          </code>
                        </TableCell>

                        <TableCell className="py-4">
                          <Badge
                            className={cn("text-xs font-medium px-2.5 py-1", getStatusColor(log.call_status))}
                          >
                            {log.call_status}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {log.real_attempt_count}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {log.system_error_count}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-sm text-muted-foreground py-4 pr-6">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {loading && logs.length > 0 && (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                    <p className="text-sm text-gray-600 mt-2">Loading more data...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {renderPagination()}
          </div>
        )}
      </main>

      {/* All the existing dialogs remain the same */}
      {/* Upload CSV Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload CSV File</h3>
              <p className="text-sm text-gray-600">Select a CSV file to upload to S3</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {csvFile && (
                <div className="text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 rounded p-3">
                  <strong>Selected:</strong> {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowUploadDialog(false)
                  setCsvFile(null)
                }} 
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!csvFile || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload to S3
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            {!deleteResult ? (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-red-900 mb-2">Delete All Campaign Logs</h3>
                  <p className="text-sm text-red-700">This will permanently delete all campaign logs from DynamoDB</p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 mb-2">
                    <strong>⚠️ Warning:</strong> This action cannot be undone!
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type <span className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">DELETE ALL LOGS</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE ALL LOGS"
                      disabled={deleting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  
                  {pagination && (
                    <div className="text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 rounded p-3">
                      <strong>Records to be deleted:</strong> {pagination.totalItems} campaign log entries
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false)
                      setDeleteConfirmText('')
                      setDeleteResult(null)
                    }}
                    disabled={deleting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAll}
                    disabled={deleteConfirmText !== 'DELETE ALL LOGS' || deleting}
                    className="flex-1"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete All Logs
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    deleteResult.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {deleteResult.success ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    deleteResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {deleteResult.success ? 'Deletion Successful!' : 'Deletion Failed'}
                  </h3>
                  <p className={`text-sm ${
                    deleteResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {deleteResult.message}
                  </p>
                  
                  {deleteResult.success && (
                    <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-3">
                      <strong>Deleted:</strong> {deleteResult.count} records in {deleteResult.batchCount} batches
                    </div>
                  )}
                </div>
                
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false)
                      setDeleteConfirmText('')
                      setDeleteResult(null)
                    }}
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Schedule Dialog - keeping the same structure as original */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Schedule Campaign</h3>
              <p className="text-sm text-gray-600">Configure your campaign schedule settings</p>
            </div>
            
            {/* Schedule form content - same as original */}
            <div className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={scheduleData.start_date}
                    onChange={(e) => setScheduleData({ ...scheduleData, start_date: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={scheduleData.end_date}
                    onChange={(e) => setScheduleData({ ...scheduleData, end_date: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              {/* Time Range and other fields - same structure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={scheduleData.start_time}
                    onChange={(e) => setScheduleData({ ...scheduleData, start_time: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    End Time
                  </label>
                  <input
                    type="time"
                    value={scheduleData.end_time}
                    onChange={(e) => setScheduleData({ ...scheduleData, end_time: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrency
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={scheduleData.concurrency}
                  onChange={(e) => setScheduleData({ ...scheduleData, concurrency: parseInt(e.target.value) || 1 })}
                  disabled={scheduling}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowScheduleDialog(false)}
                disabled={scheduling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSchedule}
                disabled={scheduling}
                className="flex-1"
              >
                {scheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 w-4 mr-2" />
                    Create Schedule
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignLogs