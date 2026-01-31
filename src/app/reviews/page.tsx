'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, FileText, Calendar, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import type { Review } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    try {
      const data = await db.getReviews()
      setReviews(data)
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await db.deleteReview(deleteId)
      setReviews(reviews.filter(r => r.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      console.error('Failed to delete review:', error)
    }
  }

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
          <h1 className="text-3xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">
            Reflect on your trading performance over time
          </p>
        </div>
        <Link href="/reviews/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Review
          </Button>
        </Link>
      </div>

      {/* Reviews List */}
      <div className="grid gap-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {review.type.charAt(0).toUpperCase() + review.type.slice(1)} Review
                      <Badge className={getTypeColor(review.type)}>{review.type}</Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(review.date_range_start)} - {formatDate(review.date_range_end)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/reviews/${review.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(review.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {(review.content || review.key_learnings) && (
              <CardContent>
                {review.content && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {review.content}
                  </p>
                )}
                {review.key_learnings && (
                  <div className="mt-2">
                    <span className="text-xs font-medium">Key Learnings: </span>
                    <span className="text-xs text-muted-foreground">
                      {review.key_learnings}
                    </span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}

        {reviews.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first review to reflect on your trading
              </p>
              <Link href="/reviews/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Review
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Review</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
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
    </div>
  )
}
