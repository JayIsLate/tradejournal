'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  User,
  MessageSquare,
  TrendingUp,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { Influencer, InfluencerCall, Trade } from '@/lib/types'
import { generateId, formatDate } from '@/lib/utils'

const platforms = ['Twitter', 'Discord', 'Telegram', 'YouTube', 'TikTok', 'Other']

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [calls, setCalls] = useState<InfluencerCall[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreateInfluencer, setShowCreateInfluencer] = useState(false)
  const [showCreateCall, setShowCreateCall] = useState(false)
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [deleteInfluencerId, setDeleteInfluencerId] = useState<string | null>(null)

  // Influencer form
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('Twitter')
  const [handle, setHandle] = useState('')
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')

  // Call form
  const [callInfluencerId, setCallInfluencerId] = useState('')
  const [callTradeId, setCallTradeId] = useState('')
  const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0])
  const [callContent, setCallContent] = useState('')
  const [sourceLink, setSourceLink] = useState('')
  const [yourResult, setYourResult] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [influencerData, callData, tradeData] = await Promise.all([
        db.getInfluencers(),
        db.getInfluencerCalls(),
        db.getTrades(),
      ])
      setInfluencers(influencerData)
      setCalls(callData)
      setTrades(tradeData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInfluencer = async () => {
    if (!name.trim()) return

    try {
      const influencer: Influencer = {
        id: generateId(),
        name: name.trim(),
        platform,
        handle: handle || null,
        link: link || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
      }

      await db.createInfluencer(influencer)
      setInfluencers([...influencers, influencer])
      setShowCreateInfluencer(false)
      resetInfluencerForm()
    } catch (error) {
      console.error('Failed to create influencer:', error)
    }
  }

  const handleCreateCall = async () => {
    if (!callInfluencerId || !callContent.trim()) return

    try {
      const call: InfluencerCall = {
        id: generateId(),
        influencer_id: callInfluencerId,
        trade_id: callTradeId || null,
        call_date: callDate,
        call_content: callContent,
        source_link: sourceLink || null,
        your_result: yourResult || null,
        created_at: new Date().toISOString(),
      }

      await db.createInfluencerCall(call)
      setCalls([call, ...calls])
      setShowCreateCall(false)
      resetCallForm()
    } catch (error) {
      console.error('Failed to create call:', error)
    }
  }

  const handleDeleteInfluencer = async () => {
    if (!deleteInfluencerId) return

    try {
      await db.deleteInfluencer(deleteInfluencerId)
      setInfluencers(influencers.filter(i => i.id !== deleteInfluencerId))
      setCalls(calls.filter(c => c.influencer_id !== deleteInfluencerId))
      setDeleteInfluencerId(null)
    } catch (error) {
      console.error('Failed to delete influencer:', error)
    }
  }

  const resetInfluencerForm = () => {
    setName('')
    setPlatform('Twitter')
    setHandle('')
    setLink('')
    setNotes('')
  }

  const resetCallForm = () => {
    setCallInfluencerId('')
    setCallTradeId('')
    setCallDate(new Date().toISOString().split('T')[0])
    setCallContent('')
    setSourceLink('')
    setYourResult('')
  }

  const getInfluencerStats = (influencerId: string) => {
    const influencerCalls = calls.filter(c => c.influencer_id === influencerId)
    const linkedTrades = influencerCalls.filter(c => c.trade_id).map(c => c.trade_id)
    const relatedTrades = trades.filter(t => linkedTrades.includes(t.id) && t.status === 'closed')
    const totalPnl = relatedTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0)
    const wins = relatedTrades.filter(t => (t.pnl_amount || 0) > 0).length

    return {
      callCount: influencerCalls.length,
      tradeCount: relatedTrades.length,
      totalPnl,
      winRate: relatedTrades.length > 0 ? (wins / relatedTrades.length) * 100 : 0,
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Influencers</h1>
          <p className="text-muted-foreground">
            Track calls from influencers and your performance on them
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateCall(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Log Call
          </Button>
          <Button onClick={() => setShowCreateInfluencer(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Influencer
          </Button>
        </div>
      </div>

      <Tabs defaultValue="influencers">
        <TabsList>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
          <TabsTrigger value="calls">Call History</TabsTrigger>
        </TabsList>

        <TabsContent value="influencers" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {influencers.map((influencer) => {
              const stats = getInfluencerStats(influencer.id)
              return (
                <Card key={influencer.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{influencer.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {influencer.platform}
                            </Badge>
                            {influencer.handle && (
                              <span className="text-xs">@{influencer.handle}</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteInfluencerId(influencer.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{stats.callCount}</div>
                        <div className="text-xs text-muted-foreground">Calls Logged</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.tradeCount}</div>
                        <div className="text-xs text-muted-foreground">Trades Taken</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${
                          stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          ${Math.abs(stats.totalPnl).toFixed(0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total P&L</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.winRate.toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                    </div>
                    {influencer.notes && (
                      <p className="mt-4 text-sm text-muted-foreground">{influencer.notes}</p>
                    )}
                    {influencer.link && (
                      <a
                        href={influencer.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Profile
                      </a>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {influencers.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No influencers added yet</p>
                  <Button onClick={() => setShowCreateInfluencer(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Influencer
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calls" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>All logged calls from influencers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {calls.map((call) => {
                  const influencer = influencers.find(i => i.id === call.influencer_id)
                  const trade = trades.find(t => t.id === call.trade_id)
                  return (
                    <div
                      key={call.id}
                      className="p-4 border hover:bg-accent/50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{influencer?.name || 'Unknown'}</span>
                            <Badge variant="secondary" className="text-xs">
                              {influencer?.platform}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(call.call_date)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">{call.call_content}</p>
                          {trade && (
                            <div className="mt-2 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className="text-sm">
                                Linked to {trade.token_symbol} trade
                                {trade.pnl_amount !== null && (
                                  <span className={trade.pnl_amount >= 0 ? 'text-green-500' : 'text-red-500'}>
                                    {' '}(${trade.pnl_amount.toFixed(2)})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {call.your_result && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Result: {call.your_result}
                            </p>
                          )}
                        </div>
                        {call.source_link && (
                          <a
                            href={call.source_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
                {calls.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No calls logged yet</p>
                    <Button onClick={() => setShowCreateCall(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Log Your First Call
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Influencer Dialog */}
      <Dialog open={showCreateInfluencer} onOpenChange={setShowCreateInfluencer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Influencer</DialogTitle>
            <DialogDescription>
              Add an influencer to track their calls
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Influencer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {platforms.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">Handle</Label>
                <Input
                  id="handle"
                  placeholder="@username"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link">Profile Link</Label>
              <Input
                id="link"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this influencer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInfluencer(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInfluencer} disabled={!name.trim()}>
              Add Influencer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Call Dialog */}
      <Dialog open={showCreateCall} onOpenChange={setShowCreateCall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
            <DialogDescription>
              Record a call from an influencer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="callInfluencer">Influencer *</Label>
              <Select
                value={callInfluencerId}
                onChange={(e) => setCallInfluencerId(e.target.value)}
              >
                <option value="">Select influencer</option>
                {influencers.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callDate">Call Date</Label>
              <Input
                id="callDate"
                type="date"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callContent">What did they call? *</Label>
              <Textarea
                id="callContent"
                placeholder="e.g., 'Buy SOL, looking bullish above $100'"
                value={callContent}
                onChange={(e) => setCallContent(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callTrade">Link to Trade (Optional)</Label>
              <Select
                value={callTradeId}
                onChange={(e) => setCallTradeId(e.target.value)}
              >
                <option value="">No linked trade</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.token_symbol} - {formatDate(t.entry_date)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceLink">Source Link</Label>
              <Input
                id="sourceLink"
                placeholder="Link to tweet, post, etc."
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yourResult">Your Result</Label>
              <Textarea
                id="yourResult"
                placeholder="Did you take this trade? What happened?"
                value={yourResult}
                onChange={(e) => setYourResult(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCall(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCall}
              disabled={!callInfluencerId || !callContent.trim()}
            >
              Log Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteInfluencerId} onOpenChange={() => setDeleteInfluencerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Influencer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this influencer? All their calls will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteInfluencerId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInfluencer}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
