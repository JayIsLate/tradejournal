'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react'
import { db } from '@/lib/db'
import type { Tag, TagCategory } from '@/lib/types'
import { generateId, getCategoryColor, tagCategories } from '@/lib/utils'

const defaultColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TagCategory>('narrative')
  const [color, setColor] = useState(defaultColors[0])
  const [parentTagId, setParentTagId] = useState<string>('')

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await db.getTags()
      setTags(data)
    } catch (error) {
      console.error('Failed to load tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return

    try {
      const tag: Tag = {
        id: generateId(),
        name: name.trim(),
        category,
        parent_tag_id: parentTagId || null,
        color,
        created_at: new Date().toISOString(),
      }

      await db.createTag(tag)
      setTags([...tags, tag])
      setShowCreate(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      await db.deleteTag(deleteId)
      setTags(tags.filter(t => t.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  const resetForm = () => {
    setName('')
    setCategory('narrative')
    setColor(defaultColors[Math.floor(Math.random() * defaultColors.length)])
    setParentTagId('')
  }

  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = []
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<TagCategory, Tag[]>)

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
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-muted-foreground">
            Organize your trades with custom tags
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Tag
        </Button>
      </div>

      {/* Tags by Category */}
      <div className="grid gap-6 md:grid-cols-3">
        {tagCategories.map(({ value, label }) => (
          <Card key={value}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TagIcon className="h-5 w-5" />
                {label}
              </CardTitle>
              <CardDescription>
                {value === 'narrative' && 'Market narratives and themes'}
                {value === 'technical' && 'Technical setups and patterns'}
                {value === 'meta' && 'Trade types and strategies'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(tagsByCategory[value] || []).map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 border hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3"
                        style={{ backgroundColor: tag.color || undefined }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteId(tag.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {(!tagsByCategory[value] || tagsByCategory[value].length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No {label.toLowerCase()} tags yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Add a new tag to organize your trades
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tag Name</Label>
              <Input
                id="name"
                placeholder="e.g., AI, Breakout, Swing Trade"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as TagCategory)}
              >
                {tagCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 transition-transform ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Tag (Optional)</Label>
              <Select
                value={parentTagId}
                onChange={(e) => setParentTagId(e.target.value)}
              >
                <option value="">No parent</option>
                {tags
                  .filter((t) => t.category === category)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? It will be removed from all trades.
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
