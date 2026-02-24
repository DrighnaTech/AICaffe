'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Copy, Check, Trash2, Eye, EyeOff, AlertTriangle, Clock
} from 'lucide-react'
import { authApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatRelativeTime, copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { ApiKey } from '@/lib/types'

export default function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null)

  // Fetch API keys
  const { data: keysData, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => authApi.me().then(() => {
      // Mock API keys for now - replace with actual API call
      return { data: [] }
    }),
  })

  const rawData = keysData?.data as any
  const apiKeys: ApiKey[] = Array.isArray(rawData) ? rawData : (rawData?.api_keys || rawData?.items || [])

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      // This would be the actual API call
      const response = await fetch('/api/v1/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error('Failed to create API key')
      return response.json()
    },
    onSuccess: (data) => {
      setNewKeyValue(data.key)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create API key')
    },
  })

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/v1/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to delete API key')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setDeleteKeyId(null)
      toast.success('API key deleted')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete API key')
    },
  })

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for your API key')
      return
    }
    createKeyMutation.mutate(newKeyName)
  }

  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedId(id)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setNewKeyName('')
    setNewKeyValue(null)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-gray-400 mt-1">
            Manage your API keys for programmatic access
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create New Key
        </Button>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-400 font-medium">Keep your API keys secure</p>
          <p className="text-sm text-gray-400 mt-1">
            API keys provide full access to your account. Never share them publicly or commit them to version control.
            Rotate keys regularly and delete unused ones.
          </p>
        </div>
      </div>

      {/* API Keys List */}
      <Card variant="bordered" padding="none">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-400" />
            Your API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500 mx-auto" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center">
              <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No API keys yet</p>
              <p className="text-gray-500 text-sm">Create your first API key to get started</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create API Key
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-violet-500/20 rounded-lg">
                      <Key className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{key.name}</p>
                      <p className="text-sm text-gray-500 font-mono">
                        {key.key_prefix}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      {key.last_used_at ? (
                        <p className="text-gray-400">
                          Used {formatRelativeTime(key.last_used_at)}
                        </p>
                      ) : (
                        <p className="text-gray-500">Never used</p>
                      )}
                      {key.expires_at && (
                        <p className="text-gray-500 text-xs">
                          Expires {formatRelativeTime(key.expires_at)}
                        </p>
                      )}
                    </div>
                    <Badge variant={key.is_active ? 'success' : 'danger'}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteKeyId(key.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            Use your API key in the Authorization header:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <pre className="text-gray-300 overflow-x-auto">
{`curl -X POST https://api.aicaffe.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            </pre>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => handleCopy(
              `curl -X POST https://api.aicaffe.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model_id": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'`,
              'example'
            )}
            leftIcon={copiedId === 'example' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copiedId === 'example' ? 'Copied!' : 'Copy Example'}
          </Button>
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={closeCreateModal}
        title={newKeyValue ? 'API Key Created' : 'Create New API Key'}
        size="md"
      >
        {newKeyValue ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 text-sm mb-2">
                Your new API key has been created. Copy it now - you won&apos;t be able to see it again!
              </p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
                <code className="flex-1 text-white font-mono text-sm break-all">
                  {newKeyValue}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(newKeyValue, 'new-key')}
                >
                  {copiedId === 'new-key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={closeCreateModal}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Key Name"
              placeholder="e.g., Production API Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              leftIcon={<Key className="w-4 h-4" />}
            />
            <p className="text-sm text-gray-400">
              Give your key a descriptive name to help you remember what it&apos;s used for.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleCreateKey}
                isLoading={createKeyMutation.isPending}
              >
                Create Key
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteKeyId}
        onOpenChange={() => setDeleteKeyId(null)}
        title="Delete API Key"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Are you sure you want to delete this API key? Any applications using this key will stop working immediately.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteKeyId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => deleteKeyId && deleteKeyMutation.mutate(deleteKeyId)}
              isLoading={deleteKeyMutation.isPending}
            >
              Delete Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
