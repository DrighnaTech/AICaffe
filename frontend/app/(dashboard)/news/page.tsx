'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper, TrendingUp, Zap, Clock, Bookmark, BookmarkCheck,
  ExternalLink, Filter, Search, RefreshCw, Loader2, ChevronRight,
  Calendar, Tag, Star, AlertCircle, Hash
} from 'lucide-react'
import { newsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime, formatDate } from '@/lib/utils'

type NewsCategory = 'all' | 'models' | 'research' | 'business' | 'policy' | 'tutorials'

const CATEGORIES: { id: NewsCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All News', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'models', label: 'New Models', icon: <Zap className="w-4 h-4" /> },
  { id: 'research', label: 'Research', icon: <Star className="w-4 h-4" /> },
  { id: 'business', label: 'Business', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'policy', label: 'Policy & Safety', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'tutorials', label: 'Tutorials', icon: <Hash className="w-4 h-4" /> },
]

interface NewsArticle {
  id: string
  title: string
  summary: string
  source: string
  source_url?: string
  url: string
  image_url?: string
  category: string
  tags: string[]
  published_at: string
  is_breaking?: boolean
  is_bookmarked?: boolean
  relevance_score?: number
}

export default function NewsPage() {
  const [category, setCategory] = useState<NewsCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: feedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['news', 'feed', category, searchQuery],
    queryFn: () => newsApi.feed({ category: category === 'all' ? undefined : category, search: searchQuery || undefined }),
  })

  const { data: trendingData } = useQuery({
    queryKey: ['news', 'trending'],
    queryFn: () => newsApi.trending(),
  })

  const { data: breakingData } = useQuery({
    queryKey: ['news', 'breaking'],
    queryFn: () => newsApi.breaking(),
  })

  const bookmarkMutation = useMutation({
    mutationFn: (id: string) => newsApi.bookmark(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] })
    },
  })

  const articles: NewsArticle[] = feedData?.data?.articles || []
  const trending = trendingData?.data?.topics || []
  const breaking = breakingData?.data?.articles || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-violet-400" />
            AI News Feed
          </h1>
          <p className="text-gray-400 mt-1">Stay updated with the latest in AI</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Breaking News Banner */}
      {breaking.length > 0 && (
        <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                <Zap className="w-3 h-3 mr-1" /> Breaking
              </Badge>
              <div className="flex-1 overflow-hidden">
                <marquee className="text-white">
                  {breaking.map((item: NewsArticle) => item.title).join(' • ')}
                </marquee>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search news..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={category === cat.id ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setCategory(cat.id)}
                      className="whitespace-nowrap"
                    >
                      {cat.icon}
                      <span className="ml-1">{cat.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Articles List */}
          {isLoading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              </CardContent>
            </Card>
          ) : articles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No news articles found</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="popLayout">
              {articles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:border-gray-600 transition-colors group">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {article.image_url && (
                          <div className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                            <img
                              src={article.image_url}
                              alt={article.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {article.category || 'AI'}
                              </Badge>
                              {article.is_breaking && (
                                <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                                  Breaking
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">{article.source}</span>
                            </div>
                            <button
                              onClick={() => bookmarkMutation.mutate(article.id)}
                              className="text-gray-500 hover:text-violet-400 transition-colors"
                            >
                              {article.is_bookmarked ? (
                                <BookmarkCheck className="w-5 h-5 text-violet-400" />
                              ) : (
                                <Bookmark className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-1 group-hover:text-violet-400 transition-colors"
                          >
                            <h3 className="font-semibold text-white line-clamp-2">
                              {article.title}
                            </h3>
                          </a>
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                            {article.summary}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(article.published_at)}
                            </span>
                            {article.tags?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {article.tags.slice(0, 3).join(', ')}
                              </span>
                            )}
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-violet-400 hover:text-violet-300 ml-auto"
                            >
                              Read more <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Trending Topics */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                Trending Topics
              </h2>
            </CardHeader>
            <CardContent className="pt-0">
              {trending.length === 0 ? (
                <p className="text-sm text-gray-500">No trending topics</p>
              ) : (
                <ul className="space-y-2">
                  {trending.slice(0, 8).map((topic: any, index: number) => (
                    <li key={topic.id || index}>
                      <button
                        onClick={() => setSearchQuery(topic.name || topic)}
                        className="w-full flex items-center gap-2 text-left text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 text-xs text-gray-500">
                          {index + 1}
                        </span>
                        <span className="flex-1 truncate">{topic.name || topic}</span>
                        {topic.count && (
                          <span className="text-xs text-gray-600">{topic.count}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                AI Calendar
              </h2>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="p-2 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-500">Upcoming</div>
                <div className="text-sm text-white">GPT-5 Expected Release</div>
                <div className="text-xs text-gray-500">Q2 2025</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-500">Conference</div>
                <div className="text-sm text-white">NeurIPS 2025</div>
                <div className="text-xs text-gray-500">December 2025</div>
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-white">News Sources</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {['OpenAI Blog', 'Anthropic', 'Google AI', 'Meta AI', 'arXiv', 'TechCrunch', 'The Verge'].map((source) => (
                  <Badge key={source} variant="secondary" className="text-xs cursor-pointer hover:bg-gray-700">
                    {source}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
