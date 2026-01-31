'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Calendar, Edit, Save, X, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import type { Review, Trade } from '@/lib/types'
import { formatDate, formatCurrency, getPnlColor, getStatusColor } from '@/lib/utils'

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reviewId = params.id as string

  const [review, setReview] = useState<Review | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [content, setContent] = useState('')
  const [keyLearnings, setKeyLearnings] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const reviewData = await db.getReview(reviewId)
        if (!reviewData) {
          router.push('/reviews')
          return
        }

        setReview(reviewData)
        setContent(reviewData.content || '')
        setKeyLearnings(reviewData.key_learnings || '')

        const allTrades = await db.getTrades()
        const periodTrades = allTrades.filter(
          (t) =>
            t.entry_date >= reviewData.date_range_start &&
            t.entry_date <= reviewData.date_range_end
        )
        setTrades(periodTrades)
      } catch (error) {
        console.error('Failed to load review:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [reviewId, router])

  const handleSave = async () => {
    if (!review) return
    setSaving(true)

    try {
      await db.updateReview(review.id, {
        content: content || null,
        key_learnings: keyLearnings || null,
      })
      setReview({ ...review, content, key_learnings: keyLearnings })
      setEditing(false)
    } catch (error) {
      console.error('Failed to save review:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!review) return
    await db.deleteReview(review.id)
    router.push('/reviews')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!review) return null

  const closedTrades = trades.filter((t) => t.status === 'closed')
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0)
  const winners = closedTrades.filter((t) => (t.pnl_amount || 0) > 0).length
  const winRate = closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'weekly':
        return 'bg-blue-500/10 text-blue-500'
      case 'monthly':
        return 'bg-purple-500/10 text-purple-500'
      case 'custom':
        return 'bg-green-500/10 text-green-500'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reviews">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {review.type.charAt(0).toUpperCase() + review.type.slice(1)} Review
              <Badge className={getTypeColor(review.type)}>{review.type}</Badge>
            </h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(review.date_range_start)} - {formatDate(review.date_range_end)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{trades.length}</div>
            <div className="text-sm text-muted-foreground">Total Trades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-2xl font-bold ${getPnlColor(totalPnl)}`}>
              {formatCurrency(totalPnl)}
            </div>
            <div className="text-sm text-muted-foreground">Total P&L</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{closedTrades.length}</div>
            <div className="text-sm text-muted-foreground">Closed</div>
          </CardContent>
        </Card>
      </div>

      {/* Trades in Period */}
      <Card>
        <CardHeader>
          <CardTitle>Trades in Period</CardTitle>
          <CardDescription>{trades.length} trades during this review period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {trades.map((trade) => (
              <Link
                key={trade.id}
                href={`/trades/${trade.id}`}
                className="flex items-center justify-between p-3 border hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{trade.token_symbol}</span>
                  <Badge variant="outline" className={getStatusColor(trade.status)}>
                    {trade.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(trade.entry_date)}
                  </span>
                </div>
                <div className="text-right">
                  {trade.pnl_amount !== null ? (
                    <span className={`font-medium ${getPnlColor(trade.pnl_amount)}`}>
                      {formatCurrency(trade.pnl_amount)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Open</span>
                  )}
                </div>
              </Link>
            ))}
            {trades.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No trades in this period
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reflection Content */}
      <Card>
        <CardHeader>
          <CardTitle>Reflection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Overall Reflection</Label>
            {editing ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="How did this period go?"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {review.content || <span className="text-muted-foreground">No reflection recorded</span>}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Key Learnings</Label>
            {editing ? (
              <Textarea
                value={keyLearnings}
                onChange={(e) => setKeyLearnings(e.target.value)}
                rows={4}
                placeholder="What are the key takeaways?"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {review.key_learnings || <span className="text-muted-foreground">No key learnings recorded</span>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Review</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
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
    </div>
  )
}
