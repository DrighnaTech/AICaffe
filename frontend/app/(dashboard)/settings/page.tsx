'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, Bell, Palette, Globe, Shield, Save, Loader2
} from 'lucide-react'
import { authApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, updateUser } = useAuthStore()

  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  })

  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [preferences, setPreferences] = useState({
    theme: user?.preferences?.theme || 'dark',
    notifications: user?.preferences?.notifications ?? true,
    default_model: user?.preferences?.default_model || '',
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name: string }) => authApi.updateProfile(data),
    onSuccess: (response) => {
      updateUser(response.data)
      toast.success('Profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    },
  })

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      authApi.updateProfile(data),
    onSuccess: () => {
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
      toast.success('Password changed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate({ full_name: profile.full_name })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (passwords.new_password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    changePasswordMutation.mutate({
      current_password: passwords.current_password,
      new_password: passwords.new_password,
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your profile, security, and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-violet-400" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-white font-medium">{user?.full_name}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={user?.is_verified ? 'success' : 'warning'}>
                    {user?.is_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                  <Badge variant="default">{user?.role}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                leftIcon={<User className="w-4 h-4" />}
              />
              <Input
                label="Email"
                type="email"
                value={profile.email}
                disabled
                leftIcon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={updateProfileMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-400" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="New Password"
                type="password"
                value={passwords.new_password}
                onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))}
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwords.confirm_password}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm_password: e.target.value }))}
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                isLoading={changePasswordMutation.isPending}
                disabled={!passwords.current_password || !passwords.new_password}
              >
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-400" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Theme</p>
                <p className="text-sm text-gray-400">Choose your preferred theme</p>
              </div>
              <div className="flex gap-2">
                {['dark', 'light', 'system'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setPreferences((p) => ({ ...p, theme: theme as any }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      preferences.theme === theme
                        ? 'bg-violet-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-sm text-gray-400">Receive updates about your account</p>
              </div>
              <button
                onClick={() => setPreferences((p) => ({ ...p, notifications: !p.notifications }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.notifications ? 'bg-violet-500' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.notifications ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Section */}
      {user?.organization_name && (
        <Card variant="bordered" padding="md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{user.organization_name}</p>
                <p className="text-sm text-gray-400">Your organization workspace</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card variant="bordered" padding="md" className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Delete Account</p>
              <p className="text-sm text-gray-400">
                Permanently delete your account and all data. This action cannot be undone.
              </p>
            </div>
            <Button variant="danger">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
