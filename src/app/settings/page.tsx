'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Sun, Moon, Monitor, Database, HardDrive, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTheme } from '@/components/theme-provider'
import { db } from '@/lib/db'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [dbStats, setDbStats] = useState({
    trades: 0,
    notes: 0,
    tags: 0,
    influencers: 0,
    reviews: 0,
  })

  useEffect(() => {
    async function loadStats() {
      const [trades, tags, influencers, reviews] = await Promise.all([
        db.getTrades(),
        db.getTags(),
        db.getInfluencers(),
        db.getReviews(),
      ])
      setDbStats({
        trades: trades.length,
        notes: trades.length, // Approximate
        tags: tags.length,
        influencers: influencers.length,
        reviews: reviews.length,
      })
    }
    loadStats()
  }, [])

  const handleExportData = async () => {
    const [trades, tags, influencers, reviews] = await Promise.all([
      db.getTrades(),
      db.getTags(),
      db.getInfluencers(),
      db.getReviews(),
    ])

    const data = {
      exportDate: new Date().toISOString(),
      trades,
      tags,
      influencers,
      reviews,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tradejournal-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteAllData = async () => {
    // In a real app, this would clear all data from the database
    // For the mock, we'll just close the dialog
    setShowDeleteConfirm(false)
    window.location.reload()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Customize your Trade Journal experience
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Trade Journal looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="flex-1"
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="flex-1"
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="flex-1"
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data & Storage
          </CardTitle>
          <CardDescription>
            Your data is stored locally on your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Storage Stats */}
          <div className="grid grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-muted">
              <div className="text-2xl font-bold">{dbStats.trades}</div>
              <div className="text-xs text-muted-foreground">Trades</div>
            </div>
            <div className="p-3 bg-muted">
              <div className="text-2xl font-bold">{dbStats.tags}</div>
              <div className="text-xs text-muted-foreground">Tags</div>
            </div>
            <div className="p-3 bg-muted">
              <div className="text-2xl font-bold">{dbStats.influencers}</div>
              <div className="text-xs text-muted-foreground">Influencers</div>
            </div>
            <div className="p-3 bg-muted">
              <div className="text-2xl font-bold">{dbStats.reviews}</div>
              <div className="text-xs text-muted-foreground">Reviews</div>
            </div>
            <div className="p-3 bg-muted">
              <div className="text-2xl font-bold">
                <HardDrive className="h-6 w-6 mx-auto" />
              </div>
              <div className="text-xs text-muted-foreground">Local</div>
            </div>
          </div>

          {/* Data Actions */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleExportData} className="flex-1">
              Export All Data
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Data
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Your data is stored in a SQLite database on your local machine. No data is sent to external servers.
          </p>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>Trade Journal - Your personal trading diary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Version</span>
            <Badge variant="secondary">1.0.0</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Platform</span>
            <Badge variant="secondary">Desktop</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with Next.js, Electron, and SQLite. A privacy-focused trading journal
            that keeps all your data local.
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all your data? This includes all trades,
              notes, tags, influencers, and reviews. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllData}>
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
