'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Trash2,
  Save,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag,
  Image,
  Plus,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, TradeNote, Tag as TagType, EmotionalState, TagCategory } from '@/lib/types'
import {
  formatCurrency,
  formatPercent,
  formatDate,
  getPnlColor,
  getStatusColor,
  getEmotionalStateColor,
  getCategoryColor,
  generateId,
  calculatePnl,
  emotionalStates,
  tagCategories,
} from '@/lib/utils'
import { RichTextEditor } from '@/components/rich-text-editor'
import { MemeGenerator } from '@/components/meme-generator'

export default function TradeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tradeId = params.id as string

  const [trade, setTrade] = useState<Trade | null>(null)
  const [note, setNote] = useState<TradeNote | null>(null)
  const [tags, setTags] = useState<TagType[]>([])
  const [tradeTags, setTradeTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showMeme, setShowMeme] = useState(false)
  const [editingNote, setEditingNote] = useState(false)

  // Editable note fields
  const [preTradeThesis, setPreTradeThesis] = useState('')
  const [marketNarrative, setMarketNarrative] = useState('')
  const [postTradeReflection, setPostTradeReflection] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')
  const [richContent, setRichContent] = useState('')
  const [confidenceLevel, setConfidenceLevel] = useState(5)
  const [emotionalState, setEmotionalState] = useState<EmotionalState | ''>('')

  // Close trade fields
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closeExitPrice, setCloseExitPrice] = useState('')
  const [closeExitDate, setCloseExitDate] = useState(new Date().toISOString().split('T')[0])

  // Create tag fields
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('narrative')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  useEffect(() => {
    async function loadData() {
      try {
        const [tradeData, noteData, allTags, tradeTagIds] = await Promise.all([
          db.getTrade(tradeId),
          db.getTradeNote(tradeId),
          db.getTags(),
          db.getTradeTagIds(tradeId),
        ])

        if (!tradeData) {
          router.push('/trades')
          return
        }

        setTrade(tradeData)
        setNote(noteData || null)
        setTags(allTags)
        setTradeTags(tradeTagIds)

        // Populate note fields
        if (noteData) {
          setPreTradeThesis(noteData.pre_trade_thesis || '')
          setMarketNarrative(noteData.market_narrative || '')
          setPostTradeReflection(noteData.post_trade_reflection || '')
          setLessonsLearned(noteData.lessons_learned || '')
          setRichContent(noteData.rich_content || '')
          setConfidenceLevel(noteData.confidence_level || 5)
          setEmotionalState(noteData.emotional_state || '')
        }
      } catch (error) {
        console.error('Failed to load trade:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [tradeId, router])

  const handleSaveNote = async () => {
    if (!trade) return
    setSaving(true)

    try {
      const noteData = {
        id: note?.id || generateId(),
        trade_id: trade.id,
        pre_trade_thesis: preTradeThesis || null,
        market_narrative: marketNarrative || null,
        post_trade_reflection: postTradeReflection || null,
        lessons_learned: lessonsLearned || null,
        rich_content: richContent || null,
        confidence_level: confidenceLevel,
        emotional_state: emotionalState || null,
      }

      const savedNote = await db.upsertTradeNote(noteData)
      setNote(savedNote)
      setEditingNote(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCloseTrade = async () => {
    if (!trade) return
    setSaving(true)

    try {
      const exitPrice = parseFloat(closeExitPrice)
      const pnl = calculatePnl(trade.entry_price, exitPrice, trade.quantity, trade.direction)

      const updated = await db.updateTrade(trade.id, {
        exit_price: exitPrice,
        exit_date: closeExitDate,
        status: 'closed',
        pnl_amount: pnl.amount,
        pnl_percent: pnl.percent,
      })

      setTrade(updated)
      setShowCloseDialog(false)
    } catch (error) {
      console.error('Failed to close trade:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTag = async (tagId: string) => {
    if (!trade) return

    const newTags = tradeTags.includes(tagId)
      ? tradeTags.filter(id => id !== tagId)
      : [...tradeTags, tagId]

    setTradeTags(newTags)
    await db.setTradeTags(trade.id, newTags)
  }

  const handleDelete = async () => {
    if (!trade) return
    await db.deleteTrade(trade.id)
    router.push('/trades')
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !trade) return

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

      // Auto-select the new tag for this trade
      const newTradeTags = [...tradeTags, newTag.id]
      setTradeTags(newTradeTags)
      await db.setTradeTags(trade.id, newTradeTags)

      // Reset form
      setNewTagName('')
      setNewTagCategory('narrative')
      setNewTagColor('#3b82f6')
      setShowCreateTag(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!trade) {
    return null
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
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{trade.token_symbol}</h1>
              <Badge variant="outline" className={getStatusColor(trade.status)}>
                {trade.status}
              </Badge>
              <Badge variant="secondary">{trade.direction.toUpperCase()}</Badge>
            </div>
            {trade.token_name && (
              <p className="text-muted-foreground">{trade.token_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trade.status === 'open' && (
            <Button variant="success" onClick={() => setShowCloseDialog(true)}>
              Close Trade
            </Button>
          )}
          {trade.status === 'closed' && (
            <Button variant="outline" onClick={() => setShowMeme(true)}>
              <Image className="h-4 w-4 mr-2" />
              Generate Meme
            </Button>
          )}
          <Link href={`/trades/${trade.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Trade Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entry Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(trade.entry_price)}</div>
            <div className="text-sm text-muted-foreground">{formatDate(trade.entry_date)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exit Price</CardTitle>
          </CardHeader>
          <CardContent>
            {trade.exit_price ? (
              <>
                <div className="text-2xl font-bold">{formatCurrency(trade.exit_price)}</div>
                <div className="text-sm text-muted-foreground">{trade.exit_date ? formatDate(trade.exit_date) : '-'}</div>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Position Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(trade.total_value)}</div>
            <div className="text-sm text-muted-foreground">{trade.quantity} units</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">P&L</CardTitle>
          </CardHeader>
          <CardContent>
            {trade.pnl_amount !== null ? (
              <>
                <div className={`text-2xl font-bold ${getPnlColor(trade.pnl_amount)}`}>
                  {formatCurrency(trade.pnl_amount)}
                </div>
                <div className={`text-sm ${getPnlColor(trade.pnl_amount)}`}>
                  {formatPercent(trade.pnl_percent || 0)}
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">Open</div>
            )}
          </CardContent>
        </Card>
      </div>

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
                  tradeTags.includes(tag.id)
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
            <CardTitle>Journal Notes</CardTitle>
            <CardDescription>Document your thoughts and reflections</CardDescription>
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
          <Tabs defaultValue="pre-trade">
            <TabsList>
              <TabsTrigger value="pre-trade">Pre-Trade</TabsTrigger>
              <TabsTrigger value="post-trade">Post-Trade</TabsTrigger>
              <TabsTrigger value="detailed">Detailed Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="pre-trade" className="space-y-4">
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
                <Label>Trade Thesis</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="Why are you entering this trade?"
                    value={preTradeThesis}
                    onChange={(e) => setPreTradeThesis(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {preTradeThesis || <span className="text-muted-foreground">No thesis recorded</span>}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Market Narrative</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="What narrative or catalyst is driving this?"
                    value={marketNarrative}
                    onChange={(e) => setMarketNarrative(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {marketNarrative || <span className="text-muted-foreground">No narrative recorded</span>}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="post-trade" className="space-y-4">
              <div className="space-y-2">
                <Label>Post-Trade Reflection</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="How did this trade go? What happened?"
                    value={postTradeReflection}
                    onChange={(e) => setPostTradeReflection(e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {postTradeReflection || <span className="text-muted-foreground">No reflection recorded</span>}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lessons Learned</Label>
                {editingNote ? (
                  <Textarea
                    placeholder="What did you learn from this trade?"
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

      {/* Close Trade Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Trade</DialogTitle>
            <DialogDescription>
              Enter the exit price to close this trade and calculate P&L.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Exit Price</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={closeExitPrice}
                onChange={(e) => setCloseExitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Exit Date</Label>
              <Input
                type="date"
                value={closeExitDate}
                onChange={(e) => setCloseExitDate(e.target.value)}
              />
            </div>
            {closeExitPrice && (
              <div className="p-4 bg-muted">
                <div className="text-sm text-muted-foreground">Estimated P&L</div>
                {(() => {
                  const pnl = calculatePnl(
                    trade.entry_price,
                    parseFloat(closeExitPrice),
                    trade.quantity,
                    trade.direction
                  )
                  return (
                    <div className={`text-xl font-bold ${getPnlColor(pnl.amount)}`}>
                      {formatCurrency(pnl.amount)} ({formatPercent(pnl.percent)})
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCloseTrade} disabled={!closeExitPrice || saving}>
              {saving ? 'Closing...' : 'Close Trade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Trade</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trade? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Add a new tag and automatically apply it to this trade.
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

      {/* Meme Generator */}
      <MemeGenerator
        open={showMeme}
        onOpenChange={setShowMeme}
        pnlAmount={trade.pnl_amount || 0}
        pnlPercent={trade.pnl_percent || 0}
        tokenSymbol={trade.token_symbol}
      />
    </div>
  )
}
