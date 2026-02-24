'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cloud, Upload, Download, Trash2, FolderPlus, File, Image, FileText,
  Video, Music, Archive, MoreVertical, Search, Grid3X3, List, SortAsc,
  SortDesc, Filter, RefreshCw, Share2, Lock, Eye, EyeOff, Link2, Copy,
  Check, X, ChevronRight, HardDrive, AlertTriangle, Plus, Settings,
  FileCode, FileSpreadsheet, Presentation
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils'
import toast from 'react-hot-toast'

interface StorageFile {
  id: string
  name: string
  type: 'file' | 'folder'
  mime_type?: string
  size: number
  created_at: string
  updated_at: string
  parent_id?: string | null
  is_public: boolean
  share_url?: string
  thumbnail_url?: string
  download_url?: string
}

interface StorageQuota {
  used: number
  limit: number
  tier: 'free' | 'starter' | 'explorer' | 'builder'
}

// File type icons
const getFileIcon = (mimeType?: string, name?: string) => {
  if (!mimeType && name) {
    const ext = name.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image className="w-5 h-5 text-pink-400" />
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) return <Video className="w-5 h-5 text-orange-400" />
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return <Music className="w-5 h-5 text-cyan-400" />
    if (['pdf'].includes(ext || '')) return <FileText className="w-5 h-5 text-red-400" />
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="w-5 h-5 text-blue-400" />
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet className="w-5 h-5 text-green-400" />
    if (['ppt', 'pptx'].includes(ext || '')) return <Presentation className="w-5 h-5 text-orange-400" />
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return <Archive className="w-5 h-5 text-yellow-400" />
    if (['js', 'ts', 'py', 'java', 'cpp', 'go', 'rs'].includes(ext || '')) return <FileCode className="w-5 h-5 text-violet-400" />
  }

  if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-pink-400" />
  if (mimeType?.startsWith('video/')) return <Video className="w-5 h-5 text-orange-400" />
  if (mimeType?.startsWith('audio/')) return <Music className="w-5 h-5 text-cyan-400" />
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />

  return <File className="w-5 h-5 text-gray-400" />
}

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Storage tier pricing
const storageTiers = [
  { limit: 1, price: 0, label: 'Free (1 GB)' },
  { limit: 5, price: 5, label: '+4 GB ($5/mo)' },
  { limit: 10, price: 10, label: '+5 GB ($10/mo)' },
  { limit: 15, price: 15, label: '+5 GB ($15/mo)' }
]

export default function StoragePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My CaffeSpace' }
  ])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareFile, setShareFile] = useState<StorageFile | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  // Fetch files
  const { data: filesData, isLoading: isLoadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ['storage-files', currentFolder],
    queryFn: async () => {
      const response = await fetch(`/api/v1/storage/files?parent_id=${currentFolder || ''}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch files')
      return response.json()
    }
  })

  // Fetch quota
  const { data: quotaData } = useQuery({
    queryKey: ['storage-quota'],
    queryFn: async () => {
      const response = await fetch('/api/v1/storage/quota', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch quota')
      return response.json()
    }
  })

  const files: StorageFile[] = filesData?.data?.files || filesData?.data?.items || (Array.isArray(filesData?.data) ? filesData.data : [])
  const quota: StorageQuota = quotaData?.data || { used: 0, limit: 1 * 1024 * 1024 * 1024, tier: 'free' }

  // Filter and sort files
  const filteredFiles = files
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1

      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'date') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (sortBy === 'size') {
        comparison = a.size - b.size
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/v1/storage/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        },
        body: formData
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }
      return response.json()
    },
    onSuccess: () => {
      refetchFiles()
      queryClient.invalidateQueries({ queryKey: ['storage-quota'] })
      toast.success('File uploaded successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Upload failed')
    }
  })

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/v1/storage/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        },
        body: JSON.stringify({ name, parent_id: currentFolder })
      })
      if (!response.ok) throw new Error('Failed to create folder')
      return response.json()
    },
    onSuccess: () => {
      refetchFiles()
      setShowNewFolderModal(false)
      setNewFolderName('')
      toast.success('Folder created')
    },
    onError: () => {
      toast.error('Failed to create folder')
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch('/api/v1/storage/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        },
        body: JSON.stringify({ ids })
      })
      if (!response.ok) throw new Error('Failed to delete')
      return response.json()
    },
    onSuccess: () => {
      refetchFiles()
      queryClient.invalidateQueries({ queryKey: ['storage-quota'] })
      setSelectedFiles([])
      toast.success('Deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete')
    }
  })

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const response = await fetch(`/api/v1/storage/files/${id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aicaffe_token')}`
        },
        body: JSON.stringify({ is_public: isPublic })
      })
      if (!response.ok) throw new Error('Failed to update sharing')
      return response.json()
    },
    onSuccess: (data) => {
      refetchFiles()
      if (shareFile) {
        setShareFile({ ...shareFile, is_public: data.is_public, share_url: data.share_url })
      }
      toast.success('Sharing updated')
    },
    onError: () => {
      toast.error('Failed to update sharing')
    }
  })

  // Handle file upload
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const totalSize = Array.from(fileList).reduce((acc, f) => acc + f.size, 0)
    if (quota.used + totalSize > quota.limit) {
      setShowUpgradeModal(true)
      return
    }

    for (const file of Array.from(fileList)) {
      const formData = new FormData()
      formData.append('file', file)
      if (currentFolder) {
        formData.append('parent_id', currentFolder)
      }
      uploadMutation.mutate(formData)
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }, [currentFolder, quota])

  // Navigate to folder
  const navigateToFolder = (folder: StorageFile) => {
    setCurrentFolder(folder.id)
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }])
    setSelectedFiles([])
  }

  // Navigate via breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index]
    setCurrentFolder(crumb.id)
    setBreadcrumbs(prev => prev.slice(0, index + 1))
    setSelectedFiles([])
  }

  // Toggle file selection
  const toggleSelection = (id: string) => {
    setSelectedFiles(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  // Open share modal
  const openShareModal = (file: StorageFile) => {
    setShareFile(file)
    setShowShareModal(true)
  }

  // Copy share link
  const copyShareLink = async () => {
    if (shareFile?.share_url) {
      await copyToClipboard(shareFile.share_url)
      toast.success('Link copied to clipboard')
    }
  }

  const usagePercent = Math.min((quota.used / quota.limit) * 100, 100)
  const isNearLimit = usagePercent > 80

  return (
    <div
      className="space-y-6 max-w-7xl"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl">
            <Cloud className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CaffeSpace</h1>
            <p className="text-gray-400 text-sm">Your AI workspace storage</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowNewFolderModal(true)}
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            New Folder
          </Button>
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Storage Usage */}
      <Card variant="bordered" padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-800 rounded-lg">
              <HardDrive className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Storage Used</p>
              <p className="text-lg font-semibold text-white">
                {formatFileSize(quota.used)} / {formatFileSize(quota.limit)}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-6">
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isNearLimit
                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                    : 'bg-gradient-to-r from-violet-500 to-cyan-500'
                }`}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              {usagePercent.toFixed(1)}% used
            </p>
          </div>

          <Button
            variant={isNearLimit ? 'primary' : 'outline'}
            onClick={() => setShowUpgradeModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {isNearLimit ? 'Upgrade Now' : 'Get More Space'}
          </Button>
        </div>

        {isNearLimit && (
          <div className="mt-4 flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-orange-400 font-medium">Running low on storage</p>
              <p className="text-xs text-gray-400">
                You&apos;re using {usagePercent.toFixed(0)}% of your storage. Upgrade to get more space.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-4 h-4 text-gray-600" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`px-2 py-1 rounded hover:bg-gray-800 transition-colors ${
                  i === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-gray-400'
                }`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'date', label: 'Date' },
              { value: 'size', label: 'Size' }
            ]}
            className="w-28"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </Button>

          <div className="w-px h-6 bg-gray-700" />

          <Button
            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-gray-700" />

          <Button variant="ghost" size="sm" onClick={() => refetchFiles()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Selected Actions */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl"
          >
            <span className="text-sm text-white">
              {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate(selectedFiles)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-950/80 flex items-center justify-center"
          >
            <div className="p-12 border-4 border-dashed border-violet-500 rounded-2xl text-center">
              <Upload className="w-16 h-16 text-violet-400 mx-auto mb-4" />
              <p className="text-xl font-semibold text-white">Drop files to upload</p>
              <p className="text-gray-400 mt-2">Files will be uploaded to current folder</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files */}
      {isLoadingFiles ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-20">
          <Cloud className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-white mb-2">
            {searchQuery ? 'No files found' : 'No files yet'}
          </p>
          <p className="text-gray-400 mb-6">
            {searchQuery
              ? 'Try a different search term'
              : 'Upload files or create a folder to get started'}
          </p>
          {!searchQuery && (
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Upload Files
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`group relative p-4 bg-gray-900/50 border rounded-xl cursor-pointer transition-all ${
                selectedFiles.includes(file.id)
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => file.type === 'folder' ? navigateToFolder(file) : toggleSelection(file.id)}
            >
              {/* Checkbox */}
              <div
                className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  selectedFiles.includes(file.id)
                    ? 'bg-violet-500 border-violet-500'
                    : 'border-gray-600 opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelection(file.id)
                }}
              >
                {selectedFiles.includes(file.id) && <Check className="w-3 h-3 text-white" />}
              </div>

              {/* Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {file.type !== 'folder' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openShareModal(file)
                      }}
                      className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700"
                    >
                      <Share2 className="w-3 h-3 text-gray-400" />
                    </button>
                    <a
                      href={file.download_url}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700"
                    >
                      <Download className="w-3 h-3 text-gray-400" />
                    </a>
                  </>
                )}
              </div>

              {/* Preview/Icon */}
              <div className="aspect-square flex items-center justify-center mb-3">
                {file.type === 'folder' ? (
                  <div className="w-16 h-16 bg-violet-500/20 rounded-xl flex items-center justify-center">
                    <FolderPlus className="w-8 h-8 text-violet-400" />
                  </div>
                ) : file.thumbnail_url ? (
                  <img
                    src={file.thumbnail_url}
                    alt={file.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center">
                    {getFileIcon(file.mime_type, file.name)}
                  </div>
                )}
              </div>

              {/* Info */}
              <p className="text-sm text-white truncate font-medium">{file.name}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {file.type === 'folder' ? 'Folder' : formatFileSize(file.size)}
                </p>
                {file.is_public && (
                  <Badge variant="info" className="text-xs py-0">
                    Public
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card variant="bordered" padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Modified</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  className={`hover:bg-gray-800/30 cursor-pointer ${
                    selectedFiles.includes(file.id) ? 'bg-violet-500/10' : ''
                  }`}
                  onClick={() => file.type === 'folder' ? navigateToFolder(file) : toggleSelection(file.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-600 text-violet-500 focus:ring-violet-500"
                      />
                      {file.type === 'folder' ? (
                        <FolderPlus className="w-5 h-5 text-violet-400" />
                      ) : (
                        getFileIcon(file.mime_type, file.name)
                      )}
                      <span className="text-white">{file.name}</span>
                      {file.is_public && (
                        <Badge variant="info" className="text-xs">Public</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {file.type === 'folder' ? '-' : formatFileSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatRelativeTime(file.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {file.type !== 'folder' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openShareModal(file)
                            }}
                            className="p-1.5 hover:bg-gray-700 rounded"
                          >
                            <Share2 className="w-4 h-4 text-gray-400" />
                          </button>
                          <a
                            href={file.download_url}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-gray-700 rounded"
                          >
                            <Download className="w-4 h-4 text-gray-400" />
                          </a>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMutation.mutate([file.id])
                        }}
                        className="p-1.5 hover:bg-gray-700 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* New Folder Modal */}
      <Modal
        open={showNewFolderModal}
        onOpenChange={() => setShowNewFolderModal(false)}
        title="Create New Folder"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="My Folder"
            leftIcon={<FolderPlus className="w-4 h-4" />}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowNewFolderModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => createFolderMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim()}
              isLoading={createFolderMutation.isPending}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        open={showShareModal}
        onOpenChange={() => setShowShareModal(false)}
        title="Share File"
        size="md"
      >
        {shareFile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              {getFileIcon(shareFile.mime_type, shareFile.name)}
              <div>
                <p className="text-white font-medium">{shareFile.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(shareFile.size)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                {shareFile.is_public ? (
                  <Eye className="w-5 h-5 text-green-400" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-white font-medium">
                    {shareFile.is_public ? 'Public Link' : 'Private'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {shareFile.is_public
                      ? 'Anyone with the link can view'
                      : 'Only you can access this file'}
                  </p>
                </div>
              </div>
              <Button
                variant={shareFile.is_public ? 'outline' : 'primary'}
                size="sm"
                onClick={() => shareMutation.mutate({ id: shareFile.id, isPublic: !shareFile.is_public })}
                isLoading={shareMutation.isPending}
              >
                {shareFile.is_public ? 'Make Private' : 'Create Link'}
              </Button>
            </div>

            {shareFile.is_public && shareFile.share_url && (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-800 rounded-lg">
                  <code className="text-sm text-gray-300 break-all">{shareFile.share_url}</code>
                </div>
                <Button variant="primary" size="sm" onClick={copyShareLink}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Upgrade Modal */}
      <Modal
        open={showUpgradeModal}
        onOpenChange={() => setShowUpgradeModal(false)}
        title="Get More Storage"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Upgrade your CaffeSpace storage to save more files, images, and AI creations.
          </p>

          <div className="space-y-3">
            {storageTiers.map((tier, i) => (
              <div
                key={tier.limit}
                className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${
                  quota.limit === tier.limit * 1024 * 1024 * 1024
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-violet-400" />
                  <div>
                    <p className="text-white font-medium">{tier.limit} GB</p>
                    <p className="text-xs text-gray-400">{tier.label}</p>
                  </div>
                </div>
                {quota.limit === tier.limit * 1024 * 1024 * 1024 ? (
                  <Badge variant="success">Current Plan</Badge>
                ) : i > 0 ? (
                  <Button variant="outline" size="sm">
                    ${tier.price}/mo
                  </Button>
                ) : (
                  <Badge variant="default">Free</Badge>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 text-center">
            Storage is billed monthly. You can upgrade or downgrade anytime.
          </p>
        </div>
      </Modal>
    </div>
  )
}
