'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Tag,
  Plus,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, TokenNote, Tag as TagType, EmotionalState, TagCategory } from '@/lib/types'
import {
  formatCurrency,
  formatPercent,
  formatDate,
  getPnlColor,
  getStatusColor,
  getEmotionalStateColor,
  getCategoryColor,
  generateId,
  emotionalStates,
  tagCategories,
} from '@/lib/utils'
import { RichTextEditor } from '@/components/rich-text-editor'

export default function TokenDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tokenSymbol = decodeURIComponent(params.symbol as string).toUpperCase()

  const [trades, setTrades] = useState<Trade[]>([])
  const [note, setNote] = useState<TokenNote | null>(null)
  const [tags, setTags] = useState<TagType[]>([])
  const [tokenTags, setTokenTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  // Editable note fields
  const [thesis, setThesis] = useState('')
  const [narrative, setNarrative] = useState('')
  const [reflection, setReflection] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')
  const [richContent, setRichContent] = useState('')
  const [confidenceLevel, setConfidenceLevel] = useState(5)
  const [emotionalState, setEmotionalState] = useState<EmotionalState | ''>('')

  // Create tag fields
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('narrative')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  useEffect(() => {
    async function loadData() {
      try {
        const [allTrades, noteData, allTags, tagIds] = await Promise.all([
          db.getTrades(),
          db.getTokenNote(tokenSymbol),
          db.getTags(),
          db.getTokenTagIds(tokenSymbol),
        ])

        const tokenTrades = allTrades.filter(
          t => t.token_symbol.toUpperCase() === tokenSymbol
        )

        if (tokenTrades.length === 0) {
          router.push('/trades')
          return
        }

        setTrades(tokenTrades)
        setNote(noteData || null)
        setTags(allTags)
        setTokenTags(tagIds)

        // Populate note fields
        if (noteData) {
          setThesis(noteData.thesis || '')
          setNarrative(noteData.narrative || '')
          setReflection(noteData.reflection || '')
          setLessonsLearned(noteData.lessons_learned || '')
          setRichContent(noteData.rich_content || '')
          setConfidenceLevel(noteData.confidence_level || 5)
          setEmotionalState(noteData.emotional_state || '')
        }
      } catch (error) {
        console.error('Failed to load token data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [tokenSymbol, router])

  // Calculate position stats
  const buys = trades.filter(t => t.direction === 'buy')
  const sells = trades.filter(t => t.direction === 'sell')

  const totalBought = buys.reduce((sum, t) => sum + t.quantity, 0)
  const totalSold = sells.reduce((sum, t) => sum + t.quantity, 0)
  const totalBuyCost = buys.reduce((sum, t) => sum + t.total_value, 0)
  const totalSellRevenue = sells.reduce((sum, t) => sum + t.total_value, 0)

  const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0
  const avgSellPrice = totalSold > 0 ? totalSellRevenue / totalSold : 0

  const netQuantity = totalBought - totalSold
  const realizedPnl = totalSold > 0 ? (avgSellPrice - avgBuyPrice) * totalSold : 0
  const realizedPnlPercent = avgBuyPrice > 0 ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0

  const isPositionClosed = netQuantity <= 0
  const unrealizedCost = netQuantity > 0 ? avgBuyPrice * netQuantity : 0

  // Get token info from first trade
  const tokenInfo = trades[0]

  const handleSaveNote = async () => {
    setSaving(true)

    try {
      const noteData = {
        id: note?.id || generateId(),
        token_symbol: tokenSymbol,
        thesis: thesis || null,
        narrative: narrative || null,
        reflection: reflection || null,
        lessons_learned: lessonsLearned || null,
        rich_content: richContent || null,
        confidence_level: confidenceLevel,
        emotional_state: emotionalState || null,
      }

      const savedNote = await db.upsertTokenNote(noteData)
      setNote(savedNote)
      setEditingNote(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTag = async (tagId: string) => {
    const newTags = tokenTags.includes(tagId)
      ? tokenTags.filter(id => id !== tagId)
      : [...tokenTags, tagId]

    setTokenTags(newTags)
    await db.setTokenTags(tokenSymbol, newTags)
  }

  const handleCreateTag = async () => {
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
      setTags([...tags, newTag])

      // Auto-select the new tag
      const newTokenTags = [...tokenTags, newTag.id]
      setTokenTags(newTokenTags)
      await db.setTokenTags(tokenSymbol, newTokenTags)

      // Reset form
      setNewTagName('')
      setNewTagCategory('narrative')
      setNewTagColor('#3b82f6')
      setShowCreateTag(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const copyAddress = () => {
    if (tokenInfo?.token_contract_address) {
      navigator.clipboard.writeText(tokenInfo.token_contract_address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trades">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          {/* Token Image */}
          {tokenInfo?.token_image ? (
            <img
              src={tokenInfo.token_image}
              alt={tokenSymbol}
              className="w-12 h-12 object-cover bg-muted"
            />
          ) : (
            <div className="w-12 h-12 bg-muted flex items-center justify-center text-xl font-bold">
              {tokenSymbol.charAt(0)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{tokenSymbol}</h1>
              {tokenInfo?.token_name && (
                <span className="text-muted-foreground">({tokenInfo.token_name})</span>
              )}
              <Badge variant={isPositionClosed ? 'secondary' : 'default'}>
                {isPositionClosed ? 'Closed' : 'Open Position'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {tokenInfo?.token_chain && <span>{tokenInfo.token_chain}</span>}
              {tokenInfo?.token_contract_address && (
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                >
                  {tokenInfo.token_contract_address.slice(0, 6)}...{tokenInfo.token_contract_address.slice(-4)}
                  {copiedAddress ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Position Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bought</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{totalBought.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalBuyCost)} ({buys.length} buys)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{totalSold.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalSellRevenue)} ({sells.length} sells)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Buy / Sell Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-500">{formatCurrency(avgBuyPrice)}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg font-bold text-red-500">{formatCurrency(avgSellPrice)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnlColor(realizedPnl)}`}>
              {formatCurrency(realizedPnl)}
            </div>
            <div className={`text-sm ${getPnlColor(realizedPnl)}`}>
              {formatPercent(realizedPnlPercent)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remaining Position */}
      {netQuantity > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Remaining Position</div>
                <div className="text-2xl font-bold">{netQuantity.toLocaleString()} {tokenSymbol}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Cost Basis</div>
                <div className="text-xl font-bold">{formatCurrency(unrealizedCost)}</div>
                <div className="text-sm text-muted-foreground">@ {formatCurrency(avgBuyPrice)}/token</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowCreateTag(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Tag
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleToggleTag(tag.id)}
                className={`px-3 py-1 text-sm font-medium border transition-all ${
                  tokenTags.includes(tag.id)
                    ? 'ring-2 ring-primary ring-offset-2'
                    : 'opacity-60 hover:opacity-100'
                } ${getCategoryColor(tag.category)}`}
                style={tag.color ? { borderColor: tag.color } : undefined}
              >
                {tag.name}
              </button>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tags yet. Click &quot;Add Tag&quot; to create one.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Journal Notes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Position Journal</CardTitle>
            <CardDescription>Your thesis, notes, and reflections for this token</CardDescription>
          </div>
          {!editingNote ? (
            <Button variant="outline" onClick={() => setEditingNote(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Notes
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingNote(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveNote} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="thesis">
            <TabsList>
              <TabsTrigger value="thesis">Thesis</TabsTrigger>
              <TabsTrigger value="reflection">Reflection</TabsTrigger>
              <TabsTrigger value="detailed">Detailed Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="thesis" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Confidence Level</Label>
                  {editingNote ? (
                    <Slider
                      value={confidenceLevel}
                      onValueChange={setConfidenceLevel}
                      min={1}
                      max={10}
                    />
                  ) : (
                    <div className="text-2xl font-bold">{confidenceLevel}/10</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Emotional State</Label>
                  {editingNote ? (
                    <Select
                      value={emotionalState}
                      onChange={(e) => setEmotionalState(e.target.value as EmotionalState)}
                    >
                      <option value="">Select state</option>
                      {emotionalStates.map((state) => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </Select>
                  ) : emotionalState ? (
                    <Badge className={getEmotionalStateColor(emotionalState)}>
                      {emotionalState}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Investment Thesis</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="Why did you invest in this token?"
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {thesis || <span className="text-muted-foreground">No thesis recorded</span>}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Market Narrative</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="What narrative or catalyst is driving this?"
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {narrative || <span className="text-muted-foreground">No narrative recorded</span>}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reflection" className="space-y-4">
              <div className="space-y-2">
                <Label>Reflection</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="How did this position go? What happened?"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {reflection || <span className="text-muted-foreground">No reflection recorded</span>}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lessons Learned</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="What did you learn from this position?"
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {lessonsLearned || <span className="text-muted-foreground">No lessons recorded</span>}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="detailed" className="space-y-4">
              <div className="space-y-2">
                <Label>Detailed Notes</Label>
                {editingNote ? (
                  <RichTextEditor
                    content={richContent}
                    onChange={setRichContent}
                    placeholder="Add detailed notes, screenshots, links..."
                  />
                ) : richContent ? (
                  <div
                    className="tiptap"
                    dangerouslySetInnerHTML={{ __html: richContent }}
                  />
                ) : (
                  <p className="text-muted-foreground">No detailed notes</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>All buys and sells for this token</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Buys */}
            {buys.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-500 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Buys ({buys.length})
                </h4>
                <div className="space-y-2">
                  {buys.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="font-medium">{trade.quantity.toLocaleString()}</span>
                          <span className="text-muted-foreground"> @ </span>
                          <span className="font-medium">{formatCurrency(trade.entry_price)}</span>
                        </div>
                        {trade.platform && (
                          <span className="text-sm text-muted-foreground">{trade.platform}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium">{formatCurrency(trade.total_value)}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(trade.entry_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sells */}
            {sells.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-500 mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Sells ({sells.length})
                </h4>
                <div className="space-y-2">
                  {sells.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="font-medium">{trade.quantity.toLocaleString()}</span>
                          <span className="text-muted-foreground"> @ </span>
                          <span className="font-medium">{formatCurrency(trade.entry_price)}</span>
                        </div>
                        {trade.platform && (
                          <span className="text-sm text-muted-foreground">{trade.platform}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium">{formatCurrency(trade.total_value)}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(trade.entry_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Add a new tag for this position.
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
            <Button variant="outline" onClick={() => setShowCreateTag(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              Create & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
