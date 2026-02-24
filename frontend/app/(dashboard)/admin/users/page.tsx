'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Filter, Download, Plus, MoreVertical, Edit, Trash2,
  Mail, Shield, Ban, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  ArrowUpDown, Eye, Coins, Clock, Activity
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  full_name: string
  role: 'user' | 'admin'
  plan: 'free' | 'starter' | 'explorer' | 'builder'
  status: 'active' | 'suspended' | 'pending'
  token_balance: number
  total_spent: number
  total_usage: number
  created_at: string
  last_active_at: string
  organization_name?: string
}

// Mock users data
const mockUsers: User[] = [
  { id: '1', email: 'john@example.com', full_name: 'John Doe', role: 'user', plan: 'builder', status: 'active', token_balance: 500000, total_spent: 2450, total_usage: 125000, created_at: '2024-01-15', last_active_at: '2024-12-20', organization_name: 'Acme Corp' },
  { id: '2', email: 'jane@example.com', full_name: 'Jane Smith', role: 'user', plan: 'explorer', status: 'active', token_balance: 180000, total_spent: 890, total_usage: 65000, created_at: '2024-03-22', last_active_at: '2024-12-19' },
  { id: '3', email: 'mike@example.com', full_name: 'Mike Johnson', role: 'user', plan: 'starter', status: 'active', token_balance: 45000, total_spent: 245, total_usage: 28000, created_at: '2024-06-10', last_active_at: '2024-12-18' },
  { id: '4', email: 'sarah@example.com', full_name: 'Sarah Wilson', role: 'admin', plan: 'builder', status: 'active', token_balance: 1200000, total_spent: 3200, total_usage: 180000, created_at: '2024-02-05', last_active_at: '2024-12-20', organization_name: 'Tech Solutions' },
  { id: '5', email: 'alex@example.com', full_name: 'Alex Brown', role: 'user', plan: 'free', status: 'pending', token_balance: 10000, total_spent: 0, total_usage: 5000, created_at: '2024-12-01', last_active_at: '2024-12-15' },
  { id: '6', email: 'emily@example.com', full_name: 'Emily Davis', role: 'user', plan: 'explorer', status: 'suspended', token_balance: 0, total_spent: 450, total_usage: 42000, created_at: '2024-04-18', last_active_at: '2024-11-01' },
  { id: '7', email: 'chris@example.com', full_name: 'Chris Martin', role: 'user', plan: 'builder', status: 'active', token_balance: 780000, total_spent: 1890, total_usage: 98000, created_at: '2024-05-30', last_active_at: '2024-12-20', organization_name: 'StartupXYZ' },
  { id: '8', email: 'lisa@example.com', full_name: 'Lisa Wang', role: 'user', plan: 'starter', status: 'active', token_balance: 92000, total_spent: 380, total_usage: 35000, created_at: '2024-07-14', last_active_at: '2024-12-17' },
]

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', planFilter, statusFilter, currentPage],
    queryFn: async () => {
      // In production, this would be an API call
      return { data: mockUsers, total: mockUsers.length }
    }
  })

  const rawUsersData = usersData?.data as any
  const users = Array.isArray(rawUsersData) ? rawUsersData : (rawUsersData?.users || rawUsersData?.items || [])
  const totalUsers = usersData?.total || users.length || 0

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlan = planFilter === 'all' || user.plan === planFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesPlan && matchesStatus
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<User> }) => {
      // In production, this would be an API call
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User updated successfully')
      setShowUserModal(false)
    },
    onError: () => {
      toast.error('Failed to update user')
    }
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      // In production, this would be an API call
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User deleted successfully')
      setShowDeleteModal(false)
      setSelectedUser(null)
    },
    onError: () => {
      toast.error('Failed to delete user')
    }
  })

  const handleStatusChange = (user: User, newStatus: User['status']) => {
    updateUserMutation.mutate({ id: user.id, updates: { status: newStatus } })
  }

  const handleRoleChange = (user: User, newRole: User['role']) => {
    updateUserMutation.mutate({ id: user.id, updates: { role: newRole } })
  }

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-white">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Users</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-400" />
            User Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
            Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatNumber(totalUsers)}</p>
              <p className="text-sm text-gray-400">Total Users</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'active').length}
              </p>
              <p className="text-sm text-gray-400">Active Users</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Coins className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(users.reduce((sum, u) => sum + u.total_spent, 0))}
              </p>
              <p className="text-sm text-gray-400">Total Revenue</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {formatNumber(users.reduce((sum, u) => sum + u.total_usage, 0))}
              </p>
              <p className="text-sm text-gray-400">Total API Calls</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card variant="bordered" padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <Select
            value={planFilter}
            onValueChange={setPlanFilter}
            options={[
              { value: 'all', label: 'All Plans' },
              { value: 'free', label: 'Free' },
              { value: 'starter', label: 'Starter' },
              { value: 'explorer', label: 'Explorer' },
              { value: 'builder', label: 'Builder' },
            ]}
            className="w-40"
          />
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'pending', label: 'Pending' },
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card variant="bordered" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Plan</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Balance</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Spent</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Last Active</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                        {user.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{user.full_name}</p>
                          {user.role === 'admin' && (
                            <Badge variant="info" className="text-xs">Admin</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {user.organization_name && (
                          <p className="text-xs text-violet-400">{user.organization_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={
                      user.plan === 'builder' ? 'success' :
                      user.plan === 'explorer' ? 'info' :
                      user.plan === 'starter' ? 'warning' : 'default'
                    }>
                      {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={
                      user.status === 'active' ? 'success' :
                      user.status === 'suspended' ? 'danger' : 'warning'
                    }>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">
                      {formatNumber(user.token_balance)} ACT
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">
                      {formatCurrency(user.total_spent)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {formatRelativeTime(user.last_active_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowUserModal(true)
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="View/Edit"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleStatusChange(user, 'suspended')}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Suspend"
                        >
                          <Ban className="w-4 h-4 text-yellow-400" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(user, 'active')}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Activate"
                        >
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <p className="text-sm text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1 text-sm text-white">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* User Detail Modal */}
      <Modal
        open={showUserModal}
        onOpenChange={() => setShowUserModal(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                {selectedUser.full_name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedUser.full_name}</h3>
                <p className="text-gray-400">{selectedUser.email}</p>
                {selectedUser.organization_name && (
                  <p className="text-violet-400 text-sm">{selectedUser.organization_name}</p>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Token Balance</p>
                <p className="text-xl font-bold text-white">{formatNumber(selectedUser.token_balance)} ACT</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Total Spent</p>
                <p className="text-xl font-bold text-white">{formatCurrency(selectedUser.total_spent)}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">API Calls</p>
                <p className="text-xl font-bold text-white">{formatNumber(selectedUser.total_usage)}</p>
              </div>
            </div>

            {/* Edit Fields */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Plan"
                value={selectedUser.plan}
                onValueChange={(v) => setSelectedUser({ ...selectedUser, plan: v as User['plan'] })}
                options={[
                  { value: 'free', label: 'Free' },
                  { value: 'starter', label: 'Starter' },
                  { value: 'explorer', label: 'Explorer' },
                  { value: 'builder', label: 'Builder' },
                ]}
              />
              <Select
                label="Status"
                value={selectedUser.status}
                onValueChange={(v) => setSelectedUser({ ...selectedUser, status: v as User['status'] })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'pending', label: 'Pending' },
                ]}
              />
              <Select
                label="Role"
                value={selectedUser.role}
                onValueChange={(v) => setSelectedUser({ ...selectedUser, role: v as User['role'] })}
                options={[
                  { value: 'user', label: 'User' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Member Since</label>
                <p className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <Button variant="outline" className="flex-1" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => updateUserMutation.mutate({ id: selectedUser.id, updates: selectedUser })}
                isLoading={updateUserMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onOpenChange={() => setShowDeleteModal(false)}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Are you sure you want to delete <strong className="text-white">{selectedUser?.full_name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              isLoading={deleteUserMutation.isPending}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
