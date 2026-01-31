'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, TrendingUp, FileText, User, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import type { SearchResult } from '@/lib/types'
import { debounce } from '@/lib/utils'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setSearched(false)
        return
      }

      setLoading(true)
      try {
        const data = await db.search(searchQuery)
        setResults(data)
        setSearched(true)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  useEffect(() => {
    performSearch(query)
  }, [query, performSearch])

  const getIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <TrendingUp className="h-4 w-4" />
      case 'note':
        return <FileText className="h-4 w-4" />
      case 'influencer':
        return <User className="h-4 w-4" />
      default:
        return null
    }
  }

  const getLink = (result: SearchResult) => {
    switch (result.type) {
      case 'trade':
      case 'note':
        return `/trades/${result.id}`
      case 'influencer':
        return `/influencers`
      default:
        return '#'
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'trade':
        return 'bg-blue-500/10 text-blue-500'
      case 'note':
        return 'bg-purple-500/10 text-purple-500'
      case 'influencer':
        return 'bg-green-500/10 text-green-500'
      default:
        return ''
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Search</h1>
          <p className="text-muted-foreground">
            Find trades, notes, and influencers
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search for tokens, trades, notes, influencers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 h-14 text-lg"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-2">
        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try searching for a different term
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            {results.map((result, index) => (
              <Link key={`${result.type}-${result.id}-${index}`} href={getLink(result)}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 bg-muted flex items-center justify-center">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.title}</span>
                        <Badge variant="outline" className={getTypeBadgeColor(result.type)}>
                          {result.type}
                        </Badge>
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-muted-foreground">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </>
        )}

        {!loading && !searched && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Start typing to search across all your trading data</p>
          </div>
        )}
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="text-center text-sm text-muted-foreground">
        <kbd className="px-2 py-1 rounded border bg-muted text-xs">⌘</kbd>
        {' + '}
        <kbd className="px-2 py-1 rounded border bg-muted text-xs">K</kbd>
        {' to open search from anywhere'}
      </div>
    </div>
  )
}
