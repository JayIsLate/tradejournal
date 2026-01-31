'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  Trash2,
  Edit,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  Save,
  Tag,
  BookOpen,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, TradeFilters, TradeStatus, TokenNote, Tag as TagType, EmotionalState, TagCategory } from '@/lib/types'
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatMarketCap,
  getPnlColor,
  getStatusColor,
  getEmotionalStateColor,
  getCategoryColor,
  debounce,
  generateId,
  emotionalStates,
  tagCategories,
} from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TokenGroup {
  symbol: string
  name: string | null
  chain: string | null
  contractAddress: string | null
  image: string | null
  trades: Trade[]
  buys: Trade[]
  sells: Trade[]
  totalBought: number
  totalSold: number
  netQuantity: number
  avgBuyPrice: number
  avgSellPrice: number
  realizedPnl: number
  unrealizedValue: number
  hasOpenPositions: boolean
}

interface TokenJournalData {
  note: TokenNote | null
  tagIds: string[]
  thesis: string
  narrative: string
  reflection: string
  lessonsLearned: string
  confidenceLevel: number
  emotionalState: EmotionalState | ''
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TradeFilters>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set())
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Tags
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [showCreateTag, setShowCreateTag] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('narrative')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  // Token journal data (loaded per-token when expanded)
  const [tokenJournals, setTokenJournals] = useState<Record<string, TokenJournalData>>({})
  const [savingToken, setSavingToken] = useState<string | null>(null)

  const loadTrades = async (newFilters?: TradeFilters) => {
    setLoading(true)
    try {
      const [data, tags] = await Promise.all([
        db.getTrades(newFilters || filters),
        db.getTags(),
      ])
      setTrades(data)
      setAllTags(tags)
    } catch (error) {
      console.error('Failed to load trades:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrades()
  }, [])

  // Load journal data when a token is expanded
  const loadTokenJournal = useCallback(async (symbol: string) => {
    if (tokenJournals[symbol]) return // Already loaded

    try {
      const [note, tagIds] = await Promise.all([
        db.getTokenNote(symbol),
        db.getTokenTagIds(symbol),
      ])

      setTokenJournals(prev => ({
        ...prev,
        [symbol]: {
          note: note || null,
          tagIds,
          thesis: note?.thesis || '',
          narrative: note?.narrative || '',
          reflection: note?.reflection || '',
          lessonsLearned: note?.lessons_learned || '',
          confidenceLevel: note?.confidence_level || 5,
          emotionalState: note?.emotional_state || '',
        }
      }))
    } catch (error) {
      console.error('Failed to load token journal:', error)
    }
  }, [tokenJournals])

  const handleSearch = debounce((value: string) => {
    const newFilters = { ...filters, search: value || undefined }
    setFilters(newFilters)
    loadTrades(newFilters)
  }, 300)

  const handleStatusFilter = (status: string) => {
    const newFilters = { ...filters, status: status as TradeStatus || undefined }
    setFilters(newFilters)
    loadTrades(newFilters)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await db.deleteTrade(deleteId)
      setTrades(trades.filter(t => t.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      console.error('Failed to delete trade:', error)
    }
  }

  const toggleToken = async (symbol: string) => {
    const newExpanded = new Set(expandedTokens)
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol)
    } else {
      newExpanded.add(symbol)
      // Load journal data when expanding
      await loadTokenJournal(symbol)
    }
    setExpandedTokens(newExpanded)
  }

  const updateTokenJournal = (symbol: string, field: keyof TokenJournalData, value: any) => {
    setTokenJournals(prev => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [field]: value,
      }
    }))
  }

  const saveTokenJournal = async (symbol: string) => {
    const journal = tokenJournals[symbol]
    if (!journal) return

    setSavingToken(symbol)
    try {
      // Save note
      const noteData = {
        id: journal.note?.id || generateId(),
        token_symbol: symbol,
        thesis: journal.thesis || null,
        narrative: journal.narrative || null,
        reflection: journal.reflection || null,
        lessons_learned: journal.lessonsLearned || null,
        rich_content: null,
        confidence_level: journal.confidenceLevel,
        emotional_state: journal.emotionalState || null,
      }
      const savedNote = await db.upsertTokenNote(noteData)

      // Save tags
      await db.setTokenTags(symbol, journal.tagIds)

      // Update local state
      setTokenJournals(prev => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          note: savedNote,
        }
      }))
    } catch (error) {
      console.error('Failed to save token journal:', error)
    } finally {
      setSavingToken(null)
    }
  }

  const handleToggleTag = async (symbol: string, tagId: string) => {
    const journal = tokenJournals[symbol]
    if (!journal) return

    const newTags = journal.tagIds.includes(tagId)
      ? journal.tagIds.filter(id => id !== tagId)
      : [...journal.tagIds, tagId]

    updateTokenJournal(symbol, 'tagIds', newTags)
  }

  const handleCreateTag = async (forSymbol: string) => {
    if (!newTagName.trim()) return

    try {
      const newTag: TagType = {
        id: generateId(),
        name: newTagName.trim(),
        category: newTagCategory,
        parent_tag_id: null,
        color: newTagColor,
        created_at: new Date().toISOString(),
      }

      await db.createTag(newTag)
      setAllTags([...allTags, newTag])

      // Auto-select the new tag for this token
      const journal = tokenJournals[forSymbol]
      if (journal) {
        updateTokenJournal(forSymbol, 'tagIds', [...journal.tagIds, newTag.id])
      }

      // Reset form
      setNewTagName('')
      setNewTagCategory('narrative')
      setNewTagColor('#3b82f6')
      setShowCreateTag(null)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  // Filter out stablecoins and group trades by token symbol
  const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD', 'TUSD', 'FRAX']
  const filteredTrades = trades.filter(t => !stablecoins.includes(t.token_symbol.toUpperCase()))

  const tokenGroups: TokenGroup[] = Object.values(
    filteredTrades.reduce((groups: Record<string, TokenGroup>, trade) => {
      const key = trade.token_symbol.toUpperCase()

      if (!groups[key]) {
        groups[key] = {
          symbol: trade.token_symbol,
          name: trade.token_name,
          chain: trade.token_chain,
          contractAddress: trade.token_contract_address,
          image: trade.token_image,
          trades: [],
          buys: [],
          sells: [],
          totalBought: 0,
          totalSold: 0,
          netQuantity: 0,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          realizedPnl: 0,
          unrealizedValue: 0,
          hasOpenPositions: false,
        }
      }

      // Update contract address and image if not set
      if (!groups[key].contractAddress && trade.token_contract_address) {
        groups[key].contractAddress = trade.token_contract_address
      }
      if (!groups[key].image && trade.token_image) {
        groups[key].image = trade.token_image
      }

      groups[key].trades.push(trade)

      if (trade.direction === 'buy') {
        groups[key].buys.push(trade)
        groups[key].totalBought += trade.quantity
      } else {
        groups[key].sells.push(trade)
        groups[key].totalSold += trade.quantity
      }

      if (trade.status === 'open') {
        groups[key].hasOpenPositions = true
        groups[key].unrealizedValue += trade.total_value
      }

      return groups
    }, {})
  ).map(group => {
    // Calculate averages
    const buyTotal = group.buys.reduce((sum, t) => sum + t.total_value, 0)
    const sellTotal = group.sells.reduce((sum, t) => sum + t.total_value, 0)

    group.avgBuyPrice = group.totalBought > 0 ? buyTotal / group.totalBought : 0
    group.avgSellPrice = group.totalSold > 0 ? sellTotal / group.totalSold : 0
    group.netQuantity = group.totalBought - group.totalSold

    // Calculate realized PnL: (avg sell price - avg buy price) * quantity sold
    if (group.totalSold > 0 && group.avgBuyPrice > 0) {
      group.realizedPnl = (group.avgSellPrice - group.avgBuyPrice) * group.totalSold
    }

    // Sort trades by date
    group.trades.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    group.buys.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    group.sells.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())

    return group
  }).sort((a, b) => {
    // Sort by: open positions first, then by most recent trade
    if (a.hasOpenPositions && !b.hasOpenPositions) return -1
    if (!a.hasOpenPositions && b.hasOpenPositions) return 1
    const aLatest = Math.max(...a.trades.map(t => new Date(t.entry_date).getTime()))
    const bLatest = Math.max(...b.trades.map(t => new Date(t.entry_date).getTime()))
    return bLatest - aLatest
  })

  // Calculate total realized PnL across all positions
  const totalPnl = tokenGroups.reduce((sum, g) => sum + g.realizedPnl, 0)
  const openPositions = tokenGroups.filter(g => g.hasOpenPositions).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trades</h1>
          <p className="text-muted-foreground">
            {tokenGroups.length} tokens • {openPositions} with open positions •{' '}
            <span className={getPnlColor(totalPnl)}>{formatCurrency(totalPnl)} realized P&L</span>
          </p>
        </div>
        <Link href="/trades/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Trade
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by token symbol or name..."
                className="pl-9"
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Select
              value={filters.status || ''}
              onChange={(e) => handleStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="partial">Partial</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Token Groups */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : tokenGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No trades yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Import your trades from your wallet or add them manually to start tracking your performance.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/import">
                <Button>
                  Import from Wallet
                </Button>
              </Link>
              <Link href="/trades/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Manually
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tokenGroups.map((group) => {
            const isExpanded = expandedTokens.has(group.symbol)
            const journal = tokenJournals[group.symbol]

            return (
              <Card key={group.symbol} className="overflow-hidden">
                {/* Token Header - Clickable */}
                <div
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleToken(group.symbol)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>

                      {/* Token Image */}
                      {group.image ? (
                        <img
                          src={group.image}
                          alt={group.symbol}
                          className="w-10 h-10 object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                          {group.symbol.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{group.symbol}</span>
                          {group.name && (
                            <span className="text-muted-foreground">({group.name})</span>
                          )}
                          {group.hasOpenPositions && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              Open Position
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {group.chain && (
                            <span className="text-sm text-muted-foreground">{group.chain}</span>
                          )}
                          {group.contractAddress && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(group.contractAddress!)
                                setCopiedAddress(group.contractAddress)
                                setTimeout(() => setCopiedAddress(null), 2000)
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                              title="Click to copy address"
                            >
                              {group.contractAddress.slice(0, 4)}...{group.contractAddress.slice(-4)}
                              {copiedAddress === group.contractAddress ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 lg:gap-10">
                      {/* Buy/Sell Summary */}
                      <div className="flex items-center gap-4 text-sm min-w-[140px]">
                        <div className="flex items-center gap-1.5 text-green-500">
                          <TrendingUp className="h-4 w-4" />
                          <span>{group.buys.length} buys</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-red-500">
                          <TrendingDown className="h-4 w-4" />
                          <span>{group.sells.length} sells</span>
                        </div>
                      </div>

                      {/* Net Position */}
                      <div className="text-right min-w-[120px]">
                        <div className="text-sm text-muted-foreground">Net Position</div>
                        <div className="font-medium">
                          {group.netQuantity > 0 ? group.netQuantity.toLocaleString() : '—'}
                        </div>
                      </div>

                      {/* Realized P&L */}
                      <div className="text-right min-w-[110px]">
                        <div className="text-sm text-muted-foreground">Realized P&L</div>
                        <div className={`font-semibold ${getPnlColor(group.realizedPnl)}`}>
                          {formatCurrency(group.realizedPnl)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t">
                    <Tabs defaultValue="journal" className="w-full">
                      <div className="border-b bg-muted/30 px-4">
                        <TabsList className="bg-transparent h-12">
                          <TabsTrigger value="journal" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Journal
                          </TabsTrigger>
                          <TabsTrigger value="trades" className="gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Trades ({group.trades.length})
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* Journal Tab */}
                      <TabsContent value="journal" className="p-4 space-y-4 mt-0">
                        {journal ? (
                          <>
                            {/* Tags */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                  <Tag className="h-4 w-4" />
                                  Tags
                                </Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowCreateTag(group.symbol)
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  New Tag
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {allTags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    onClick={() => handleToggleTag(group.symbol, tag.id)}
                                    className={`px-3 py-1 text-sm font-medium border transition-all ${
                                      journal.tagIds.includes(tag.id)
                                        ? 'ring-2 ring-primary ring-offset-2'
                                        : 'opacity-60 hover:opacity-100'
                                    } ${getCategoryColor(tag.category)}`}
                                    style={tag.color ? { borderColor: tag.color } : undefined}
                                  >
                                    {tag.name}
                                  </button>
                                ))}
                                {allTags.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    No tags yet. Click "New Tag" to create one.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Confidence & Emotion */}
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Confidence Level: {journal.confidenceLevel}/10</Label>
                                <Slider
                                  value={journal.confidenceLevel}
                                  onValueChange={(val) => updateTokenJournal(group.symbol, 'confidenceLevel', val)}
                                  min={1}
                                  max={10}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Emotional State</Label>
                                <Select
                                  value={journal.emotionalState}
                                  onChange={(e) => updateTokenJournal(group.symbol, 'emotionalState', e.target.value)}
                                >
                                  <option value="">Select state</option>
                                  {emotionalStates.map((state) => (
                                    <option key={state.value} value={state.value}>{state.label}</option>
                                  ))}
                                </Select>
                              </div>
                            </div>

                            {/* Thesis */}
                            <div className="space-y-2">
                              <Label>Investment Thesis</Label>
                              <Textarea
                                placeholder="Why did you invest in this token?"
                                value={journal.thesis}
                                onChange={(e) => updateTokenJournal(group.symbol, 'thesis', e.target.value)}
                                rows={2}
                              />
                            </div>

                            {/* Narrative */}
                            <div className="space-y-2">
                              <Label>Market Narrative</Label>
                              <Textarea
                                placeholder="What narrative or catalyst is driving this?"
                                value={journal.narrative}
                                onChange={(e) => updateTokenJournal(group.symbol, 'narrative', e.target.value)}
                                rows={2}
                              />
                            </div>

                            {/* Reflection */}
                            <div className="space-y-2">
                              <Label>Reflection</Label>
                              <Textarea
                                placeholder="How did this position go? What happened?"
                                value={journal.reflection}
                                onChange={(e) => updateTokenJournal(group.symbol, 'reflection', e.target.value)}
                                rows={2}
                              />
                            </div>

                            {/* Lessons Learned */}
                            <div className="space-y-2">
                              <Label>Lessons Learned</Label>
                              <Textarea
                                placeholder="What did you learn from this position?"
                                value={journal.lessonsLearned}
                                onChange={(e) => updateTokenJournal(group.symbol, 'lessonsLearned', e.target.value)}
                                rows={2}
                              />
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end">
                              <Button
                                onClick={() => saveTokenJournal(group.symbol)}
                                disabled={savingToken === group.symbol}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                {savingToken === group.symbol ? 'Saving...' : 'Save Journal'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            Loading journal...
                          </div>
                        )}
                      </TabsContent>

                      {/* Trades Tab */}
                      <TabsContent value="trades" className="mt-0">
                        {/* Buys Section */}
                        {group.buys.length > 0 && (
                          <div className="p-4 border-b">
                            <h4 className="text-sm font-medium text-green-500 mb-3 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Buys ({group.buys.length})
                            </h4>
                            <div className="space-y-2">
                              {group.buys.map((trade) => (
                                <TradeRow
                                  key={trade.id}
                                  trade={trade}
                                  onDelete={() => setDeleteId(trade.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sells Section */}
                        {group.sells.length > 0 && (
                          <div className="p-4">
                            <h4 className="text-sm font-medium text-red-500 mb-3 flex items-center gap-2">
                              <TrendingDown className="h-4 w-4" />
                              Sells ({group.sells.length})
                            </h4>
                            <div className="space-y-2">
                              {group.sells.map((trade) => (
                                <TradeRow
                                  key={trade.id}
                                  trade={trade}
                                  onDelete={() => setDeleteId(trade.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Trade</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trade? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={!!showCreateTag} onOpenChange={() => setShowCreateTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Add a new tag for organizing your trades.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag Name</Label>
              <Input
                id="tagName"
                placeholder="e.g., AI, Meme, Breakout"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagCategory">Category</Label>
              <Select
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value as TagCategory)}
              >
                {tagCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 transition-transform ${
                      newTagColor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewTagColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTag(null)}>
              Cancel
            </Button>
            <Button onClick={() => showCreateTag && handleCreateTag(showCreateTag)} disabled={!newTagName.trim()}>
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Individual trade row component
function TradeRow({ trade, onDelete }: { trade: Trade; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-background border hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className={getStatusColor(trade.status)}>
          {trade.status}
        </Badge>

        <div className="text-sm">
          <span className="font-medium">{trade.quantity.toLocaleString()}</span>
          <span className="text-muted-foreground"> @ </span>
          <span className="font-medium">{formatCurrency(trade.entry_price)}</span>
        </div>

        {trade.platform && (
          <span className="text-sm text-muted-foreground">{trade.platform}</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Market Cap at Trade */}
        <div className="text-right min-w-[80px]">
          <div className="text-xs text-muted-foreground">MCap</div>
          <div className="text-sm font-medium">
            {formatMarketCap(trade.market_cap_at_trade)}
          </div>
        </div>

        {/* Total Value */}
        <div className="text-right min-w-[80px]">
          <div className="text-xs text-muted-foreground">Value</div>
          <div className="text-sm font-medium">
            {formatCurrency(trade.total_value)}
          </div>
        </div>

        {/* Date */}
        <div className="text-right min-w-[80px]">
          <div className="text-xs text-muted-foreground">Date</div>
          <div className="text-sm">
            {formatDate(trade.entry_date)}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.preventDefault()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
