'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, User, Settings, LogOut, Coins, ChevronDown, Key, HelpCircle, Cloud } from 'lucide-react'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { formatNumber, tokensToUsd, formatCurrency } from '@/lib/utils'

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { balance } = useWalletStore()
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Generate breadcrumb from pathname
  const getBreadcrumb = () => {
    if (!pathname) return 'Dashboard'
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return 'Dashboard'
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ')
  }

  return (
    <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-950/80 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="text-white font-medium">{getBreadcrumb()}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Token Balance Quick View */}
        <Link
          href="/tokens"
          className="flex items-center gap-2 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-lg px-3 py-1.5 border border-violet-500/20 hover:border-violet-500/40 transition-colors"
        >
          <Coins className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white">{formatNumber(balance)} ACT</span>
          <span className="text-xs text-gray-500">≈{formatCurrency(tokensToUsd(balance))}</span>
        </Link>

        {/* CaffeSpace Storage */}
        <Link
          href="/storage"
          className="flex items-center gap-2 p-2 text-gray-400 hover:text-white transition-colors"
          title="CaffeSpace Storage"
        >
          <Cloud className="w-5 h-5" />
        </Link>

        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
        </button>

        {/* Help */}
        <Link href="/docs" className="p-2 text-gray-400 hover:text-white transition-colors">
          <HelpCircle className="w-5 h-5" />
        </Link>

        {/* Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-800">
                <div className="font-medium text-white">{user?.full_name || 'User'}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
                {user?.organization_name && (
                  <div className="text-xs text-violet-400 mt-1">{user.organization_name}</div>
                )}
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Account Settings
                </Link>
                <Link
                  href="/settings/api-keys"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <Key className="w-4 h-4" /> API Keys
                </Link>
                <Link
                  href="/billing"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <User className="w-4 h-4" /> Billing & Usage
                </Link>
              </div>

              <div className="border-t border-gray-800 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors w-full"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
