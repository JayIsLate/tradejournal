'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, RefreshCw } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface MemeGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pnlAmount: number
  pnlPercent: number
  tokenSymbol: string
}

type MemeTemplate = {
  id: string
  name: string
  topText: string
  bottomText: string
  bgColor: string
  emoji: string
}

const memeTemplates: Record<string, MemeTemplate[]> = {
  bigWin: [
    { id: 'lambo', name: 'Lambo Time', topText: 'WHEN THE TRADE HITS', bottomText: 'TIME TO LOOK AT LAMBOS', bgColor: '#22c55e', emoji: '🏎️' },
    { id: 'printer', name: 'Money Printer', topText: 'MONEY PRINTER', bottomText: 'GO BRRRR', bgColor: '#16a34a', emoji: '🖨️💵' },
    { id: 'gigachad', name: 'Gigachad', topText: 'BOUGHT THE BOTTOM', bottomText: 'SOLD THE TOP', bgColor: '#15803d', emoji: '💪' },
    { id: 'rocket', name: 'To The Moon', topText: 'STRAPPED IN', bottomText: 'TO THE MOON', bgColor: '#059669', emoji: '🚀' },
  ],
  smallWin: [
    { id: 'modest', name: 'Modest Gains', topText: 'HONEST WORK', bottomText: 'HONEST GAINS', bgColor: '#65a30d', emoji: '👷' },
    { id: 'comfy', name: 'Comfy', topText: 'TAKING PROFITS', bottomText: 'FEELING COMFY', bgColor: '#84cc16', emoji: '☺️' },
    { id: 'nice', name: 'Nice', topText: 'NICE', bottomText: 'VERY NICE', bgColor: '#a3e635', emoji: '👍' },
  ],
  breakeven: [
    { id: 'honest', name: 'Honest Work', topText: "IT AIN'T MUCH", bottomText: "BUT IT'S HONEST WORK", bgColor: '#737373', emoji: '🧑‍🌾' },
    { id: 'survived', name: 'Survived', topText: 'AT LEAST', bottomText: "I DIDN'T LOSE MONEY", bgColor: '#a3a3a3', emoji: '😅' },
    { id: 'neutral', name: 'Perfectly Balanced', topText: 'PERFECTLY BALANCED', bottomText: 'AS ALL THINGS SHOULD BE', bgColor: '#d4d4d4', emoji: '⚖️' },
  ],
  smallLoss: [
    { id: 'fine', name: 'This is Fine', topText: 'THIS IS FINE', bottomText: 'EVERYTHING IS FINE', bgColor: '#f97316', emoji: '🔥🐕' },
    { id: 'pain', name: 'Pain', topText: 'JUST A LITTLE', bottomText: 'PAIN', bgColor: '#fb923c', emoji: '😢' },
    { id: 'lesson', name: 'Expensive Lesson', topText: 'EXPENSIVE', bottomText: 'LESSON LEARNED', bgColor: '#fdba74', emoji: '📚' },
  ],
  bigLoss: [
    { id: 'pink', name: 'Pink Wojak', topText: 'WHY DID I', bottomText: 'APE INTO THIS', bgColor: '#ef4444', emoji: '😭' },
    { id: 'bogdanoff', name: 'Bogdanoff', topText: 'HE BOUGHT?', bottomText: 'DUMP IT', bgColor: '#dc2626', emoji: '📞' },
    { id: 'rekt', name: 'REKT', topText: 'ABSOLUTELY', bottomText: 'REKT', bgColor: '#b91c1c', emoji: '💀' },
    { id: 'clown', name: 'Clown', topText: 'ME THINKING', bottomText: 'I COULD TRADE', bgColor: '#991b1b', emoji: '🤡' },
  ],
}

function getMemeCategory(pnlPercent: number): keyof typeof memeTemplates {
  if (pnlPercent >= 50) return 'bigWin'
  if (pnlPercent >= 10) return 'smallWin'
  if (pnlPercent >= -5) return 'breakeven'
  if (pnlPercent >= -25) return 'smallLoss'
  return 'bigLoss'
}

export function MemeGenerator({
  open,
  onOpenChange,
  pnlAmount,
  pnlPercent,
  tokenSymbol,
}: MemeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const category = getMemeCategory(pnlPercent)
  const templates = memeTemplates[category]

  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate>(templates[0])
  const [topText, setTopText] = useState(selectedTemplate.topText)
  const [bottomText, setBottomText] = useState(selectedTemplate.bottomText)

  useEffect(() => {
    const newTemplates = memeTemplates[getMemeCategory(pnlPercent)]
    const randomTemplate = newTemplates[Math.floor(Math.random() * newTemplates.length)]
    setSelectedTemplate(randomTemplate)
    setTopText(randomTemplate.topText)
    setBottomText(randomTemplate.bottomText)
  }, [pnlPercent, open])

  useEffect(() => {
    drawMeme()
  }, [selectedTemplate, topText, bottomText, pnlAmount, pnlPercent, tokenSymbol])

  const drawMeme = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 500
    const height = 500
    canvas.width = width
    canvas.height = height

    // Background
    ctx.fillStyle = selectedTemplate.bgColor
    ctx.fillRect(0, 0, width, height)

    // Add some visual texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() * 100 + 50
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Big emoji in center
    ctx.font = '120px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(selectedTemplate.emoji, width / 2, height / 2)

    // Top text
    ctx.font = 'bold 36px Impact, sans-serif'
    ctx.fillStyle = 'white'
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 3
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.strokeText(topText, width / 2, 30)
    ctx.fillText(topText, width / 2, 30)

    // Bottom text
    ctx.textBaseline = 'bottom'
    ctx.strokeText(bottomText, width / 2, height - 80)
    ctx.fillText(bottomText, width / 2, height - 80)

    // P&L display
    ctx.font = 'bold 28px Arial, sans-serif'
    const pnlColor = pnlAmount >= 0 ? '#22c55e' : '#ef4444'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(width / 2 - 150, height - 70, 300, 50)
    ctx.fillStyle = pnlColor
    ctx.textBaseline = 'middle'
    const pnlText = `${tokenSymbol}: ${formatCurrency(pnlAmount)} (${formatPercent(pnlPercent)})`
    ctx.fillText(pnlText, width / 2, height - 45)
  }

  const randomizeTemplate = () => {
    const randomIndex = Math.floor(Math.random() * templates.length)
    const newTemplate = templates[randomIndex]
    setSelectedTemplate(newTemplate)
    setTopText(newTemplate.topText)
    setBottomText(newTemplate.bottomText)
  }

  const downloadMeme = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `${tokenSymbol}-trade-meme.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trade Meme Generator</DialogTitle>
          <DialogDescription>
            Generate a meme to celebrate (or mourn) your trade
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Canvas preview */}
          <div className="flex items-center justify-center bg-muted p-4">
            <canvas
              ref={canvasRef}
              className="shadow-lg max-w-full"
              style={{ maxHeight: '400px' }}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate.id === template.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template)
                      setTopText(template.topText)
                      setBottomText(template.bottomText)
                    }}
                    className="text-xs"
                  >
                    {template.emoji} {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topText">Top Text</Label>
              <Input
                id="topText"
                value={topText}
                onChange={(e) => setTopText(e.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bottomText">Bottom Text</Label>
              <Input
                id="bottomText"
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={randomizeTemplate} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Randomize
              </Button>
              <Button onClick={downloadMeme} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
