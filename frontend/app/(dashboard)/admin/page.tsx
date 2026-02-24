'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, DollarSign, Bot, Coins, TrendingUp, TrendingDown,
  BarChart3, Activity, Server, Shield, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, Download, Filter,
  ChevronRight, Eye, Settings, Globe, Zap, Database
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend
} from 'recharts'
import { formatNumber, formatCurrency } from '@/lib/utils'

// Mock data for admin dashboard
const revenueData = [
  { date: '2024-01', revenue: 45000, users: 1200, tokens: 15000000 },
  { date: '2024-02', revenue: 52000, users: 1450, tokens: 18500000 },
  { date: '2024-03', revenue: 48000, users: 1380, tokens: 17200000 },
  { date: '2024-04', revenue: 61000, users: 1620, tokens: 22100000 },
  { date: '2024-05', revenue: 55000, users: 1510, tokens: 19800000 },
  { date: '2024-06', revenue: 67000, users: 1850, tokens: 24500000 },
  { date: '2024-07', revenue: 72000, users: 2100, tokens: 28000000 },
  { date: '2024-08', revenue: 78000, users: 2350, tokens: 31200000 },
  { date: '2024-09', revenue: 85000, users: 2680, tokens: 35500000 },
  { date: '2024-10', revenue: 92000, users: 2950, tokens: 39800000 },
  { date: '2024-11', revenue: 98000, users: 3200, tokens: 43100000 },
  { date: '2024-12', revenue: 112000, users: 3580, tokens: 48500000 },
]

const planDistribution = [
  { name: 'Free', value: 45, color: '#6b7280' },
  { name: 'Starter', value: 28, color: '#8b5cf6' },
  { name: 'Explorer', value: 18, color: '#06b6d4' },
  { name: 'Builder', value: 9, color: '#10b981' },
]

const modelUsage = [
  { name: 'GPT-4o', usage: 32, revenue: 45000, color: '#10b981' },
  { name: 'Claude 3.5', usage: 28, revenue: 38000, color: '#8b5cf6' },
  { name: 'Gemini Pro', usage: 15, revenue: 18000, color: '#06b6d4' },
  { name: 'DALL-E 3', usage: 12, revenue: 22000, color: '#f59e0b' },
  { name: 'Llama 3.3', usage: 8, revenue: 8000, color: '#ef4444' },
  { name: 'Others', usage: 5, revenue: 5000, color: '#6b7280' },
]

const recentUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', plan: 'Builder', spent: 2450, joinedAt: '2024-12-01' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', plan: 'Explorer', spent: 890, joinedAt: '2024-12-05' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', plan: 'Starter', spent: 245, joinedAt: '2024-12-08' },
  { id: '4', name: 'Sarah Wilson', email: 'sarah@example.com', plan: 'Builder', spent: 3200, joinedAt: '2024-12-10' },
  { id: '5', name: 'Alex Brown', email: 'alex@example.com', plan: 'Free', spent: 0, joinedAt: '2024-12-12' },
]

const systemAlerts = [
  { id: '1', type: 'warning', message: 'OpenAI API latency increased by 15%', time: '5 min ago' },
  { id: '2', type: 'info', message: 'New model Claude 3.5 Opus added', time: '1 hour ago' },
  { id: '3', type: 'success', message: 'Database backup completed', time: '3 hours ago' },
  { id: '4', type: 'error', message: 'Failed to sync with Anthropic API', time: '6 hours ago' },
]

const apiProviderStatus = [
  { name: 'OpenAI', status: 'operational', latency: 245, uptime: 99.9 },
  { name: 'Anthropic', status: 'degraded', latency: 380, uptime: 98.5 },
  { name: 'Google AI', status: 'operational', latency: 198, uptime: 99.8 },
  { name: 'Mistral', status: 'operational', latency: 165, uptime: 99.7 },
  { name: 'Meta', status: 'operational', latency: 210, uptime: 99.6 },
  { name: 'Cohere', status: 'operational', latency: 225, uptime: 99.4 },
]

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('30d')

  // In production, this would fetch real data
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['admin-stats', dateRange],
    queryFn: async () => {
      // Mock API call
      return {
        totalRevenue: 865000,
        revenueChange: 18.5,
        totalUsers: 3580,
        usersChange: 12.3,
        activeUsers: 2845,
        activeUsersChange: 8.7,
        totalTokensSold: 485000000,
        tokensChange: 22.1,
        avgRevenuePerUser: 241.62,
        churnRate: 2.4,
        platformMargin: 28.5,
        apiCosts: 618575,
      }
    }
  })

  const stats = statsData || {
    totalRevenue: 0,
    revenueChange: 0,
    totalUsers: 0,
    usersChange: 0,
    activeUsers: 0,
    activeUsersChange: 0,
    totalTokensSold: 0,
    tokensChange: 0,
    avgRevenuePerUser: 0,
    churnRate: 0,
    platformMargin: 0,
    apiCosts: 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-400" />
            Admin Dashboard
          </h1>
          <p className="text-gray-400 mt-1">SaaS platform management and analytics</p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={dateRange}
            onValueChange={setDateRange}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: 'ytd', label: 'Year to date' },
              { value: 'all', label: 'All time' },
            ]}
            className="w-40"
          />
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button variant="primary" leftIcon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          change={stats.revenueChange}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
        />
        <MetricCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          change={stats.usersChange}
          icon={<Users className="w-5 h-5" />}
          color="violet"
        />
        <MetricCard
          title="Tokens Sold"
          value={`${formatNumber(stats.totalTokensSold / 1000000)}M`}
          change={stats.tokensChange}
          icon={<Coins className="w-5 h-5" />}
          color="cyan"
        />
        <MetricCard
          title="Platform Margin"
          value={`${stats.platformMargin}%`}
          change={stats.platformMargin - 20}
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
          subtitle={`API costs: ${formatCurrency(stats.apiCosts)}`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="bordered" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Users</p>
              <p className="text-xl font-bold text-white mt-1">{formatNumber(stats.activeUsers)}</p>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-emerald-400">+{stats.activeUsersChange}%</span>
            <span className="text-xs text-gray-500">from last month</span>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Revenue/User</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(stats.avgRevenuePerUser)}</p>
            </div>
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-violet-400" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Churn Rate</p>
              <p className="text-xl font-bold text-white mt-1">{stats.churnRate}%</p>
            </div>
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-gray-500">Target: &lt;3%</span>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">API Uptime</p>
              <p className="text-xl font-bold text-white mt-1">99.8%</p>
            </div>
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Server className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-emerald-400">All systems operational</span>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card variant="bordered" padding="md" className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Revenue & Growth
              </span>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500" /> Revenue
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-violet-500" /> Users
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="users" stroke="#8b5cf6" fill="url(#colorUsers)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => [`${value}%`, 'Users']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {planDistribution.map((plan) => (
                <div key={plan.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                  <span className="text-xs text-gray-400">{plan.name} ({plan.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Usage & Provider Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Model Usage Distribution
              </span>
              <Link href="/admin/models" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={modelUsage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value, name) => [name === 'usage' ? `${value}%` : formatCurrency(value as number), name]}
                />
                <Bar dataKey="usage" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* API Provider Status */}
        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                API Provider Status
              </span>
              <Link href="/admin/providers" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                Manage <ChevronRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiProviderStatus.map((provider) => (
                <div key={provider.name} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      provider.status === 'operational' ? 'bg-emerald-400' :
                      provider.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                    <span className="text-white font-medium">{provider.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">{provider.latency}ms</span>
                    <span className="text-gray-400">{provider.uptime}%</span>
                    <Badge
                      variant={provider.status === 'operational' ? 'success' : provider.status === 'degraded' ? 'warning' : 'danger'}
                    >
                      {provider.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card variant="bordered" padding="none">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-400" />
                Recent Users
              </span>
              <Link href="/admin/users" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Plan</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/30">
                    <td className="px-6 py-3">
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={
                        user.plan === 'Builder' ? 'success' :
                        user.plan === 'Explorer' ? 'info' :
                        user.plan === 'Starter' ? 'warning' : 'default'
                      }>
                        {user.plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right text-white">
                      {formatCurrency(user.spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card variant="bordered" padding="md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                System Alerts
              </span>
              <Link href="/admin/logs" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View Logs <ChevronRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className={`p-1.5 rounded-lg ${
                    alert.type === 'error' ? 'bg-red-500/20' :
                    alert.type === 'warning' ? 'bg-yellow-500/20' :
                    alert.type === 'success' ? 'bg-green-500/20' : 'bg-blue-500/20'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${
                      alert.type === 'error' ? 'text-red-400' :
                      alert.type === 'warning' ? 'text-yellow-400' :
                      alert.type === 'success' ? 'text-green-400' : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="bordered" padding="md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <QuickActionButton icon={<Users />} label="Manage Users" href="/admin/users" />
            <QuickActionButton icon={<Bot />} label="Manage Models" href="/admin/models" />
            <QuickActionButton icon={<Globe />} label="API Providers" href="/admin/providers" />
            <QuickActionButton icon={<Coins />} label="Token Pricing" href="/admin/pricing" />
            <QuickActionButton icon={<Database />} label="Database" href="/admin/database" />
            <QuickActionButton icon={<Settings />} label="Settings" href="/admin/settings" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  change,
  icon,
  color,
  subtitle
}: {
  title: string
  value: string
  change: number
  icon: React.ReactNode
  color: 'emerald' | 'violet' | 'cyan' | 'amber'
  subtitle?: string
}) {
  const isPositive = change >= 0
  const colorClasses = {
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  }

  return (
    <Card variant="bordered" padding="md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color].bg}`}>
          <span className={colorClasses[color].text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className={`flex items-center text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}%
        </span>
        {subtitle ? (
          <span className="text-xs text-gray-500">{subtitle}</span>
        ) : (
          <span className="text-xs text-gray-500">vs last period</span>
        )}
      </div>
    </Card>
  )
}

function QuickActionButton({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-800 hover:border-gray-600 transition-all"
    >
      <span className="text-violet-400">{icon}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </Link>
  )
}
