'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/lib/store'

// Routes that only admins can access
const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/settings/api-keys',
  '/billing',
  '/agents',
  '/workspace',
  '/codespace',
  '/compare',
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, user } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !token) {
      router.push('/login')
    }
  }, [mounted, token, router])

  // Redirect non-admin users from admin-only routes
  useEffect(() => {
    if (mounted && user && user.role !== 'admin') {
      const isAdminRoute = ADMIN_ONLY_ROUTES.some(route =>
        pathname === route || pathname?.startsWith(route + '/')
      )
      if (isAdminRoute) {
        router.push('/dashboard')
      }
    }
  }, [mounted, user, pathname, router])

  // Always render the same structure initially to avoid hydration mismatch
  // Show loading spinner until mounted and auth is checked
  if (!mounted || !token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
