'use client'

import { useEffect, useState, useCallback, Fragment, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Select } from '@/components/ui/select'
import {
  Search,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, TokenNote, Tag as TagType, EmotionalState } from '@/lib/types'
import {
  formatCurrency,
  formatMarketCap,
  formatDate,
  formatDateTime,
  getPnlColor,
  debounce,
  generateId,
  emotionalStates,
} from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TokenPosition {
  symbol: string
  name: string | null
  chain: string | null
  contractAddress: string | null
  image: string | null
  buys: Trade[]
  sells: Trade[]
  totalBought: number
  totalSold: number
  avgBuyPrice: number
  avgSellPrice: number
  realizedPnl: number
  netQuantity: number
  hasOpenPosition: boolean
  totalInvested: number
  totalReturned: number
  totalInvestedUsd: number
  totalReturnedUsd: number
  realizedPnlUsd: number
  currentPrice: number | null
  priceChange24h: number | null
  unrealizedPnl: number
  unrealizedValue: number
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
  sellReason: string
  copyTrader: string
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [expandedToken, setExpandedToken] = useState<string | null>(null) // Contract address or symbol
  const [expandedTokenSymbol, setExpandedTokenSymbol] = useState<string | null>(null) // Symbol for journal lookups
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'trades' | 'journal'>('trades')

  // Tags
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  // Token journal
  const [tokenJournals, setTokenJournals] = useState<Record<string, TokenJournalData>>({})
  const [savingToken, setSavingToken] = useState<string | null>(null)
  const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const tokenJournalsRef = useRef<Record<string, TokenJournalData>>({})

  // Live prices
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; priceChange24h: number }>>({})
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null)
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [currentSolPrice, setCurrentSolPrice] = useState<number>(100) // Default SOL price

  // Manual sell
  const [manualSellToken, setManualSellToken] = useState<TokenPosition | null>(null)
  const [sellQuantity, setSellQuantity] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState(new Date().toISOString().split('T')[0])
  const [sellMarketCap, setSellMarketCap] = useState('')

  // Portfolio settings
  const [initialCapital, setInitialCapital] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  // Sync
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [newTradesCount, setNewTradesCount] = useState(0)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  // Auto-sync every 1 minute
  useEffect(() => {
    // Initial sync after data loads
    const initialSync = setTimeout(() => {
      syncNewTrades()
    }, 2000)

    // Set up polling every 1 minute for more responsive updates
    syncIntervalRef.current = setInterval(() => {
      syncNewTrades()
    }, 60 * 1000)

    return () => {
      clearTimeout(initialSync)
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  // Clear new trades count after 5 seconds
  useEffect(() => {
    if (newTradesCount > 0) {
      const timer = setTimeout(() => setNewTradesCount(0), 5000)
      return () => clearTimeout(timer)
    }
  }, [newTradesCount])

  // Fetch live prices
  const fetchLivePrices = useCallback(async (contractAddresses: string[]) => {
    if (contractAddresses.length === 0) return

    try {
      // DexScreener allows up to 30 addresses per request
      const uniqueAddresses = [...new Set(contractAddresses.filter(Boolean))]
      const prices: Record<string, { price: number; priceChange24h: number }> = {}

      // Batch requests in groups of 30
      for (let i = 0; i < uniqueAddresses.length; i += 30) {
        const batch = uniqueAddresses.slice(i, i + 30)
        const addressList = batch.join(',')

        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressList}`)
        if (response.ok) {
          const data = await response.json()
          if (data.pairs) {
            // Group by base token address and get the pair with highest liquidity
            const tokenPairs: Record<string, any[]> = {}
            data.pairs.forEach((pair: any) => {
              const addr = pair.baseToken?.address?.toLowerCase()
              if (addr) {
                if (!tokenPairs[addr]) tokenPairs[addr] = []
                tokenPairs[addr].push(pair)
              }
            })

            // For each token, pick the pair with highest liquidity
            Object.entries(tokenPairs).forEach(([addr, pairs]) => {
              const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
              if (bestPair?.priceUsd) {
                prices[addr] = {
                  price: parseFloat(bestPair.priceUsd),
                  priceChange24h: bestPair.priceChange?.h24 || 0
                }
              }
            })
          }
        }
      }

      setLivePrices(prices)
      setLastPriceUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch prices:', error)
    }
  }, [])

  // Set up price polling
  useEffect(() => {
    if (trades.length === 0) return

    const addresses = trades
      .map(t => t.token_contract_address?.toLowerCase())
      .filter(Boolean) as string[]

    // Initial fetch
    fetchLivePrices(addresses)

    // Poll every 15 minutes
    priceIntervalRef.current = setInterval(() => {
      fetchLivePrices(addresses)
    }, 15 * 60 * 1000)

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current)
      }
    }
  }, [trades, fetchLivePrices])

  const loadData = async () => {
    try {
      const [tradesData, tagsData, savedCapital, savedBalance] = await Promise.all([
        db.getTrades(),
        db.getTags(),
        db.getSetting('initial_capital'),
        db.getSetting('wallet_balance'),
      ])

      if (savedCapital) setInitialCapital(parseFloat(savedCapital))
      if (savedBalance) setWalletBalance(parseFloat(savedBalance))

      // Debug: Log ALL trades to understand the corrupt data
      console.log('%c=== TRADE DATA DEBUG ===', 'background: red; color: white; font-size: 16px')
      console.log('Total trades:', tradesData.length)
      const buys = tradesData.filter(t => t.direction === 'buy')
      console.log('Total buys:', buys.length)
      buys.forEach((t, i) => {
        const correctValue = t.entry_price * t.quantity
        console.log(`Buy ${i + 1}: ${t.token_symbol}`)
        console.log(`  - stored total_value: ${t.total_value}`)
        console.log(`  - entry_price: ${t.entry_price}`)
        console.log(`  - quantity: ${t.quantity}`)
        console.log(`  - CORRECT value (price*qty): ${correctValue}`)
        console.log(`  - RATIO (stored/correct): ${(t.total_value / correctValue).toFixed(2)}x`)
      })
      const totalStoredValue = buys.reduce((sum, t) => sum + t.total_value, 0)
      const totalCorrectValue = buys.reduce((sum, t) => sum + (t.entry_price * t.quantity), 0)
      console.log(`TOTAL stored: $${totalStoredValue.toFixed(2)}`)
      console.log(`TOTAL correct: $${totalCorrectValue.toFixed(2)}`)
      console.log('%c========================', 'background: red; color: white; font-size: 16px')

      setTrades(tradesData)
      setAllTags(tagsData)

      // Fetch current SOL price for USD conversion
      try {
        const solPriceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112')
        if (solPriceRes.ok) {
          const solPriceData = await solPriceRes.json()
          if (solPriceData.pairs?.[0]?.priceUsd) {
            setCurrentSolPrice(parseFloat(solPriceData.pairs[0].priceUsd))
          }
        }
      } catch (e) {
        console.log('Failed to fetch SOL price, using default')
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeDuplicates = async () => {
    if (!confirm('This will remove duplicate trades. Continue?')) return
    try {
      const result = await db.removeDuplicateTrades()
      alert(`Removed ${result.removed} duplicates, kept ${result.kept} trades`)
      // Reload trades
      const tradesData = await db.getTrades()
      setTrades(tradesData)
    } catch (error) {
      console.error('Failed to remove duplicates:', error)
      alert('Failed to remove duplicates: ' + error)
    }
  }

  const fullResync = async () => {
    if (!confirm('This will DELETE all trades and re-sync from scratch. Journal entries will be lost. Are you sure?')) return

    try {
      // Stop automatic sync to prevent race conditions
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }

      // Wait for any ongoing sync to finish
      while (syncing) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Delete all existing trades
      const existingTrades = await db.getTrades()
      console.log(`Deleting ${existingTrades.length} existing trades...`)

      for (const trade of existingTrades) {
        try {
          await db.deleteTrade(trade.id)
        } catch (e) {
          console.log(`Failed to delete trade ${trade.id}:`, e)
        }
      }

      // Verify all deleted
      const remainingTrades = await db.getTrades()
      console.log(`Remaining trades after delete: ${remainingTrades.length}`)

      // Clear local state
      setTrades([])

      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 500))

      // Now do a fresh sync
      console.log('Starting fresh sync...')
      await syncNewTrades()

      // Restart automatic sync
      syncIntervalRef.current = setInterval(() => {
        syncNewTrades()
      }, 60 * 1000)

      alert('Full re-sync complete! All trades have been re-imported.')
    } catch (error) {
      console.error('Full re-sync failed:', error)
      alert('Failed to re-sync: ' + error)

      // Restart auto-sync even on error
      if (!syncIntervalRef.current) {
        syncIntervalRef.current = setInterval(() => {
          syncNewTrades()
        }, 60 * 1000)
      }
    }
  }

  const recalculateUsdValues = async () => {
    if (!confirm('This will recalculate USD values for all trades using current SOL price. Your journal entries will be preserved. Continue?')) return

    console.log('=== FIX USD STARTED ===')

    try {
      setSyncing(true)

      // Fetch current SOL price
      let currentSolPrice = 200 // fallback
      try {
        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        const priceData = await priceRes.json()
        currentSolPrice = priceData.solana?.usd || 200
        console.log('Current SOL price for USD recalculation:', currentSolPrice)
      } catch (e) {
        console.warn('Failed to fetch SOL price, using fallback:', currentSolPrice)
      }

      const allTrades = await db.getTrades()
      console.log(`Processing ${allTrades.length} trades...`)

      let updatedCount = 0
      let totalBefore = 0
      let totalAfter = 0

      const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'UST', 'FRAX', 'TUSD', 'USDP', 'GUSD', 'LUSD']

      for (const trade of allTrades) {
        const existingBaseCurrency = ((trade as any).base_currency || '').toUpperCase()
        const existingTotalValueUsd = trade.total_value_usd

        totalBefore += existingTotalValueUsd || trade.total_value

        // For Solana trades, ALWAYS recalculate based on total_value size
        // Small values (< 10) are likely SOL amounts, larger values are likely already USD
        let baseCurrency: string
        let baseCurrencyUsdPrice: number
        let totalValueUsd: number

        if (trade.token_chain === 'Solana' || trade.token_chain === 'solana') {
          // Solana chain - determine if SOL or stablecoin based
          if (trade.total_value < 10) {
            // Small value = likely SOL (e.g., 0.25 SOL)
            baseCurrency = 'SOL'
            baseCurrencyUsdPrice = currentSolPrice
            totalValueUsd = trade.total_value * currentSolPrice
          } else if (trade.total_value < 500) {
            // Medium value = could be either, but likely already USD from stablecoin trade
            baseCurrency = 'USDC'
            baseCurrencyUsdPrice = 1
            totalValueUsd = trade.total_value
          } else {
            // Large value = definitely already USD
            baseCurrency = 'USDC'
            baseCurrencyUsdPrice = 1
            totalValueUsd = trade.total_value
          }
        } else {
          // Non-Solana (Base, Ethereum) - keep existing or default
          baseCurrency = existingBaseCurrency || 'USDC'
          baseCurrencyUsdPrice = stablecoins.includes(baseCurrency) ? 1 : currentSolPrice
          totalValueUsd = stablecoins.includes(baseCurrency) ? trade.total_value : trade.total_value * baseCurrencyUsdPrice
        }

        totalAfter += totalValueUsd

        // Update the trade
        await db.updateTrade(trade.id, {
          base_currency: baseCurrency,
          base_currency_usd_price: baseCurrencyUsdPrice,
          total_value_usd: totalValueUsd,
        } as any)
        updatedCount++
      }

      // Reload trades
      const updatedTrades = await db.getTrades()
      setTrades(updatedTrades)

      console.log(`Fixed USD values: Before=$${totalBefore.toFixed(2)}, After=$${totalAfter.toFixed(2)}`)
      alert(`Fixed ${updatedCount} trades!\n\nBefore: $${totalBefore.toFixed(2)}\nAfter: $${totalAfter.toFixed(2)}\n\nSOL price used: $${currentSolPrice}`)
    } catch (error) {
      console.error('Failed to recalculate USD values:', error)
      alert('Failed to recalculate: ' + error)
    } finally {
      setSyncing(false)
    }
  }

  const syncNewTrades = async () => {
    console.log('Sync started...')
    if (syncing) {
      console.log('Already syncing, skipping')
      return
    }

    try {
      const [apiKey, walletsJson] = await Promise.all([
        db.getSetting('helius_api_key'),
        db.getSetting('watched_wallets'),
      ])

      console.log('API Key found:', !!apiKey)
      console.log('Wallets found:', walletsJson)

      if (!walletsJson) {
        console.log('No wallets configured - go to Import page to set up')
        return
      }

      const wallets = JSON.parse(walletsJson) as { address: string; chain: string }[]
      if (wallets.length === 0) return

      setSyncing(true)

      // Get existing trade IDs and signatures to avoid duplicates
      const existingTrades = await db.getTrades()
      const existingSignatures = new Set(
        existingTrades.map(t => (t as any).tx_signature).filter(Boolean)
      )
      // Fallback key for older trades without signatures
      const existingKeys = new Set(
        existingTrades.map(t => `${t.token_symbol}-${t.direction}-${t.entry_date}-${t.quantity.toFixed(4)}`)
      )

      const newTrades: Trade[] = []
      let correctedCount = 0
      const baseCurrencies = ['SOL', 'USDC', 'USDT', 'PYUSD', 'DAI', 'USD1']
      const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'USD1']

      // Track signatures processed in THIS sync batch to prevent duplicates
      const processedInBatch = new Set<string>()

      // Fetch current SOL price for USD conversion
      let solUsdPrice = 100 // Default fallback
      try {
        const solPriceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112')
        if (solPriceRes.ok) {
          const solPriceData = await solPriceRes.json()
          if (solPriceData.pairs?.[0]?.priceUsd) {
            solUsdPrice = parseFloat(solPriceData.pairs[0].priceUsd)
            console.log('Current SOL price:', solUsdPrice)
          }
        }
      } catch (e) {
        console.log('Failed to fetch SOL price, using default:', solUsdPrice)
      }

      // Routing/liquidity tokens that are intermediaries in multi-hop swaps
      // Skip any trades involving these to avoid recording intermediate routing legs
      const routingTokens = ['BONK', 'RAY', 'SRM', 'ORCA', 'MNGO', 'WSOL']

      for (const wallet of wallets) {
        if (wallet.chain !== 'solana') continue

        // Fetch recent transactions
        const response = await fetch(
          `https://api.helius.xyz/v0/addresses/${wallet.address}/transactions?api-key=${apiKey}&limit=100`
        )

        if (!response.ok) {
          console.error('Helius API error:', response.status, response.statusText)
          continue
        }

        const data = await response.json()
        console.log(`Fetched ${data.length} transactions from Helius`)

        // Log all transaction types to see what we're getting
        const txTypes = data.reduce((acc: Record<string, number>, tx: any) => {
          acc[tx.type] = (acc[tx.type] || 0) + 1
          return acc
        }, {})
        console.log('Transaction types:', txTypes)

        // Log newest transaction date
        if (data.length > 0) {
          const newestDate = new Date(data[0].timestamp * 1000)
          console.log('Newest transaction:', newestDate.toISOString(), data[0].type)
        }

        // Search for specific mint addresses for debugging
        const searchMint = '8116V1BW9zaXUM6pVhWVaAduKrLcEBi3RGXedKTrBAGS' // GSD token
        const matchingTx = data.find((tx: any) => JSON.stringify(tx).includes(searchMint))
        if (matchingTx) {
          console.log('Found trophy tomato transaction:', matchingTx.type, matchingTx.signature)
          console.log('GSD swap events:', JSON.stringify(matchingTx.events, null, 2))
          console.log('GSD tokenTransfers:', JSON.stringify(matchingTx.tokenTransfers, null, 2))
        } else {
          console.log('GSD transaction NOT in returned data - may need more time for Helius to index')
        }

        for (const tx of data) {
          // Skip if we've already processed this signature in this batch
          if (tx.signature && processedInBatch.has(tx.signature)) {
            continue
          }

          // Check if this is the trophy tomato transaction
          const isGSD = JSON.stringify(tx).includes(searchMint)
          // Check if this involves LORIA
          const txString = JSON.stringify(tx)
          const isLORIA = txString.toLowerCase().includes('loria')

          if (isGSD) {
            console.log('Processing trophy tomato, type:', tx.type, 'has swap:', !!tx.events?.swap)
          }
          if (isLORIA) {
            console.log('=== LORIA TRANSACTION DEBUG ===')
            console.log('LORIA tx.type:', tx.type, 'has swap:', !!tx.events?.swap)
            console.log('LORIA signature:', tx.signature)
            console.log('LORIA events.swap:', JSON.stringify(tx.events?.swap, null, 2))
            console.log('LORIA tokenTransfers:', JSON.stringify(tx.tokenTransfers, null, 2))
          }

          // Mark this signature as processed
          if (tx.signature) {
            processedInBatch.add(tx.signature)
          }

          // Check for SWAP or TRANSFER type (some DEX trades come as TRANSFER)
          if (isGSD) {
            console.log('GSD tx.type =', tx.type, 'isSwap=', tx.type === 'SWAP', 'isTransfer=', tx.type === 'TRANSFER')
          }

          if (tx.type !== 'SWAP' && tx.type !== 'TRANSFER') {
            if (isGSD) {
              console.log('GSD SKIPPED: type =', tx.type)
            }
            continue
          }

          if (isGSD) {
            console.log('GSD PROCESSING: type =', tx.type)
          }

          // Use swap events if available, otherwise try to build from tokenTransfers
          let swap = tx.events?.swap

          if (isLORIA) {
            console.log('LORIA has swap event:', !!swap)
            if (swap) {
              console.log('LORIA swap event:', JSON.stringify(swap, null, 2))
            }
          }

          // If no swap event but we have tokenTransfers, build swap-like structure
          if (!swap && tx.tokenTransfers && tx.tokenTransfers.length >= 1) {
            if (isGSD) {
              console.log('GSD: No swap event, using tokenTransfers fallback')
            }
            if (isLORIA) {
              console.log('LORIA: Using tokenTransfers fallback')
            }

            // Stablecoins and wrapped SOL to identify as "base" currencies
            const baseMints = [
              'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
              'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
              'So11111111111111111111111111111111111111112',  // Wrapped SOL
            ]

            // Since Helius returns transactions for this wallet, we don't need to filter by address
            // Instead, analyze the token flow to determine buy vs sell
            // For swaps: there's typically a base currency (SOL/USDC) and a token being traded

            // Get all unique mints in the transaction
            const mintSet = new Set<string>()
            for (const t of tx.tokenTransfers) {
              if (t.mint) mintSet.add(t.mint)
            }
            const allMints = Array.from(mintSet)

            // Find the "trade token" (non-base currency)
            const tradeMint = allMints.find(m => !baseMints.includes(m))

            // Find the "base token" (SOL/stablecoin) - prioritize stablecoins over wSOL
            // BUT: filter out small fixed amounts that are likely fees (e.g., $0.95 Fomo fee)
            const stablecoinTransfer = tx.tokenTransfers.find((t: any) =>
              (t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
               t.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') && // USDT
              // Exclude likely fee amounts (exactly $0.95 or very close)
              Math.abs(t.tokenAmount - 0.95) > 0.01 && t.tokenAmount > 1
            )
            const baseTransfer = stablecoinTransfer || tx.tokenTransfers.find((t: any) =>
              baseMints.includes(t.mint) && t.mint !== 'So11111111111111111111111111111111111111112' // Don't use wSOL as base
            )
            const tradeTransfers = tx.tokenTransfers.filter((t: any) => t.mint === tradeMint)

            if (isGSD) {
              console.log('GSD trade mint:', tradeMint)
              console.log('GSD base transfer:', baseTransfer)
              console.log('GSD trade transfers:', tradeTransfers)
            }

            // Calculate total SOL from native transfers
            const totalNativeOut = (tx.nativeTransfers || [])
              .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) / 2 // Divide by 2 since transfers are counted twice (from and to)

            if (tradeMint && tradeTransfers.length > 0) {
              // Get the largest trade transfer (the main one, not intermediate)
              const mainTradeTransfer = tradeTransfers.sort((a: any, b: any) =>
                (b.tokenAmount || 0) - (a.tokenAmount || 0)
              )[0]

              // Calculate SOL amount from native transfers
              const nativeSent = (tx.nativeTransfers || [])
                .filter((t: any) => t.amount > 10000)
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
              const solAmount = nativeSent / 1e9 / 2

              const tradeAmount = mainTradeTransfer.tokenAmount || 0
              const baseAmount = baseTransfer?.tokenAmount || solAmount
              const useNativeSOL = !baseTransfer && solAmount > 0

              // Determine direction: BUY vs SELL
              // For a SELL: user sends trade token, receives base token (USDC)
              // For a BUY: user sends base token (USDC), receives trade token
              //
              // Heuristic: Compare the fromUserAccount of the trade transfer with
              // the toUserAccount of the base transfer. If they match, it's a SELL
              // (same user is sending tokens and receiving USDC)

              // Determine buy vs sell by comparing transfer accounts with known wallet address
              // For a BUY: user sends base token (USDC/SOL) → baseFromUser matches wallet
              // For a SELL: user sends trade token → tradeFromUser matches wallet
              let isSellTransaction = false
              const walletLower = wallet.address.toLowerCase()

              if (baseTransfer && mainTradeTransfer) {
                const tradeFromUser = (mainTradeTransfer.fromUserAccount || '').toLowerCase()
                const tradeToUser = (mainTradeTransfer.toUserAccount || '').toLowerCase()
                const baseFromUser = (baseTransfer.fromUserAccount || '').toLowerCase()
                const baseToUser = (baseTransfer.toUserAccount || '').toLowerCase()

                if (isGSD) {
                  console.log('GSD direction detection:', {
                    wallet: walletLower,
                    tradeFromUser,
                    tradeToUser,
                    baseFromUser,
                    baseToUser,
                  })
                }
                if (isLORIA) {
                  console.log('=== LORIA FALLBACK DIRECTION DETECTION ===')
                  console.log('wallet:', walletLower)
                  console.log('tradeFromUser:', tradeFromUser)
                  console.log('tradeToUser:', tradeToUser)
                  console.log('baseFromUser:', baseFromUser)
                  console.log('baseToUser:', baseToUser)
                  console.log('mainTradeTransfer:', mainTradeTransfer)
                  console.log('baseTransfer:', baseTransfer)
                }

                // Primary: Check if user is sending the trade token (SELL) or base token (BUY)
                if (tradeFromUser === walletLower) {
                  // User is sending the trade token → SELL
                  isSellTransaction = true
                  if (isGSD) console.log('GSD: Detected SELL - user is sending trade token')
                } else if (baseFromUser === walletLower) {
                  // User is sending the base token → BUY
                  isSellTransaction = false
                  if (isGSD) console.log('GSD: Detected BUY - user is sending base token')
                } else if (tradeToUser === walletLower) {
                  // User is receiving the trade token → BUY
                  isSellTransaction = false
                  if (isGSD) console.log('GSD: Detected BUY - user is receiving trade token')
                } else if (baseToUser === walletLower) {
                  // User is receiving the base token → SELL
                  isSellTransaction = true
                  if (isGSD) console.log('GSD: Detected SELL - user is receiving base token')
                }
              }

              // Also check description for explicit sell indicators
              const desc = (tx.description || '').toLowerCase()
              if (isLORIA) {
                console.log('LORIA tx.description:', tx.description)
              }
              if (desc.includes('sold') || desc.includes('sell')) {
                isSellTransaction = true
                if (isLORIA) console.log('LORIA: desc contains sold/sell -> isSellTransaction = true')
              } else if (desc.includes('swapped')) {
                // Parse "swapped X TOKEN for Y SOL/USDC" pattern
                // If user swapped the trade token for base currency, it's a SELL
                const tradeSymbol = mainTradeTransfer?.symbol?.toLowerCase() || ''
                const swappedIdx = desc.indexOf('swapped')
                const forIdx = desc.indexOf(' for ')
                if (swappedIdx !== -1 && forIdx !== -1) {
                  const beforeFor = desc.slice(swappedIdx, forIdx)
                  const afterFor = desc.slice(forIdx)
                  // If the trade token appears before "for" and base currency after, it's a SELL
                  if (tradeSymbol && beforeFor.includes(tradeSymbol) &&
                      (afterFor.includes('sol') || afterFor.includes('usdc') || afterFor.includes('usdt'))) {
                    isSellTransaction = true
                    if (isLORIA) console.log('LORIA: desc pattern "swapped TOKEN for SOL/USDC" -> isSellTransaction = true')
                  } else if (isLORIA) {
                    console.log('LORIA: desc has swapped but pattern not matched')
                    console.log('  tradeSymbol:', tradeSymbol)
                    console.log('  beforeFor:', beforeFor)
                    console.log('  afterFor:', afterFor)
                  }
                }
              } else if (desc.includes('bought') || desc.includes('buy')) {
                // Don't override if we already detected correctly
                if (isLORIA) console.log('LORIA: desc contains bought/buy')
                if (!isSellTransaction) {
                  isSellTransaction = false
                }
              }

              if (isGSD) {
                console.log('GSD main trade transfer:', mainTradeTransfer)
                console.log('GSD base transfer:', baseTransfer)
                console.log('GSD trade amount:', tradeAmount, 'base amount:', baseAmount)
                console.log('GSD isSellTransaction:', isSellTransaction)
              }
              if (isLORIA) {
                console.log('=== LORIA FINAL FALLBACK DECISION ===')
                console.log('LORIA isSellTransaction:', isSellTransaction)
              }

              // Skip if we don't have meaningful amounts
              if (tradeAmount < 0.01 || baseAmount < 0.0001) {
                if (isGSD) {
                  console.log('GSD SKIPPED: insufficient amounts')
                }
                continue
              }

              if (isSellTransaction) {
                // SELL: user sends token, receives USDC
                swap = {
                  nativeInput: null,
                  nativeOutput: useNativeSOL ? { amount: solAmount * 1e9 } : null,
                  tokenInputs: [{
                    mint: mainTradeTransfer.mint,
                    tokenAmount: tradeAmount,
                    symbol: mainTradeTransfer.symbol || 'Unknown',
                    name: mainTradeTransfer.name || ''
                  }],
                  tokenOutputs: baseTransfer ? [{
                    mint: baseTransfer.mint,
                    tokenAmount: baseAmount,
                    symbol: baseTransfer.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 'USDT',
                    name: ''
                  }] : []
                }
              } else {
                // BUY: user sends USDC, receives token
                swap = {
                  nativeInput: useNativeSOL ? { amount: solAmount * 1e9 } : null,
                  nativeOutput: null,
                  tokenInputs: baseTransfer ? [{
                    mint: baseTransfer.mint,
                    tokenAmount: baseAmount,
                    symbol: baseTransfer.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 'USDT',
                    name: ''
                  }] : [],
                  tokenOutputs: [{
                    mint: mainTradeTransfer.mint,
                    tokenAmount: tradeAmount,
                    symbol: mainTradeTransfer.symbol || 'Unknown',
                    name: mainTradeTransfer.name || ''
                  }]
                }
              }

              if (isGSD) {
                console.log('GSD built swap:', JSON.stringify(swap, null, 2))
              }
            }
          }

          if (!swap) {
            if (isGSD) {
              console.log('GSD SKIPPED: no swap data available, events =', tx.events ? Object.keys(tx.events) : 'no events')
            }
            continue
          }
          let tokenIn = { symbol: '', amount: 0, mint: '', name: '', decimals: 9 }
          let tokenOut = { symbol: '', amount: 0, mint: '', name: '', decimals: 9 }

          // Debug: log first swap to see structure
          if (tx === data[0]) {
            console.log('Sample swap data:', JSON.stringify(swap, null, 2))
          }

          // Parse native SOL first
          if (swap.nativeInput?.amount > 0) {
            tokenIn = { symbol: 'SOL', amount: swap.nativeInput.amount / 1e9, mint: '', name: 'Solana', decimals: 9 }
          }
          if (swap.nativeOutput?.amount > 0) {
            tokenOut = { symbol: 'SOL', amount: swap.nativeOutput.amount / 1e9, mint: '', name: 'Solana', decimals: 9 }
          }

          // Parse token inputs - only if we don't already have SOL
          if (swap.tokenInputs?.[0] && tokenIn.symbol !== 'SOL') {
            const ti = swap.tokenInputs[0]
            if (ti.mint !== 'So11111111111111111111111111111111111111112') {
              // Handle both formats: rawTokenAmount (needs division) or tokenAmount (already decimal)
              let amount = 0
              if (ti.rawTokenAmount?.tokenAmount) {
                amount = Number(ti.rawTokenAmount.tokenAmount) / Math.pow(10, ti.rawTokenAmount.decimals || 9)
              } else if (ti.tokenAmount !== undefined) {
                amount = Number(ti.tokenAmount) // Already decimal from Helius
              }
              if (amount > 0) {
                tokenIn = { symbol: ti.symbol || ti.name || 'Unknown', amount, mint: ti.mint || '', name: ti.name || '', decimals: ti.rawTokenAmount?.decimals || 9 }
              }
            }
          }

          // Parse token outputs - use LAST token for multi-hop swap final destination
          if (swap.tokenOutputs?.length > 0 && tokenOut.symbol !== 'SOL') {
            // Get the last token output (final destination in multi-hop swaps)
            const to = swap.tokenOutputs[swap.tokenOutputs.length - 1]
            if (to.mint !== 'So11111111111111111111111111111111111111112') {
              // Handle both formats: rawTokenAmount (needs division) or tokenAmount (already decimal)
              let amount = 0
              if (to.rawTokenAmount?.tokenAmount) {
                amount = Number(to.rawTokenAmount.tokenAmount) / Math.pow(10, to.rawTokenAmount.decimals || 9)
              } else if (to.tokenAmount !== undefined) {
                amount = Number(to.tokenAmount) // Already decimal from Helius
              }
              if (amount > 0) {
                tokenOut = { symbol: to.symbol || to.name || 'Unknown', amount, mint: to.mint || '', name: to.name || '', decimals: to.rawTokenAmount?.decimals || 9 }
              }
            }
          }

          // If tokenIn is still empty but we have tokenInputs, try to parse anyway
          if (!tokenIn.symbol && swap.tokenInputs?.[0]) {
            const ti = swap.tokenInputs[0]
            const amount = ti.rawTokenAmount?.tokenAmount
              ? Number(ti.rawTokenAmount.tokenAmount) / Math.pow(10, ti.rawTokenAmount.decimals || 9)
              : ti.tokenAmount || 0
            if (amount > 0) {
              // Check if this is wrapped SOL
              if (ti.mint === 'So11111111111111111111111111111111111111112') {
                tokenIn = { symbol: 'SOL', amount, mint: '', name: 'Solana', decimals: 9 }
              } else {
                tokenIn = { symbol: ti.symbol || ti.name || 'Unknown', amount, mint: ti.mint || '', name: ti.name || '', decimals: ti.rawTokenAmount?.decimals || 9 }
              }
            }
          }

          // If tokenOut is still empty but we have tokenOutputs, try to parse anyway
          // Use the last output for multi-hop swaps
          if (!tokenOut.symbol && swap.tokenOutputs?.length > 0) {
            const to = swap.tokenOutputs[swap.tokenOutputs.length - 1]
            const amount = to.rawTokenAmount?.tokenAmount
              ? Number(to.rawTokenAmount.tokenAmount) / Math.pow(10, to.rawTokenAmount.decimals || 9)
              : to.tokenAmount || 0
            if (amount > 0) {
              // Check if this is wrapped SOL
              if (to.mint === 'So11111111111111111111111111111111111111112') {
                tokenOut = { symbol: 'SOL', amount, mint: '', name: 'Solana', decimals: 9 }
              } else {
                tokenOut = { symbol: to.symbol || to.name || 'Unknown', amount, mint: to.mint || '', name: to.name || '', decimals: to.rawTokenAmount?.decimals || 9 }
              }
            }
          }

          // Fallback: if we have Unknown -> Unknown, try to infer SOL from amounts
          // SOL amounts are typically 0.01 - 500, token amounts are typically much larger
          if (tokenIn.symbol === 'Unknown' && tokenOut.symbol === 'Unknown') {
            if (tokenIn.amount > 0 && tokenIn.amount < 500 && tokenOut.amount > 1000) {
              // tokenIn is likely SOL (small amount), tokenOut is token (large amount)
              tokenIn.symbol = 'SOL'
              tokenIn.name = 'Solana'
            } else if (tokenOut.amount > 0 && tokenOut.amount < 500 && tokenIn.amount > 1000) {
              // tokenOut is likely SOL (small amount), tokenIn is token (large amount)
              tokenOut.symbol = 'SOL'
              tokenOut.name = 'Solana'
            }
          }

          // Debug: log all swap pairs found
          if (tokenIn.symbol && tokenOut.symbol) {
            console.log(`Found swap: ${tokenIn.symbol} -> ${tokenOut.symbol} (${tokenIn.amount} -> ${tokenOut.amount})`)
          }

          // Special debug for trophy tomato
          if (isGSD) {
            console.log('GSD parsed:', { tokenIn, tokenOut })
          }

          if (!tokenIn.symbol || !tokenOut.symbol || tokenIn.amount === 0 || tokenOut.amount === 0) {
            if (isGSD) {
              console.log('GSD SKIPPED due to empty tokenIn/tokenOut')
            }
            continue
          }

          const tokenInSymbol = tokenIn.symbol.toUpperCase()
          const tokenOutSymbol = tokenOut.symbol.toUpperCase()

          // Skip any transaction involving routing tokens (intermediate hops)
          if (routingTokens.includes(tokenInSymbol) || routingTokens.includes(tokenOutSymbol)) {
            console.log(`Skipping routing token: ${tokenIn.symbol} -> ${tokenOut.symbol}`)
            continue
          }

          const tokenInIsBase = baseCurrencies.includes(tokenInSymbol)
          const tokenOutIsBase = baseCurrencies.includes(tokenOutSymbol)

          if (tokenInIsBase && tokenOutIsBase) continue
          if (tokenIn.symbol === 'SOL' && tokenIn.amount < 0.02) continue // Skip fees

          const isBuy = tokenInIsBase && !tokenOutIsBase
          const isSell = !tokenInIsBase && tokenOutIsBase

          // LORIA debug
          const isLORIASwap = tokenInSymbol.includes('LORIA') || tokenOutSymbol.includes('LORIA')
          if (isLORIASwap) {
            console.log('=== LORIA DIRECTION DEBUG ===')
            console.log('tx.signature:', tx.signature)
            console.log('tx.description:', tx.description)
            console.log('tokenIn:', tokenIn.symbol, tokenIn.amount)
            console.log('tokenOut:', tokenOut.symbol, tokenOut.amount)
            console.log('tokenInIsBase:', tokenInIsBase, 'tokenOutIsBase:', tokenOutIsBase)
            console.log('isBuy:', isBuy, 'isSell:', isSell)
          }

          // Direction validation from description - override if description contradicts parsed direction
          const descForValidation = (tx.description || '').toLowerCase()
          let directionCorrected = false

          // Determine what description implies about direction
          let descriptionImpliesSell = false
          let descriptionImpliesBuy = false

          if (descForValidation.includes('sold') || descForValidation.includes('sell')) {
            descriptionImpliesSell = true
          } else if (descForValidation.includes('bought') || descForValidation.includes('buy')) {
            descriptionImpliesBuy = true
          } else if (descForValidation.includes('swapped')) {
            // Parse "swapped X TOKEN for Y SOL/USDC" pattern
            // If the trade token (non-base) appears before "for" and base currency after, it's a SELL
            const swappedIdx = descForValidation.indexOf('swapped')
            const forIdx = descForValidation.indexOf(' for ')
            if (swappedIdx !== -1 && forIdx !== -1) {
              const beforeFor = descForValidation.slice(swappedIdx, forIdx).toLowerCase()
              const afterFor = descForValidation.slice(forIdx).toLowerCase()

              // Check which token is mentioned where
              const tradeTokenSymbol = (isBuy ? tokenOut.symbol : tokenIn.symbol).toLowerCase()
              const baseSymbols = ['sol', 'usdc', 'usdt', 'weth', 'eth']
              const hasTradeTokenBeforeFor = tradeTokenSymbol && beforeFor.includes(tradeTokenSymbol)
              const hasBaseAfterFor = baseSymbols.some(s => afterFor.includes(s))
              const hasTradeTokenAfterFor = tradeTokenSymbol && afterFor.includes(tradeTokenSymbol)
              const hasBaseBeforeFor = baseSymbols.some(s => beforeFor.includes(s))

              if (hasTradeTokenBeforeFor && hasBaseAfterFor) {
                // "swapped TOKEN for SOL" = SELL
                descriptionImpliesSell = true
                console.log(`Swapped pattern detected: ${tradeTokenSymbol} before FOR, base after FOR → SELL`)
              } else if (hasBaseBeforeFor && hasTradeTokenAfterFor) {
                // "swapped SOL for TOKEN" = BUY
                descriptionImpliesBuy = true
                console.log(`Swapped pattern detected: base before FOR, ${tradeTokenSymbol} after FOR → BUY`)
              }
            }
          }

          // Apply correction if description contradicts parsed direction
          if (descriptionImpliesSell && isBuy && !isSell) {
            console.log(`Direction correction: description implies SELL but parsed as BUY, swapping tokenIn/tokenOut for ${tokenInSymbol} -> ${tokenOutSymbol}`)
            const temp = { ...tokenIn }
            tokenIn = { ...tokenOut }
            tokenOut = temp
            directionCorrected = true
          } else if (descriptionImpliesBuy && isSell && !isBuy) {
            console.log(`Direction correction: description implies BUY but parsed as SELL, swapping tokenIn/tokenOut for ${tokenInSymbol} -> ${tokenOutSymbol}`)
            const temp = { ...tokenIn }
            tokenIn = { ...tokenOut }
            tokenOut = temp
            directionCorrected = true
          }

          // Recalculate isBuy/isSell after potential correction
          let finalIsBuy = isBuy
          let finalIsSell = isSell
          if (directionCorrected) {
            const newTokenInIsBase = baseCurrencies.includes(tokenIn.symbol.toUpperCase())
            const newTokenOutIsBase = baseCurrencies.includes(tokenOut.symbol.toUpperCase())
            finalIsBuy = newTokenInIsBase && !newTokenOutIsBase
            finalIsSell = !newTokenInIsBase && newTokenOutIsBase
            console.log(`After correction: isBuy=${finalIsBuy}, isSell=${finalIsSell}`)
          }

          // LORIA: log final decision
          if (isLORIASwap) {
            console.log('LORIA descriptionImpliesSell:', descriptionImpliesSell)
            console.log('LORIA descriptionImpliesBuy:', descriptionImpliesBuy)
            console.log('LORIA directionCorrected:', directionCorrected)
            console.log('LORIA finalIsBuy:', finalIsBuy, 'finalIsSell:', finalIsSell)
          }

          if (!finalIsBuy && !finalIsSell) {
            console.log(`Skipping non-buy/sell: ${tokenIn.symbol} -> ${tokenOut.symbol}`)
            continue
          }

          const txSignature = tx.signature
          const tradeDateTime = new Date(tx.timestamp * 1000).toISOString()
          const tradeToken = finalIsBuy ? tokenOut : tokenIn
          const baseToken = finalIsBuy ? tokenIn : tokenOut
          const quantity = tradeToken.amount
          const price = quantity > 0 ? baseToken.amount / quantity : 0
          const totalValue = baseToken.amount

          // Skip fee-only transactions (e.g., $0.95 Fomo fees)
          if (Math.abs(totalValue - 0.95) < 0.1 && baseToken.symbol === 'USDC') {
            console.log(`Skipping fee transaction: ${totalValue} USDC`)
            continue
          }

          // Skip trades with 0 quantity or very low value
          if (quantity < 0.01 || totalValue < 0.01) {
            console.log(`Skipping low-value transaction: qty=${quantity}, value=${totalValue}`)
            continue
          }

          // LORIA: log what we're adding
          if (isLORIASwap) {
            console.log(`LORIA FINAL: Adding ${finalIsBuy ? 'BUY' : 'SELL'} trade`)
          }

          console.log(`Processing: ${finalIsBuy ? 'BUY' : 'SELL'} ${tradeToken.symbol}, qty: ${quantity}, price: ${price}, value: ${totalValue}, date: ${tradeDateTime}`)

          // Check for existing trade with same signature - UPDATE with correct values
          if (txSignature) {
            const existingTrade = existingTrades.find(t => (t as any).tx_signature === txSignature)
            if (existingTrade) {
              const correctDirection = finalIsBuy ? 'buy' : 'sell'
              // Determine base currency and USD conversion
              const baseCurrencySymbol = baseToken.symbol.toUpperCase()
              const isStablecoin = stablecoins.includes(baseCurrencySymbol)
              const baseCurrencyUsdPrice = isStablecoin ? 1 : solUsdPrice
              const totalValueUsd = baseToken.amount * baseCurrencyUsdPrice

              // Always update with correct values (fixes corrupt data from old syncs)
              const updates: any = {
                direction: correctDirection,
                entry_price: price,
                quantity: quantity,
                total_value: baseToken.amount,
                base_currency: baseCurrencySymbol,
                base_currency_usd_price: baseCurrencyUsdPrice,
                total_value_usd: totalValueUsd,
              }

              console.log(`  FIXING: ${existingTrade.token_symbol} - old total_value=${existingTrade.total_value}, new total_value=${baseToken.amount}`)
              try {
                await db.updateTrade(existingTrade.id, updates)
                correctedCount++
              } catch (e) {
                console.log(`  Trade ${existingTrade.id} no longer exists, skipping update`)
              }
              continue
            }
          }

          // Check if this signature was already processed (prevents duplicates from same tx)
          if (txSignature && existingSignatures.has(txSignature)) {
            console.log(`  SKIPPED: already processed signature ${txSignature.slice(0, 8)}...`)
            continue
          }

          // Fallback duplicate check by key for older trades without signatures
          const dateOnly = tradeDateTime.split('T')[0]
          const key = `${tradeToken.symbol}-${finalIsBuy ? 'buy' : 'sell'}-${dateOnly}-${quantity.toFixed(4)}`
          if (existingKeys.has(key)) {
            console.log(`  SKIPPED: duplicate key ${key}`)
            continue
          }

          console.log(`  ADDING trade: direction=${finalIsBuy ? 'buy' : 'sell'}, symbol=${tradeToken.symbol}`)
          if (txSignature) existingSignatures.add(txSignature)
          existingKeys.add(key)

          // Determine base currency and USD conversion
          const baseCurrencySymbol = baseToken.symbol.toUpperCase()
          const isStablecoin = stablecoins.includes(baseCurrencySymbol)
          const baseCurrencyUsdPrice = isStablecoin ? 1 : solUsdPrice
          const totalValueUsd = baseToken.amount * baseCurrencyUsdPrice

          const newTrade: any = {
            id: generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token_symbol: tradeToken.symbol,
            token_name: tradeToken.name || null,
            token_chain: 'Solana',
            token_contract_address: tradeToken.mint || null,
            token_image: null,
            direction: finalIsBuy ? 'buy' : 'sell',
            entry_price: price,
            exit_price: null,
            quantity: quantity,
            total_value: baseToken.amount,
            entry_date: tradeDateTime,
            exit_date: null,
            platform: swap.innerSwaps?.[0]?.programInfo?.source || 'DEX',
            status: finalIsBuy ? 'open' : 'closed',
            pnl_amount: null,
            pnl_percent: null,
            market_cap_at_trade: null,
            tx_signature: txSignature || null,
            base_currency: baseCurrencySymbol,
            base_currency_usd_price: baseCurrencyUsdPrice,
            total_value_usd: totalValueUsd,
          }
          newTrades.push(newTrade)
        }
      }

      // If any trades were corrected, reload to reflect changes
      if (correctedCount > 0) {
        console.log(`Corrected ${correctedCount} trade direction(s)`)
        const updatedTrades = await db.getTrades()
        setTrades(updatedTrades)
      }

      if (newTrades.length > 0) {
        // Fetch token metadata for unknown tokens
        const unknownMints = newTrades
          .filter(t => t.token_symbol === 'Unknown' && t.token_contract_address)
          .map(t => t.token_contract_address as string)

        console.log('New trades:', newTrades.length, 'Unknown mints:', unknownMints.length, unknownMints)

        if (unknownMints.length > 0 && apiKey) {
          try {
            console.log('Fetching metadata for mints:', [...new Set(unknownMints)])
            const metadataResponse = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mintAccounts: [...new Set(unknownMints)] })
            })

            console.log('Metadata response status:', metadataResponse.status)

            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json()
              console.log('Metadata response:', metadata)
              const metadataMap: Record<string, { symbol: string; name?: string; image?: string }> = {}

              for (const token of metadata) {
                const symbol = token.onChainMetadata?.metadata?.data?.symbol
                  || token.legacyMetadata?.symbol
                  || 'Unknown'
                const name = token.onChainMetadata?.metadata?.data?.name
                  || token.legacyMetadata?.name
                const image = token.offChainMetadata?.metadata?.image
                  || token.legacyMetadata?.logoURI

                console.log('Token metadata:', token.account, '->', symbol, name)
                metadataMap[token.account] = { symbol, name, image }
              }

              // Update trades with metadata
              for (const trade of newTrades) {
                if (trade.token_contract_address && metadataMap[trade.token_contract_address]) {
                  const meta = metadataMap[trade.token_contract_address]
                  console.log('Updating trade:', trade.token_contract_address, 'from', trade.token_symbol, 'to', meta.symbol)
                  trade.token_symbol = meta.symbol
                  trade.token_name = meta.name || null
                  trade.token_image = meta.image || null
                }
              }

              console.log('Fetched metadata for', Object.keys(metadataMap).length, 'tokens')
            } else {
              console.error('Metadata fetch failed:', metadataResponse.status, await metadataResponse.text())
            }
          } catch (e) {
            console.error('Failed to fetch token metadata:', e)
          }
        }

        await db.bulkImportTrades(newTrades)
        setTrades(prev => [...newTrades, ...prev])
        console.log(`Synced ${newTrades.length} new trade(s)`)
      }

      // Also update existing Unknown tokens using DexScreener and Helius
      const existingUnknown = existingTrades
        .filter(t => t.token_symbol === 'Unknown' && t.token_contract_address)

      if (existingUnknown.length > 0) {
        const uniqueMints = [...new Set(existingUnknown.map(t => t.token_contract_address as string))]
        console.log('Updating', existingUnknown.length, 'existing Unknown tokens, unique mints:', uniqueMints.length)

        try {
          const metadataMap: Record<string, { symbol: string; name?: string; image?: string }> = {}

          // First try DexScreener in batches of 30
          for (let i = 0; i < uniqueMints.length; i += 30) {
            const batch = uniqueMints.slice(i, i + 30)
            const addressList = batch.join(',')

            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressList}`)
            if (response.ok) {
              const data = await response.json()
              if (data.pairs) {
                for (const pair of data.pairs) {
                  const addr = pair.baseToken?.address?.toLowerCase()
                  if (addr && pair.baseToken?.symbol && !metadataMap[addr]) {
                    metadataMap[addr] = {
                      symbol: pair.baseToken.symbol,
                      name: pair.baseToken.name,
                      image: pair.info?.imageUrl || null
                    }
                    console.log('DexScreener found:', addr, '->', pair.baseToken.symbol)
                  }
                }
              }
            }
          }

          // For mints not found in DexScreener, try Helius
          const missingMints = uniqueMints.filter(m => !metadataMap[m.toLowerCase()])
          if (missingMints.length > 0 && apiKey) {
            console.log('Trying Helius for', missingMints.length, 'remaining unknown tokens')
            const metadataResponse = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mintAccounts: missingMints })
            })

            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json()
              for (const token of metadata) {
                const symbol = token.onChainMetadata?.metadata?.data?.symbol
                  || token.legacyMetadata?.symbol
                if (symbol && symbol !== 'Unknown') {
                  const addr = token.account?.toLowerCase()
                  metadataMap[addr] = {
                    symbol,
                    name: token.onChainMetadata?.metadata?.data?.name || token.legacyMetadata?.name,
                    image: token.offChainMetadata?.metadata?.image || token.legacyMetadata?.logoURI
                  }
                  console.log('Helius found:', addr, '->', symbol)
                }
              }
            }
          }

          console.log('Total metadata found:', Object.keys(metadataMap).length, 'tokens')

          // Update trades in database
          let updatedCount = 0
          for (const trade of existingUnknown) {
            const addr = trade.token_contract_address?.toLowerCase()
            if (addr && metadataMap[addr]) {
              const meta = metadataMap[addr]
              console.log('Updating trade:', trade.id, 'to', meta.symbol)
              try {
                await db.updateTrade(trade.id, {
                  token_symbol: meta.symbol,
                  token_name: meta.name || null,
                  token_image: meta.image || null,
                })
                updatedCount++
              } catch (e) {
                console.log(`  Trade ${trade.id} no longer exists, skipping metadata update`)
              }
            }
          }

          if (updatedCount > 0) {
            // Reload trades to reflect updates
            const updatedTrades = await db.getTrades()
            setTrades(updatedTrades)
            console.log('Updated', updatedCount, 'Unknown tokens')
          }
        } catch (e) {
          console.error('Failed to update metadata via DexScreener:', e)
        }
      }

      // === BASE CHAIN SYNC (Blockscout API + Account Abstraction) ===
      const baseWallets = wallets.filter(w => w.chain === 'base')
      if (baseWallets.length > 0) {
        console.log('Syncing Base wallets:', baseWallets.length)

        // Fetch ETH price for WETH fallback (some sells route through WETH instead of USDC)
        let baseEthUsdPrice = 3000
        try {
          const ethPriceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006')
          if (ethPriceRes.ok) {
            const ethPriceData = await ethPriceRes.json()
            if (ethPriceData.pairs?.[0]?.priceUsd) {
              baseEthUsdPrice = parseFloat(ethPriceData.pairs[0].priceUsd)
            }
          }
        } catch (e) {
          console.log('Base sync: Failed to fetch WETH price, using default')
        }

        const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
        const USDbC_ADDRESS = '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ab'
        const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
        const baseStablecoinAddresses = [USDC_ADDRESS, USDbC_ADDRESS]

        for (const wallet of baseWallets) {
          const walletLower = wallet.address.toLowerCase()
          try {
            // Fetch token transfers from Blockscout (free, no key needed)
            let allTransfers: any[] = []
            let nextPageParams: any = null
            let pageCount = 0
            const maxPages = 10 // Lighter for sync vs full import

            while (pageCount < maxPages) {
              let url = `https://base.blockscout.com/api/v2/addresses/${wallet.address}/token-transfers?type=ERC-20`
              if (nextPageParams) {
                url += `&block_number=${nextPageParams.block_number}&index=${nextPageParams.index}`
              }

              const res = await fetch(url)
              if (!res.ok) {
                console.log('Base sync: Blockscout fetch failed for', wallet.address)
                break
              }

              const data = await res.json()
              const items = data.items || []
              allTransfers = [...allTransfers, ...items]
              pageCount++

              if (data.next_page_params) {
                nextPageParams = data.next_page_params
              } else {
                break
              }
            }

            if (allTransfers.length === 0) {
              console.log('Base sync: no transfers for wallet', wallet.address.slice(0, 8))
              continue
            }

            console.log(`Base sync: ${allTransfers.length} token transfers for ${wallet.address.slice(0, 8)}...`)

            // Group by tx hash and classify
            const txMap: Record<string, { transfers: any[]; method: string; timestamp: string }> = {}
            for (const item of allTransfers) {
              const txHash = item.transaction_hash
              const fromAddr = item.from?.hash?.toLowerCase()
              const toAddr = item.to?.hash?.toLowerCase()
              if (fromAddr !== walletLower && toAddr !== walletLower) continue

              if (!txMap[txHash]) {
                txMap[txHash] = { transfers: [], method: item.method || '', timestamp: item.timestamp || '' }
              }
              txMap[txHash].transfers.push(item)
            }

            let aaUserAddress: string | null = null // Discovered from first buy tx

            for (const [txHash, txData] of Object.entries(txMap)) {
              // Skip if already imported
              if (existingSignatures.has(txHash)) continue

              const { transfers, method, timestamp } = txData

              // Skip likely airdrops (small fixed amounts from multicall/batchTransfer)
              if (transfers.length === 1) {
                const t = transfers[0]
                const total = t.total || {}
                const dec = parseInt(total.decimals || '18')
                const value = Number(total.value || '0') / Math.pow(10, dec)
                if ((method === 'multicall' || method === 'batchTransfer') && value <= 100 && t.to?.hash?.toLowerCase() === walletLower) {
                  continue
                }
              }

              // Determine buy vs sell
              const outgoing = transfers.filter((t: any) => t.from?.hash?.toLowerCase() === walletLower)
              const incoming = transfers.filter((t: any) => t.to?.hash?.toLowerCase() === walletLower)
              const isBuy = incoming.length > 0 && outgoing.length === 0
              const isSell = outgoing.length > 0
              if (!isBuy && !isSell) continue

              // Get meme token details
              const memeTransfer = isBuy ? incoming[0] : outgoing[0]
              const memeToken = memeTransfer.token || {}
              const memeTotal = memeTransfer.total || {}
              const memeDec = parseInt(memeTotal.decimals || '18')
              const memeAmount = Number(memeTotal.value || '0') / Math.pow(10, memeDec)
              if (memeAmount === 0) continue

              const memeAddress = (memeToken.address_hash || '').toLowerCase()
              if (baseStablecoinAddresses.includes(memeAddress)) continue // Skip stablecoin-only

              // Fetch tx details from Blockscout to find USDC amount (AA architecture)
              let usdcAmount = 0
              try {
                await new Promise(resolve => setTimeout(resolve, 200)) // Rate limit
                const txRes = await fetch(`https://base.blockscout.com/api/v2/transactions/${txHash}`)
                if (txRes.ok) {
                  const txDetails = await txRes.json()
                  const txTokenTransfers = txDetails.token_transfers || []

                  // Discover AA user address from buy tx decoded input
                  if (isBuy && !aaUserAddress && txDetails.decoded_input?.parameters) {
                    const userParam = txDetails.decoded_input.parameters.find((p: any) => p.name === 'user')
                    if (userParam?.value) {
                      aaUserAddress = userParam.value.toLowerCase()
                      console.log('Base sync: discovered AA user address:', aaUserAddress)
                    }
                  }

                  // Find USDC transfers in this tx
                  for (const tt of txTokenTransfers) {
                    const ttToken = tt.token || {}
                    const ttAddress = (ttToken.address_hash || '').toLowerCase()
                    if (!baseStablecoinAddresses.includes(ttAddress)) continue

                    const ttTotal = tt.total || {}
                    const ttDec = parseInt(ttTotal.decimals || '6')
                    const ttValue = Number(ttTotal.value || '0') / Math.pow(10, ttDec)
                    const ttFrom = (tt.from?.hash || '').toLowerCase()
                    const ttTo = (tt.to?.hash || '').toLowerCase()

                    if (isBuy && aaUserAddress && ttFrom === aaUserAddress) {
                      usdcAmount = ttValue
                      break
                    } else if (isSell && aaUserAddress && ttTo === aaUserAddress) {
                      usdcAmount = ttValue
                      break
                    } else if (isBuy && !aaUserAddress && ttValue > 0) {
                      usdcAmount = ttValue
                      break
                    } else if (isSell && ttValue > 0) {
                      usdcAmount = ttValue
                    }
                  }

                  // WETH fallback: some sells route through WETH instead of USDC
                  if (usdcAmount === 0 && isSell) {
                    let maxWethAmount = 0
                    for (const tt of txTokenTransfers) {
                      const ttToken = tt.token || {}
                      const ttAddress = (ttToken.address_hash || '').toLowerCase()
                      if (ttAddress !== WETH_ADDRESS) continue

                      const ttTotal = tt.total || {}
                      const ttDec = parseInt(ttTotal.decimals || '18')
                      const ttValue = Number(ttTotal.value || '0') / Math.pow(10, ttDec)
                      if (ttValue > maxWethAmount) {
                        maxWethAmount = ttValue
                      }
                    }
                    if (maxWethAmount > 0) {
                      usdcAmount = maxWethAmount * baseEthUsdPrice
                      console.log(`Base sync: WETH fallback ${maxWethAmount.toFixed(6)} WETH = $${usdcAmount.toFixed(2)}`)
                    }
                  }
                }
              } catch (e) {
                console.log(`Base sync: failed to fetch tx details for ${txHash.slice(0, 12)}...`)
              }

              if (usdcAmount === 0) continue

              const memeSymbol = memeToken.symbol || 'Unknown'
              const memeName = memeToken.name || null
              const tradeDateTime = new Date(timestamp).toISOString()
              const price = usdcAmount / memeAmount

              // Duplicate check by key
              const dateOnly = tradeDateTime.split('T')[0]
              const key = `${memeSymbol}-${isBuy ? 'buy' : 'sell'}-${dateOnly}-${memeAmount.toFixed(4)}`
              if (existingKeys.has(key)) continue

              console.log(`Base sync: ${isBuy ? 'BUY' : 'SELL'} ${memeSymbol}, qty: ${memeAmount.toFixed(4)}, value: $${usdcAmount.toFixed(2)}`)

              existingSignatures.add(txHash)
              existingKeys.add(key)

              const newTrade: any = {
                id: generateId(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                token_symbol: memeSymbol,
                token_name: memeName,
                token_chain: 'Base',
                token_contract_address: memeAddress || null,
                token_image: null,
                direction: isBuy ? 'buy' : 'sell',
                entry_price: price,
                exit_price: null,
                quantity: memeAmount,
                total_value: usdcAmount,
                entry_date: tradeDateTime,
                exit_date: null,
                platform: 'Fomo',
                status: isBuy ? 'open' : 'closed',
                pnl_amount: null,
                pnl_percent: null,
                market_cap_at_trade: null,
                tx_signature: txHash,
                base_currency: 'USDC',
                base_currency_usd_price: 1,
                total_value_usd: usdcAmount,
              }
              newTrades.push(newTrade)
            }
          } catch (e) {
            console.error('Base sync error for wallet', wallet.address, e)
          }
        }

        // Import Base trades
        if (newTrades.length > 0) {
          await db.bulkImportTrades(newTrades)
          setTrades(prev => [...newTrades, ...prev])
          console.log(`Synced ${newTrades.length} new Base trade(s)`)
        }
      }

      setLastSync(new Date())
      setNewTradesCount(newTrades.length)
    } catch (error) {
      console.error('Failed to sync:', error)
    } finally {
      setSyncing(false)
    }
  }

  const loadTokenJournal = useCallback(async (symbol: string) => {
    try {
      const [note, tagIds] = await Promise.all([
        db.getTokenNote(symbol),
        db.getTokenTagIds(symbol),
      ])

      setTokenJournals(prev => {
        const updated: Record<string, TokenJournalData> = {
          ...prev,
          [symbol]: {
            note: note || null,
            tagIds: tagIds || [],
            thesis: note?.thesis || '',
            narrative: note?.narrative || '',
            reflection: note?.reflection || '',
            lessonsLearned: note?.lessons_learned || '',
            confidenceLevel: note?.confidence_level || 5,
            emotionalState: (note?.emotional_state || '') as EmotionalState | '',
            sellReason: (note as any)?.sell_reason || '',
            copyTrader: (note as any)?.copy_trader || '',
          }
        }
        tokenJournalsRef.current = updated
        return updated
      })
    } catch (error) {
      console.error('Failed to load token journal:', error)
    }
  }, [])

  const handleSearch = debounce((value: string) => {
    setSearchQuery(value.toLowerCase())
  }, 150)

  const toggleToken = async (identifier: string, symbol: string) => {
    if (expandedToken === identifier) {
      setExpandedToken(null)
      setExpandedTokenSymbol(null)
    } else {
      setExpandedToken(identifier)
      setExpandedTokenSymbol(symbol)
      setActiveTab('trades')
      await loadTokenJournal(symbol)
    }
  }

  const updateTokenJournal = (symbol: string, field: keyof TokenJournalData, value: any) => {
    setTokenJournals(prev => {
      const updated = {
        ...prev,
        [symbol]: { ...prev[symbol], [field]: value }
      }
      tokenJournalsRef.current = updated
      return updated
    })

    // Auto-save with debounce
    if (autoSaveTimers.current[symbol]) {
      clearTimeout(autoSaveTimers.current[symbol])
    }
    autoSaveTimers.current[symbol] = setTimeout(() => {
      autoSaveTokenJournal(symbol)
    }, 1000)
  }

  const autoSaveTokenJournal = async (symbol: string) => {
    const journal = tokenJournalsRef.current[symbol]
    if (!journal) return

    setSavingToken(symbol)
    try {
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
        sell_reason: journal.sellReason || null,
        copy_trader: journal.copyTrader || null,
      }
      const savedNote = await db.upsertTokenNote(noteData)
      await db.setTokenTags(symbol, journal.tagIds)

      setTokenJournals(prev => {
        const updated = {
          ...prev,
          [symbol]: { ...prev[symbol], note: savedNote }
        }
        tokenJournalsRef.current = updated
        return updated
      })
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSavingToken(null)
    }
  }

  const handleToggleTag = (symbol: string, tagId: string) => {
    setTokenJournals(prev => {
      const existing = prev[symbol] || {
        note: null,
        tagIds: [],
        thesis: '',
        narrative: '',
        reflection: '',
        lessonsLearned: '',
        confidenceLevel: 5,
        emotionalState: '',
        sellReason: '',
        copyTrader: '',
      }

      const currentTags = existing.tagIds || []
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter(id => id !== tagId)
        : [...currentTags, tagId]

      // Save to DB immediately
      db.setTokenTags(symbol, newTags)

      const updated = {
        ...prev,
        [symbol]: { ...existing, tagIds: newTags }
      }
      tokenJournalsRef.current = updated
      return updated
    })
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      const newTag: TagType = {
        id: generateId(),
        name: newTagName.trim(),
        category: 'meta',
        parent_tag_id: null,
        color: null,
        created_at: new Date().toISOString(),
      }

      await db.createTag(newTag)
      setAllTags([...allTags, newTag])

      setNewTagName('')
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      await db.deleteTag(tagId)
      setAllTags(allTags.filter(t => t.id !== tagId))
      // Also remove from any token journals in state
      setTokenJournals(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(symbol => {
          if (updated[symbol]?.tagIds?.includes(tagId)) {
            updated[symbol] = {
              ...updated[symbol],
              tagIds: updated[symbol].tagIds.filter(id => id !== tagId)
            }
          }
        })
        return updated
      })
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await db.deleteTrade(id)
      setTrades(trades.filter(t => t.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleDeleteToken = async (contractAddress: string | null, symbol: string) => {
    try {
      // Filter by contract address if available, otherwise by symbol
      const tokenTrades = contractAddress
        ? trades.filter(t => t.token_contract_address?.toLowerCase() === contractAddress.toLowerCase())
        : trades.filter(t => t.token_symbol.toUpperCase() === symbol.toUpperCase() && !t.token_contract_address)

      for (const trade of tokenTrades) {
        await db.deleteTrade(trade.id)
      }

      const remainingTrades = contractAddress
        ? trades.filter(t => t.token_contract_address?.toLowerCase() !== contractAddress.toLowerCase())
        : trades.filter(t => !(t.token_symbol.toUpperCase() === symbol.toUpperCase() && !t.token_contract_address))

      setTrades(remainingTrades)
      setExpandedToken(null)
    } catch (error) {
      console.error('Failed to delete token:', error)
    }
  }

  const handleClosePosition = async (contractAddress: string | null, symbol: string) => {
    console.log('handleClosePosition called with:', { contractAddress, symbol })
    try {
      // Filter by contract address if available, otherwise by symbol
      const tokenTrades = contractAddress
        ? trades.filter(t => t.token_contract_address?.toLowerCase() === contractAddress.toLowerCase())
        : trades.filter(t => t.token_symbol.toUpperCase() === symbol.toUpperCase() && !t.token_contract_address)

      if (tokenTrades.length === 0) {
        console.log('No trades found')
        return
      }

      for (const trade of tokenTrades) {
        await db.updateTrade(trade.id, { status: 'closed' })
      }

      // Update local state
      setTrades(prevTrades =>
        prevTrades.map(t => {
          const matches = contractAddress
            ? t.token_contract_address?.toLowerCase() === contractAddress.toLowerCase()
            : t.token_symbol.toUpperCase() === symbol.toUpperCase() && !t.token_contract_address
          return matches ? { ...t, status: 'closed' as const } : t
        })
      )
    } catch (error) {
      console.error('Failed to close position:', error)
    }
  }

  const openManualSell = (pos: TokenPosition) => {
    setManualSellToken(pos)
    setSellQuantity(pos.netQuantity.toString())
    // Pre-fill with current price if available
    setSellPrice(pos.currentPrice ? pos.currentPrice.toString() : '')
    setSellDate(new Date().toISOString().split('T')[0])
    setSellMarketCap('')
  }

  const setSellPercentage = (percent: number) => {
    if (!manualSellToken) return
    const amount = manualSellToken.netQuantity * (percent / 100)
    setSellQuantity(amount.toString())
  }

  const handleManualSell = async () => {
    if (!manualSellToken) return

    const quantity = parseFloat(sellQuantity)
    const price = parseFloat(sellPrice)
    const marketCap = sellMarketCap ? parseFloat(sellMarketCap) : null

    if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price <= 0) return

    const totalValue = quantity * price

    try {
      const newTrade: Trade = {
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        token_symbol: manualSellToken.symbol,
        token_name: manualSellToken.name,
        token_chain: manualSellToken.chain,
        token_contract_address: manualSellToken.contractAddress,
        token_image: manualSellToken.image,
        direction: 'sell',
        entry_price: price,
        exit_price: null,
        quantity: quantity,
        total_value: totalValue,
        entry_date: sellDate,
        exit_date: null,
        platform: 'Manual',
        status: 'closed',
        pnl_amount: null,
        pnl_percent: null,
        market_cap_at_trade: marketCap,
        base_currency: null, // Unknown for manual entry
        base_currency_usd_price: null,
        total_value_usd: totalValue, // Assume manual entries are in USD
      }

      await db.createTrade(newTrade)
      setTrades([...trades, newTrade])
      setManualSellToken(null)
    } catch (error) {
      console.error('Failed to create sell:', error)
    }
  }

  // Filter and group trades
  const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USD1', 'USDbC']
  // Base/native tokens to filter out (they're currencies, not traded positions)
  const nativeTokens: Record<string, string[]> = {
    'SOL': ['So11111111111111111111111111111111111111112'],
    'WETH': ['0x4200000000000000000000000000000000000006'],
    'ETH': [],
  }

  // Build set of tokens that have ANY signed trade (these were synced from Helius/Basescan)
  const signedTokens = new Set<string>()
  const signedContracts = new Set<string>()
  trades.forEach(t => {
    if ((t as any).tx_signature) {
      signedTokens.add(t.token_symbol.toUpperCase())
      if (t.token_contract_address) {
        signedContracts.add(t.token_contract_address.toLowerCase())
      }
    }
  })

  const filteredTrades = trades.filter(t => {
    const symbol = t.token_symbol.toUpperCase()
    // Filter out stablecoins
    if (stablecoins.includes(symbol)) return false
    // Filter out native/wrapped tokens (SOL, WETH, ETH)
    if (nativeTokens[symbol]) {
      const knownAddresses = nativeTokens[symbol]
      if (knownAddresses.length === 0) return false // Always filter (e.g., ETH)
      if (!t.token_contract_address || knownAddresses.includes(t.token_contract_address)) return false
    }

    // Remove ALL unsigned trades for tokens that have signed trades
    // Signed trades from Helius are the source of truth
    if (!(t as any).tx_signature) {
      const tokenHasSigned = signedTokens.has(symbol) ||
        (t.token_contract_address && signedContracts.has(t.token_contract_address.toLowerCase()))
      if (tokenHasSigned) {
        return false
      }
    }

    // Remove $0 value trades
    if (t.total_value === 0 && t.entry_price === 0) return false
    // Remove Fomo fee entries ($0.95)
    if (Math.abs(t.total_value - 0.95) < 0.05) return false

    return true
  })

  // Helper to get USD value for a trade
  const getTradeUsdValue = (trade: Trade): number => {
    // PRIORITY 1: Use stored total_value_usd if available (most accurate)
    if (trade.total_value_usd != null && trade.total_value_usd > 0) {
      return trade.total_value_usd
    }

    // PRIORITY 2: For stablecoin base trades, entry_price * quantity = USD value
    const baseCurrency = ((trade as any).base_currency || '').toUpperCase()
    const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'UST', 'FRAX', 'TUSD', 'USDP', 'GUSD', 'LUSD', 'MIM', 'DOLA', 'CRVUSD', 'PYUSD']
    if (stablecoins.includes(baseCurrency)) {
      const calculatedValue = trade.entry_price * trade.quantity
      if (calculatedValue > 0) return calculatedValue
    }

    // PRIORITY 3: For SOL/WETH base trades, convert using stored base_currency_usd_price
    const baseCurrencyUsdPrice = (trade as any).base_currency_usd_price
    if (baseCurrencyUsdPrice && baseCurrencyUsdPrice > 0) {
      // total_value is in base currency (SOL), multiply by USD price
      const usdValue = trade.total_value * baseCurrencyUsdPrice
      if (usdValue > 0) return usdValue
    }

    // PRIORITY 4: Fallback to total_value (might be wrong for non-USD bases)
    return trade.total_value
  }

  const positions: TokenPosition[] = Object.values(
    filteredTrades.reduce((groups: Record<string, TokenPosition>, trade) => {
      // Group by contract address if available, otherwise by symbol
      // This ensures all trades for the same token are grouped even if symbol varies
      const key = trade.token_contract_address?.toLowerCase() || trade.token_symbol.toUpperCase()

      if (!groups[key]) {
        groups[key] = {
          symbol: trade.token_symbol,
          name: trade.token_name,
          chain: trade.token_chain,
          contractAddress: trade.token_contract_address,
          image: trade.token_image,
          buys: [],
          sells: [],
          totalBought: 0,
          totalSold: 0,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          realizedPnl: 0,
          netQuantity: 0,
          hasOpenPosition: false,
          totalInvested: 0,
          totalReturned: 0,
          totalInvestedUsd: 0,
          totalReturnedUsd: 0,
          realizedPnlUsd: 0,
          currentPrice: null,
          priceChange24h: null,
          unrealizedPnl: 0,
          unrealizedValue: 0,
        }
      }

      if (!groups[key].contractAddress && trade.token_contract_address) {
        groups[key].contractAddress = trade.token_contract_address
      }
      if (!groups[key].image && trade.token_image) {
        groups[key].image = trade.token_image
      }
      // Prefer non-Unknown symbol
      if (groups[key].symbol === 'Unknown' && trade.token_symbol !== 'Unknown') {
        groups[key].symbol = trade.token_symbol
        groups[key].name = trade.token_name
      }

      const tradeUsdValue = getTradeUsdValue(trade)

      if (trade.direction === 'buy') {
        groups[key].buys.push(trade)
        groups[key].totalBought += trade.quantity
        groups[key].totalInvested += trade.total_value
        groups[key].totalInvestedUsd += tradeUsdValue
      } else {
        groups[key].sells.push(trade)
        groups[key].totalSold += trade.quantity
        groups[key].totalReturned += trade.total_value
        groups[key].totalReturnedUsd += tradeUsdValue
      }

      return groups
    }, {})
  ).map(pos => {
    pos.avgBuyPrice = pos.totalBought > 0 ? pos.totalInvested / pos.totalBought : 0
    pos.avgSellPrice = pos.totalSold > 0 ? pos.totalReturned / pos.totalSold : 0
    pos.netQuantity = pos.totalBought - pos.totalSold
    // Position is open if net quantity > 0 AND at least one trade is not closed
    const allTradesClosed = [...pos.buys, ...pos.sells].every(t => t.status === 'closed')
    pos.hasOpenPosition = pos.netQuantity > 0 && !allTradesClosed

    // Calculate realized P&L in native units (for display)
    if (pos.totalSold > 0 && pos.avgBuyPrice > 0) {
      pos.realizedPnl = (pos.avgSellPrice - pos.avgBuyPrice) * pos.totalSold
    }

    // Calculate realized P&L in USD
    // Cost basis of sold tokens = (totalInvestedUsd / totalBought) * totalSold
    if (pos.totalSold > 0 && pos.totalBought > 0) {
      const avgCostPerTokenUsd = pos.totalInvestedUsd / pos.totalBought
      const costBasisOfSoldUsd = avgCostPerTokenUsd * pos.totalSold
      pos.realizedPnlUsd = pos.totalReturnedUsd - costBasisOfSoldUsd
    }

    // Add live price data
    const liveData = pos.contractAddress ? livePrices[pos.contractAddress.toLowerCase()] : null
    if (liveData) {
      pos.currentPrice = liveData.price
      pos.priceChange24h = liveData.priceChange24h
      if (pos.hasOpenPosition && pos.avgBuyPrice > 0) {
        pos.unrealizedValue = pos.netQuantity * liveData.price
        pos.unrealizedPnl = (liveData.price - pos.avgBuyPrice) * pos.netQuantity
      }
    }

    pos.buys.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    pos.sells.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())

    return pos
  }).filter(pos => {
    // Status filter
    if (statusFilter === 'open' && !pos.hasOpenPosition) return false
    if (statusFilter === 'closed' && pos.hasOpenPosition) return false
    // Search filter
    if (searchQuery) {
      return pos.symbol.toLowerCase().includes(searchQuery) ||
             pos.name?.toLowerCase().includes(searchQuery)
    }
    return true
  }).sort((a, b) => {
    // Sort by most recent trade date (newest first)
    const aLatest = Math.max(...[...a.buys, ...a.sells].map(t => new Date(t.entry_date).getTime()))
    const bLatest = Math.max(...[...b.buys, ...b.sells].map(t => new Date(t.entry_date).getTime()))
    return bLatest - aLatest
  })

  // Calculate totals (using USD values for accuracy)
  const totalRealizedPnl = positions.reduce((sum, p) => sum + p.realizedPnlUsd, 0)
  const totalUnrealizedValue = positions.reduce((sum, p) => {
    if (p.hasOpenPosition && p.currentPrice) {
      return sum + (p.netQuantity * p.currentPrice)
    }
    return sum
  }, 0)
  // Unrealized P&L = current value of open positions - their cost basis
  const totalOpenCostBasis = positions.reduce((sum, p) => {
    if (p.hasOpenPosition && p.totalBought > 0) {
      // Cost basis of remaining tokens: avg buy price × remaining quantity
      const avgCostPerToken = p.totalInvestedUsd / p.totalBought
      return sum + (avgCostPerToken * p.netQuantity)
    }
    return sum
  }, 0)
  const totalUnrealizedPnl = totalUnrealizedValue - totalOpenCostBasis

  const openCount = positions.filter(p => p.hasOpenPosition).length
  const closedWithPnl = positions.filter(p => p.totalSold > 0)
  const winCount = closedWithPnl.filter(p => p.realizedPnlUsd > 0).length
  const winRate = closedWithPnl.length > 0 ? (winCount / closedWithPnl.length) * 100 : 0

  const totalBuysUsd = positions.reduce((sum, p) => sum + p.totalInvestedUsd, 0)
  const totalSellsUsd = positions.reduce((sum, p) => sum + p.totalReturnedUsd, 0)

  // Debug P&L calculation
  console.log('=== P&L DEBUG ===')
  console.log('totalBuysUsd:', totalBuysUsd.toFixed(2))
  console.log('totalSellsUsd:', totalSellsUsd.toFixed(2))
  console.log('totalRealizedPnl:', totalRealizedPnl.toFixed(2))
  console.log('totalUnrealizedValue:', totalUnrealizedValue.toFixed(2))
  console.log('totalOpenCostBasis:', totalOpenCostBasis.toFixed(2))
  console.log('totalUnrealizedPnl:', totalUnrealizedPnl.toFixed(2))

  // Show top 5 positions by invested amount
  const topPositions = [...positions].sort((a, b) => b.totalInvestedUsd - a.totalInvestedUsd).slice(0, 5)
  console.log('Top 5 positions by invested:')
  topPositions.forEach(p => {
    console.log(`  ${p.symbol}: invested=${p.totalInvestedUsd.toFixed(2)}, returned=${p.totalReturnedUsd.toFixed(2)}, buys=${p.buys.length}, sells=${p.sells.length}`)
  })

  // Portfolio P&L: when initial capital and wallet balance are set, use them for accurate P&L
  // P&L = (wallet_balance + open_position_value) - initial_capital
  // This bypasses trade-by-trade calculation which can be inaccurate due to missing/duplicate trades
  const hasPortfolioSettings = initialCapital !== null && walletBalance !== null
  const portfolioPnl = hasPortfolioSettings
    ? (walletBalance + totalUnrealizedValue) - initialCapital
    : null
  const tradePnl = totalRealizedPnl + totalUnrealizedPnl

  const totalPnlUsd = portfolioPnl !== null ? portfolioPnl : tradePnl
  const totalInvestedUsd = hasPortfolioSettings ? initialCapital : (totalBuysUsd - totalSellsUsd)
  const totalReturnedUsd = totalUnrealizedValue // Current value of open positions
  const totalPnlPercent = hasPortfolioSettings && initialCapital > 0
    ? (totalPnlUsd / initialCapital) * 100
    : (totalOpenCostBasis > 0 ? (totalUnrealizedPnl / totalOpenCostBasis) * 100 :
      (totalBuysUsd > 0 ? (tradePnl / totalBuysUsd) * 100 : 0))

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  // Empty state
  if (positions.length === 0 && !searchQuery) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-medium mb-2">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Import your wallet to start tracking positions.
          </p>
          <Link href="/import">
            <Button>Import Wallet</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter Tabs */}
      <div className="border-b px-4 py-1.5 flex items-center gap-1">
        {(['all', 'open', 'closed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1 text-xs transition-colors ${
              statusFilter === filter
                ? 'bg-foreground text-background font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {filter === 'all' ? 'All' : filter === 'open' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>

      {/* Analytics Bar */}
      <div className="border-b px-4 py-2 text-xs">
        {/* Mobile: Scrollable row */}
        <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 md:justify-between">
          <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
            <div className="flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L</div>
              <div className={`text-sm font-medium tabular-nums ${getPnlColor(totalPnlUsd)}`}>
                {formatCurrency(totalPnlUsd)}
              </div>
            </div>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Win%</div>
              <div className="text-sm font-medium tabular-nums">{winRate.toFixed(0)}%</div>
            </div>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Open</div>
              <div className="text-sm font-medium tabular-nums">{openCount}</div>
            </div>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {hasPortfolioSettings ? 'Capital' : 'Deployed'}
              </div>
              <div className="text-sm font-medium tabular-nums">{formatCurrency(totalInvestedUsd)}</div>
            </div>
            {hasPortfolioSettings && (
              <>
                <div className="h-6 w-px bg-border hidden md:block" />
                <div className="flex-shrink-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Wallet</div>
                  <div className="text-sm font-medium tabular-nums">{formatCurrency(walletBalance)}</div>
                </div>
              </>
            )}
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Value</div>
              <div className="text-sm font-medium tabular-nums">{formatCurrency(totalReturnedUsd)}</div>
            </div>
            {totalInvestedUsd > 0 && (totalReturnedUsd > 0 || totalUnrealizedValue > 0) && (
              <>
                <div className="h-6 w-px bg-border hidden md:block" />
                <div className="flex-shrink-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L %</div>
                  <div className={`text-sm font-medium tabular-nums ${getPnlColor(totalPnlPercent)}`}>
                    {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}%
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          <button
            onClick={fullResync}
            disabled={syncing}
            className="text-[10px] text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete all trades and re-sync from scratch"
          >
            Reset
          </button>
          <button
            onClick={removeDuplicates}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            title="Remove duplicate trades"
          >
            Dedup
          </button>
          <button
            onClick={recalculateUsdValues}
            disabled={syncing}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Recalculate USD values for all trades (preserves journal entries)"
          >
            Fix USD
          </button>
          <button
            onClick={() => {
              setNewTradesCount(0)
              syncNewTrades()
            }}
            disabled={syncing}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Sync new trades'}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : newTradesCount > 0 ? `+${newTradesCount} new` : 'Sync'}
          </button>
          {lastPriceUpdate && (
            <div className="text-[9px] text-muted-foreground hidden md:block">
              {lastPriceUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-7 w-24 md:w-40 h-7 text-xs bg-muted border-0"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="flex-1 overflow-auto md:hidden">
        <div className="divide-y">
          {positions.map((pos) => {
            const posKey = pos.contractAddress?.toLowerCase() || pos.symbol
            const isExpanded = expandedToken === posKey
            const journal = tokenJournals[pos.symbol]

            // Calculate P&L percent for display
            const getPnlPercent = () => {
              if (pos.totalInvestedUsd <= 0) return null
              const totalValue = pos.hasOpenPosition && pos.currentPrice
                ? pos.totalReturnedUsd + (pos.netQuantity * pos.currentPrice)
                : pos.totalReturnedUsd
              if (totalValue <= 0 && pos.totalReturnedUsd <= 0) return null
              return ((totalValue - pos.totalInvestedUsd) / pos.totalInvestedUsd) * 100
            }
            const pnlPercent = getPnlPercent()

            return (
              <div key={posKey}>
                {/* Position Card */}
                <div
                  onClick={() => toggleToken(posKey, pos.symbol)}
                  className={`p-3 cursor-pointer transition-colors ${
                    isExpanded ? 'bg-accent' : 'active:bg-accent'
                  }`}
                >
                  {/* Top Row: Token + Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {pos.image ? (
                        <img src={pos.image} alt="" className="w-6 h-6 bg-muted flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 bg-muted flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                          {pos.symbol.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm">{pos.symbol}</div>
                        {pos.name && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{pos.name}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 ${pos.hasOpenPosition ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground bg-muted'}`}>
                        {pos.hasOpenPosition ? 'OPEN' : 'CLOSED'}
                      </span>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="flex items-center gap-3 mb-2 text-xs">
                    <span className="tabular-nums font-medium">
                      {pos.currentPrice ? formatCurrency(pos.currentPrice) : '—'}
                    </span>
                    {pos.priceChange24h && (
                      <span className={`tabular-nums text-[10px] ${pos.priceChange24h > 0 ? 'text-green-500' : pos.priceChange24h < 0 ? 'text-red-500' : ''}`}>
                        {pos.priceChange24h > 0 ? '+' : ''}{pos.priceChange24h.toFixed(1)}%
                      </span>
                    )}
                    <span className="text-muted-foreground text-[10px]">
                      {pos.buys.length}B / {pos.sells.length}S
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider">Invested</div>
                      <div className="tabular-nums font-medium">{formatCurrency(pos.totalInvestedUsd)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider">Returned</div>
                      <div className="tabular-nums font-medium">{formatCurrency(pos.totalReturnedUsd)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider">P&L</div>
                      <div className={`tabular-nums font-medium ${getPnlColor(pos.realizedPnlUsd)}`}>
                        {formatCurrency(pos.realizedPnlUsd)}
                        {pnlPercent !== null && (
                          <span className={`ml-1 ${getPnlColor(pnlPercent)}`}>
                            ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="bg-muted/30 border-t p-3" onClick={(e) => e.stopPropagation()}>
                    {/* Contract Address */}
                    {pos.contractAddress && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pos.contractAddress!)
                          setCopiedAddress(pos.contractAddress)
                          setTimeout(() => setCopiedAddress(null), 2000)
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono mb-3"
                      >
                        {pos.contractAddress.slice(0, 8)}...{pos.contractAddress.slice(-6)}
                        {copiedAddress === pos.contractAddress ? (
                          <Check className="h-2.5 w-2.5 text-green-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => setActiveTab('trades')}
                        className={`px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                          activeTab === 'trades'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Trades
                      </button>
                      <button
                        onClick={() => setActiveTab('journal')}
                        className={`px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                          activeTab === 'journal'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Journal
                      </button>
                    </div>

                    {/* Trades Tab - Mobile */}
                    {activeTab === 'trades' && (
                      <div className="space-y-2">
                        {[...pos.buys, ...pos.sells]
                          .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
                          .map((trade, idx) => (
                            <div key={`${trade.id}-${idx}`} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                                  trade.direction === 'buy' ? 'text-green-500' : 'text-red-500'
                                }`}>
                                  {trade.direction === 'buy' ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                  )}
                                  {trade.direction.toUpperCase()}
                                </span>
                                <span className="text-xs tabular-nums">{formatCurrency(trade.total_value)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{formatDateTime(trade.entry_date)}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(trade.id); }}
                                  className="text-muted-foreground hover:text-destructive p-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManualSell(pos)}
                          className="h-8 text-xs w-full mt-2"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Sell
                        </Button>
                      </div>
                    )}

                    {/* Journal Tab - Mobile (same structure as desktop) */}
                    {activeTab === 'journal' && (
                      <div className="space-y-3">
                        {/* Tags */}
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tags</div>
                          <div className="flex flex-wrap gap-1 items-center">
                            {(journal?.tagIds || []).length > 0 ? (
                              (journal?.tagIds || []).map((tagId) => {
                                const tag = allTags.find(t => t.id === tagId)
                                if (!tag) return null
                                return (
                                  <span
                                    key={tag.id}
                                    className="px-2 py-0.5 text-[11px] font-bold border bg-foreground text-background border-foreground"
                                  >
                                    {tag.name}
                                  </span>
                                )
                              })
                            ) : (
                              <span className="text-[10px] text-muted-foreground">No tags</span>
                            )}
                            <button
                              onClick={() => setShowCreateTag(true)}
                              className="px-1.5 py-0.5 text-[10px] border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                            >
                              + Edit
                            </button>
                          </div>
                        </div>

                        {/* Thesis */}
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Thesis</div>
                          <Textarea
                            value={journal?.thesis || ''}
                            onChange={(e) => updateTokenJournal(pos.symbol, 'thesis', e.target.value)}
                            placeholder="Why did you enter this trade?"
                            className="min-h-[60px] text-xs resize-none"
                          />
                        </div>

                        {/* Reflection */}
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reflection</div>
                          <Textarea
                            value={journal?.reflection || ''}
                            onChange={(e) => updateTokenJournal(pos.symbol, 'reflection', e.target.value)}
                            placeholder="What did you learn?"
                            className="min-h-[60px] text-xs resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {pos.hasOpenPosition && (
                        <button
                          type="button"
                          onClick={() => handleClosePosition(pos.contractAddress, pos.symbol)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-orange-500 transition-colors px-2 py-1"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Close
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteToken(pos.contractAddress, pos.symbol)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {positions.length === 0 && searchQuery && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No positions match "{searchQuery}"
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="flex-1 overflow-auto hidden md:block">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background border-b">
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium px-2 py-2 w-6"></th>
              <th className="text-left font-medium px-2 py-2">Token</th>
              <th className="text-right font-medium px-2 py-2 w-20">Price</th>
              <th className="text-right font-medium px-2 py-2 w-14">24h</th>
              <th className="text-right font-medium px-2 py-2 w-16">Buys</th>
              <th className="text-right font-medium px-2 py-2 w-16">Sells</th>
              <th className="text-right font-medium px-2 py-2 w-24">Invested</th>
              <th className="text-right font-medium px-2 py-2 w-24">Returned</th>
              <th className="text-right font-medium px-2 py-2 w-24">Realized</th>
              <th className="text-right font-medium px-2 py-2 w-16">P&L %</th>
              <th className="text-right font-medium px-2 py-2 w-16">Status</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((pos) => {
              const posKey = pos.contractAddress?.toLowerCase() || pos.symbol // Unique key for React
              const isExpanded = expandedToken === posKey
              const journal = tokenJournals[pos.symbol]

              return (
                <Fragment key={posKey}>
                  {/* Position Row */}
                  <tr
                    onClick={() => toggleToken(posKey, pos.symbol)}
                    className={`cursor-pointer h-8 group transition-colors ${
                      isExpanded ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                  >
                    <td className="px-2 py-1 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        {pos.image ? (
                          <img src={pos.image} alt="" className="w-4 h-4 bg-muted flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 bg-muted flex items-center justify-center text-[9px] font-medium flex-shrink-0">
                            {pos.symbol.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium truncate">{pos.symbol}</span>
                        {pos.name && <span className="text-muted-foreground truncate hidden sm:inline">({pos.name})</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {pos.currentPrice ? formatCurrency(pos.currentPrice) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums text-[10px] ${pos.priceChange24h ? (pos.priceChange24h > 0 ? 'text-green-500' : pos.priceChange24h < 0 ? 'text-red-500' : '') : ''}`}>
                      {pos.priceChange24h ? `${pos.priceChange24h > 0 ? '+' : ''}${pos.priceChange24h.toFixed(1)}%` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{pos.buys.length}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{pos.sells.length}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(pos.totalInvestedUsd)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(pos.totalReturnedUsd)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-medium ${getPnlColor(pos.realizedPnlUsd)}`}>
                      {formatCurrency(pos.realizedPnlUsd)}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums font-medium`}>
                      {(() => {
                        if (pos.totalInvestedUsd <= 0) return <span className="text-muted-foreground">—</span>
                        // For open positions with current price, include unrealized value
                        const totalValue = pos.hasOpenPosition && pos.currentPrice
                          ? pos.totalReturnedUsd + (pos.netQuantity * pos.currentPrice)
                          : pos.totalReturnedUsd
                        if (totalValue <= 0 && pos.totalReturnedUsd <= 0) return <span className="text-muted-foreground">—</span>
                        const pnlPercent = ((totalValue - pos.totalInvestedUsd) / pos.totalInvestedUsd) * 100
                        return (
                          <span className={getPnlColor(pnlPercent)}>
                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <span className={`text-[10px] font-medium ${pos.hasOpenPosition ? 'text-blue-500' : 'text-muted-foreground'}`}>
                        {pos.hasOpenPosition ? 'OPEN' : 'CLOSED'}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {pos.hasOpenPosition && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleClosePosition(pos.contractAddress, pos.symbol)
                            }}
                            className="text-muted-foreground hover:text-orange-500 transition-colors p-1"
                            title="Close position"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteToken(pos.contractAddress, pos.symbol)
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Delete position"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={12} className="bg-muted/30 border-b">
                        <div className="p-3" onClick={(e) => e.stopPropagation()}>
                          {/* Header with contract address */}
                          {/* Header with tabs and contract address */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setActiveTab('trades')}
                                className={`px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                                  activeTab === 'trades'
                                    ? 'bg-foreground text-background font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Trades
                              </button>
                              <button
                                onClick={() => setActiveTab('journal')}
                                className={`px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                                  activeTab === 'journal'
                                    ? 'bg-foreground text-background font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Journal
                              </button>
                            </div>
                            {pos.contractAddress && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(pos.contractAddress!)
                                  setCopiedAddress(pos.contractAddress)
                                  setTimeout(() => setCopiedAddress(null), 2000)
                                }}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono"
                              >
                                {pos.contractAddress.slice(0, 6)}...{pos.contractAddress.slice(-4)}
                                {copiedAddress === pos.contractAddress ? (
                                  <Check className="h-2.5 w-2.5 text-green-500" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Trades Tab */}
                          {activeTab === 'trades' && (
                            <div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[10px] text-muted-foreground border-b uppercase tracking-wider">
                                    <th className="text-left font-medium py-1 w-14">Type</th>
                                    <th className="text-right font-medium py-1">Amount</th>
                                    <th className="text-right font-medium py-1">Price</th>
                                    <th className="text-right font-medium py-1">MCap</th>
                                    <th className="text-right font-medium py-1">Value</th>
                                    <th className="text-right font-medium py-1">Date</th>
                                    <th className="w-6"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  {[...pos.buys, ...pos.sells]
                                    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
                                    .map((trade, idx) => (
                                      <tr key={`${trade.id}-${idx}`} className="group hover:bg-muted/50 h-7">
                                        <td className="py-1">
                                          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                                            trade.direction === 'buy' ? 'text-green-500' : 'text-red-500'
                                          }`}>
                                            {trade.direction === 'buy' ? (
                                              <><ArrowUpRight className="h-2.5 w-2.5" />BUY</>
                                            ) : (
                                              <><ArrowDownRight className="h-2.5 w-2.5" />SELL</>
                                            )}
                                          </span>
                                        </td>
                                        <td className="py-1 text-right tabular-nums">{trade.quantity.toLocaleString()}</td>
                                        <td className="py-1 text-right tabular-nums">{formatCurrency(trade.entry_price)}</td>
                                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                                          {formatMarketCap(trade.market_cap_at_trade)}
                                        </td>
                                        <td className="py-1 text-right tabular-nums">{formatCurrency(trade.total_value)}</td>
                                        <td className="py-1 text-right text-muted-foreground">{formatDateTime(trade.entry_date)}</td>
                                        <td className="py-1 text-right">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(trade.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                              <div className="mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openManualSell(pos)}
                                  className="h-7 text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Sell
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Journal Tab */}
                          {activeTab === 'journal' && (
                            <div className="space-y-3 max-w-xl">
                                {/* Tags - Only show selected tags */}
                                <div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tags</div>
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {(journal?.tagIds || []).length > 0 ? (
                                      (journal?.tagIds || []).map((tagId) => {
                                        const tag = allTags.find(t => t.id === tagId)
                                        if (!tag) return null
                                        return (
                                          <span
                                            key={tag.id}
                                            className="px-2 py-0.5 text-[12px] font-bold border bg-foreground text-background border-foreground"
                                          >
                                            {tag.name}
                                          </span>
                                        )
                                      })
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">No tags</span>
                                    )}
                                    <button
                                      onClick={() => setShowCreateTag(true)}
                                      className="px-1.5 py-0.5 text-[10px] border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                                    >
                                      + Edit Tags
                                    </button>
                                  </div>
                                </div>

                                {/* Confidence */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">
                                    Confidence: {journal?.confidenceLevel || 5}/10
                                  </label>
                                  <Slider
                                    value={journal?.confidenceLevel || 5}
                                    onValueChange={(val) => updateTokenJournal(pos.symbol, 'confidenceLevel', val)}
                                    min={1}
                                    max={10}
                                  />
                                </div>

                                {/* Emotion */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">
                                    Emotional State
                                  </label>
                                  <Select
                                    value={journal?.emotionalState || ''}
                                    onChange={(e) => updateTokenJournal(pos.symbol, 'emotionalState', e.target.value)}
                                    className="h-9 text-sm"
                                  >
                                    <option value="">—</option>
                                    {emotionalStates.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </Select>
                                </div>

                                {/* Reason for Selling */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">
                                    Reason for Selling
                                  </label>
                                  <Input
                                    value={journal?.sellReason || ''}
                                    onChange={(e) => updateTokenJournal(pos.symbol, 'sellReason', e.target.value)}
                                    placeholder="Why did you sell?"
                                    className="h-7 text-xs"
                                  />
                                </div>

                                {/* Copy Trader */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">
                                    Copy Trade (Trader Name)
                                  </label>
                                  <Input
                                    value={journal?.copyTrader || ''}
                                    onChange={(e) => updateTokenJournal(pos.symbol, 'copyTrader', e.target.value)}
                                    placeholder="Enter trader name if copy trade"
                                    className="h-7 text-xs"
                                  />
                                </div>

                                {/* Thesis */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">Thesis</label>
                                  <Textarea
                                    value={journal?.thesis || ''}
                                    onChange={(e) => updateTokenJournal(pos.symbol, 'thesis', e.target.value)}
                                    placeholder="Why did you enter?"
                                    className="min-h-[60px] text-xs resize-none"
                                  />
                                </div>

                                {/* Reflection */}
                                <div>
                                  <label className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wider">Reflection</label>
                                  <Textarea
                                    value={journal?.reflection || ''}
                                    onChange={(e) => updateTokenJournal(pos.symbol, 'reflection', e.target.value)}
                                    placeholder="What did you learn?"
                                    className="min-h-[60px] text-xs resize-none"
                                  />
                                </div>

                                {/* Auto-save indicator */}
                                {savingToken === pos.symbol && (
                                  <div className="text-[10px] text-muted-foreground text-center">
                                    Saving...
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {positions.length === 0 && searchQuery && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No positions match "{searchQuery}"
          </div>
        )}
      </div>

      {/* Tag Selection Dialog */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Tags Bank */}
            {allTags.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Click to toggle</div>
                <div className="flex flex-wrap gap-3 pt-2 pr-2">
                  {allTags.map((tag) => {
                    const isSelected = expandedTokenSymbol ? (tokenJournals[expandedTokenSymbol]?.tagIds || []).includes(tag.id) : false
                    return (
                      <span key={tag.id} className="relative inline-block group">
                        <button
                          onClick={() => expandedTokenSymbol && handleToggleTag(expandedTokenSymbol, tag.id)}
                          className={`px-2.5 py-1 text-xs border transition-colors ${
                            isSelected
                              ? 'bg-foreground text-background border-foreground'
                              : 'text-muted-foreground hover:text-foreground border-border hover:border-foreground'
                          }`}
                        >
                          {tag.name}
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="absolute rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          style={{ zIndex: 10, top: '-6px', right: '-6px', width: '14px', height: '14px', fontSize: '10px', lineHeight: 1 }}
                          title="Delete tag"
                        >
                          <span style={{ marginTop: '-1px' }}>×</span>
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Create New Tag */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">Create new tag</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newTagName.trim() && handleCreateTag()}
                  className="flex-1"
                />
                <Button onClick={handleCreateTag} disabled={!newTagName.trim()} size="sm">
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateTag(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Sell Dialog */}
      <Dialog open={!!manualSellToken} onOpenChange={() => setManualSellToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Sell - {manualSellToken?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Quantity</label>
              <Input
                type="number"
                placeholder="Amount sold"
                value={sellQuantity}
                onChange={(e) => setSellQuantity(e.target.value)}
              />
              {manualSellToken && manualSellToken.netQuantity > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    Open: {manualSellToken.netQuantity.toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setSellPercentage(pct)}
                        className="px-2 py-0.5 text-[10px] border hover:bg-accent transition-colors"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sell Price (per token)</label>
              <Input
                type="number"
                placeholder="Price per token"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
              {manualSellToken?.currentPrice && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Current price: {formatCurrency(manualSellToken.currentPrice)}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Date</label>
              <Input
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Market Cap (optional)</label>
              <Input
                type="number"
                placeholder="Market cap at sale"
                value={sellMarketCap}
                onChange={(e) => setSellMarketCap(e.target.value)}
              />
            </div>
            {sellQuantity && sellPrice && parseFloat(sellQuantity) > 0 && parseFloat(sellPrice) > 0 && (
              <div className="p-3 bg-muted">
                <div className="text-xs text-muted-foreground">Total Value</div>
                <div className="text-lg font-medium">
                  {formatCurrency(parseFloat(sellQuantity) * parseFloat(sellPrice))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualSellToken(null)}>Cancel</Button>
            <Button
              onClick={handleManualSell}
              disabled={!sellQuantity || !sellPrice || parseFloat(sellQuantity) <= 0 || parseFloat(sellPrice) <= 0}
            >
              Record Sell
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
