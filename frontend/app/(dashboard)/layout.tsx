'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { authApi, tokensApi } from '@/lib/api'

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
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const setBalance = useWalletStore((s) => s.setBalance)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (!token) return

    // Restore user from token if not already in store (e.g. hard refresh)
    const userRestore = user
      ? Promise.resolve()
      : authApi.me()
          .then((res) => {
            const userData = res.data?.user || res.data
            if (userData?.id) login(token, userData)
          })
          .catch(() => {
            logout()
          })

    // Fetch real wallet balance
    const walletFetch = tokensApi
      .wallet()
      .then((res) => {
        const w = res.data
        const balance = w?.balance ?? w?.token_balance ?? w?.data?.balance ?? 0
        setBalance(Number(balance))
      })
      .catch(() => {
        // wallet fetch failed — leave at 0, non-blocking
      })

    Promise.all([userRestore, walletFetch]).catch(() => {})
  }, []) // run once per layout mount (persists across client-side navigations)

  useEffect(() => {
    if (mounted && !token) {
      router.push('/login')
    }
  }, [mounted, token, router])

  // Redirect non-admin users from admin-only routes
  useEffect(() => {
    if (mounted && user && user.role !== 'admin') {
      const isAdminRoute = ADMIN_ONLY_ROUTES.some(
        (route) => pathname === route || pathname?.startsWith(route + '/')
      )
      if (isAdminRoute) {
        router.push('/dashboard')
      }
    }
  }, [mounted, user, pathname, router])

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
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
