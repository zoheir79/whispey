'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Users, Clock, UserCheck, UserX, AlertCircle, Loader2, Shield, ShieldOff, Check, X, Mail } from 'lucide-react'
import Header from '@/components/shared/Header'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface User {
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  global_role: string
  status: 'active' | 'suspended'
  created_at: string
  updated_at?: string
  updated_by?: string
}

export default function AdminUsersPage() {
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [processingUser, setProcessingUser] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    user: User | null
    action: 'suspend' | 'unsuspend' | null
  }>({ isOpen: false, user: null, action: null })

  // Redirect non-super-admins
  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      router.push('/dashboard')
    }
  }, [isSuperAdmin, roleLoading, router])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers()
    }
  }, [isSuperAdmin])

  const handleUserAction = async (userId: string, action: 'suspend' | 'unsuspend') => {
    setProcessingUser(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (!res.ok) throw new Error(`Failed to ${action} user`)
      
      await fetchUsers() // Refresh the list
      setConfirmDialog({ isOpen: false, user: null, action: null })
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setProcessingUser(null)
    }
  }

  const openConfirmDialog = (user: User, action: 'suspend' | 'unsuspend') => {
    setConfirmDialog({ isOpen: true, user, action })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'suspended':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  if (roleLoading || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Users className="w-6 h-6" />
                User Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Approve new user registrations and manage user access.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="dark:bg-blue-900 dark:border-blue-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Suspended</p>
                    <p className="text-2xl font-semibold text-red-600">
                      {users.filter(u => u.status === 'suspended').length}
                    </p>
                  </div>
                  <ShieldOff className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-blue-900 dark:border-blue-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Active</p>
                    <p className="text-2xl font-semibold text-green-600">
                      {users.filter(u => u.status === 'active').length}
                    </p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-blue-900 dark:border-blue-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">All Users</p>
                    <p className="text-2xl font-semibold text-blue-600">
                      {users.length}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-blue-900 dark:border-blue-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {users.length}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-blue-800 rounded-lg p-1">
                {(['all', 'active', 'suspended'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      selectedStatus === status
                        ? 'bg-white dark:bg-blue-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-blue-700/50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchUsers} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <Card key={user.user_id} className="dark:bg-blue-900 dark:border-blue-700 hover:shadow-sm transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.first_name?.[0] || user.email[0].toUpperCase()}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}` 
                              : user.email}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-medium border ${getStatusColor(user.status)}`}
                          >
                            {user.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-medium">
                            {user.global_role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Registered {formatDate(user.created_at)}
                          </div>
                          {user.updated_at && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Clock className="w-4 h-4" />
                              Updated {formatDate(user.updated_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {user.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmDialog(user, 'suspend')}
                          disabled={processingUser === user.user_id}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          {processingUser === user.user_id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <ShieldOff className="w-4 h-4 mr-1" />
                          )}
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openConfirmDialog(user, 'unsuspend')}
                          disabled={processingUser === user.user_id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processingUser === user.user_id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Shield className="w-4 h-4 mr-1" />
                          )}
                          Unsuspend
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-20">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {searchQuery ? 'No users found' : 'No users yet'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery 
                    ? 'Try adjusting your search criteria'
                    : 'New user registrations will appear here for approval'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ isOpen: false, user: null, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'suspend' ? 'Suspend User' : 'Unsuspend User'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'suspend' 
                ? `Suspend ${confirmDialog.user?.email}'s access to the platform?`
                : `Restore ${confirmDialog.user?.email}'s access to the platform?`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ isOpen: false, user: null, action: null })}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.user && confirmDialog.action && handleUserAction(confirmDialog.user.user_id, confirmDialog.action)}
              disabled={processingUser !== null}
              className={`flex-1 ${
                confirmDialog.action === 'unsuspend' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {processingUser ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {confirmDialog.action === 'suspend' ? 'Suspend' : 'Unsuspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
