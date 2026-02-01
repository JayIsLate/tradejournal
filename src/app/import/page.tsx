'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Wallet,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Info
} from 'lucide-react'
import Papa from 'papaparse'
import { db } from '@/lib/db'
import type { Trade } from '@/lib/types'
import { generateId, formatCurrency, formatDate } from '@/lib/utils'

interface ParsedRow {
  token_symbol?: string
  token_name?: string
  token_chain?: string
  direction?: string
  entry_price?: string
  exit_price?: string
  quantity?: string
  entry_date?: string
  exit_date?: string
  platform?: string
  status?: string
  [key: string]: string | undefined
}

interface WalletTransaction {
  signature: string
  timestamp: number
  type: 'swap' | 'transfer' | 'unknown'
  description?: string
  tokenIn?: {
    symbol: string
    name?: string
    amount: number
    decimals: number
    mint?: string
    image?: string
    marketCap?: number
  }
  tokenOut?: {
    symbol: string
    name?: string
    amount: number
    decimals: number
    mint?: string
    image?: string
    marketCap?: number
  }
  fee?: number
  platform?: string
  selected?: boolean
}

interface SavedWallet {
  address: string
  chain: string
  label?: string
}

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV import state
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)

  // Wallet import state
  const [walletAddress, setWalletAddress] = useState('')
  const [walletChain, setWalletChain] = useState('solana')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([])
  const [fetchingTxns, setFetchingTxns] = useState(false)
  const [fetchProgress, setFetchProgress] = useState<string | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletLabel, setWalletLabel] = useState('')

  // Portfolio settings
  const [initialCapital, setInitialCapital] = useState('')
  const [walletBalance, setWalletBalance] = useState('')
  const [totalPortfolioValue, setTotalPortfolioValue] = useState('')
  const [portfolioSaved, setPortfolioSaved] = useState(false)

  const requiredFields = ['token_symbol', 'entry_price', 'quantity', 'entry_date']
  const optionalFields = ['token_name', 'token_chain', 'direction', 'exit_price', 'exit_date', 'platform', 'status']
  const allFields = [...requiredFields, ...optionalFields]

  // Load saved wallets and API key from settings
  useEffect(() => {
    async function loadSettings() {
      const savedApiKey = await db.getSetting('helius_api_key')
      if (savedApiKey) setApiKey(savedApiKey)

      const savedCapital = await db.getSetting('initial_capital')
      if (savedCapital) setInitialCapital(savedCapital)

      const savedBalance = await db.getSetting('wallet_balance')
      if (savedBalance) setWalletBalance(savedBalance)

      const savedTotalValue = await db.getSetting('total_portfolio_value')
      if (savedTotalValue) setTotalPortfolioValue(savedTotalValue)

      const savedWalletsJson = await db.getSetting('watched_wallets')
      if (savedWalletsJson) {
        try {
          setSavedWallets(JSON.parse(savedWalletsJson))
        } catch (e) {
          console.error('Failed to parse saved wallets')
        }
      }
    }
    loadSettings()
  }, [])

  const saveApiKey = async () => {
    await db.setSetting('helius_api_key', apiKey)
  }

  const savePortfolioSettings = async () => {
    if (initialCapital) {
      await db.setSetting('initial_capital', initialCapital)
    }
    if (walletBalance) {
      await db.setSetting('wallet_balance', walletBalance)
    }
    if (totalPortfolioValue) {
      await db.setSetting('total_portfolio_value', totalPortfolioValue)
    } else {
      await db.setSetting('total_portfolio_value', '') // Clear if empty
    }
    setPortfolioSaved(true)
    setTimeout(() => setPortfolioSaved(false), 2000)
  }

  const addWalletToWatchlist = async () => {
    if (!walletAddress) return

    const newWallet: SavedWallet = {
      address: walletAddress,
      chain: walletChain,
      label: walletLabel || undefined
    }

    const exists = savedWallets.some(w => w.address === walletAddress && w.chain === walletChain)
    if (exists) return

    const updated = [...savedWallets, newWallet]
    setSavedWallets(updated)
    await db.setSetting('watched_wallets', JSON.stringify(updated))
    setWalletLabel('')
  }

  const removeWalletFromWatchlist = async (address: string, chain: string) => {
    const updated = savedWallets.filter(w => !(w.address === address && w.chain === chain))
    setSavedWallets(updated)
    await db.setSetting('watched_wallets', JSON.stringify(updated))
  }

  const fetchWalletTransactions = async () => {
    if (!walletAddress) {
      setWalletError('Please enter a wallet address')
      return
    }

    setFetchingTxns(true)
    setWalletError(null)

    try {
      // Auto-save API key and wallet for syncing
      if (apiKey) {
        await db.setSetting('helius_api_key', apiKey)
      }
      await addWalletToWatchlist()

      if (walletChain === 'solana') {
        await fetchSolanaTransactions()
      } else if (walletChain === 'base') {
        await fetchBaseTransactions()
      } else {
        setWalletError(`${walletChain} chain support coming soon`)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      setWalletError('Failed to fetch transactions. Check your API key and wallet address.')
    } finally {
      setFetchingTxns(false)
    }
  }

  // Helper to look up token metadata from mint address
  interface TokenMetadataResult {
    symbol: string
    name?: string
    image?: string
  }

  const getTokenMetadata = async (mints: string[]): Promise<Record<string, TokenMetadataResult>> => {
    if (mints.length === 0) return {}

    try {
      const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAccounts: mints })
      })

      if (!response.ok) return {}

      const data = await response.json()
      const metadata: Record<string, TokenMetadataResult> = {}

      for (const token of data) {
        const result: TokenMetadataResult = { symbol: 'Unknown' }

        // Get symbol
        if (token.onChainMetadata?.metadata?.data?.symbol) {
          result.symbol = token.onChainMetadata.metadata.data.symbol
        } else if (token.legacyMetadata?.symbol) {
          result.symbol = token.legacyMetadata.symbol
        }

        // Get name
        if (token.onChainMetadata?.metadata?.data?.name) {
          result.name = token.onChainMetadata.metadata.data.name
        } else if (token.legacyMetadata?.name) {
          result.name = token.legacyMetadata.name
        }

        // Get image
        if (token.onChainMetadata?.metadata?.data?.uri) {
          // Try to fetch the metadata URI for the image
          try {
            const uriResponse = await fetch(token.onChainMetadata.metadata.data.uri)
            if (uriResponse.ok) {
              const uriData = await uriResponse.json()
              if (uriData.image) {
                result.image = uriData.image
              }
            }
          } catch {
            // Ignore URI fetch errors
          }
        }
        if (!result.image && token.legacyMetadata?.logoURI) {
          result.image = token.legacyMetadata.logoURI
        }
        if (!result.image && token.offChainMetadata?.metadata?.image) {
          result.image = token.offChainMetadata.metadata.image
        }

        metadata[token.account] = result
      }

      return metadata
    } catch (e) {
      console.error('Failed to fetch token metadata:', e)
      return {}
    }
  }

  // Fetch market cap from DexScreener
  const getMarketCaps = async (mints: string[]): Promise<Record<string, number>> => {
    if (mints.length === 0) return {}

    const marketCaps: Record<string, number> = {}

    // DexScreener API allows fetching multiple tokens
    // We'll batch in groups of 30 to avoid rate limits
    const batchSize = 30
    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize)

      try {
        // Fetch each token individually (DexScreener doesn't have a bulk endpoint)
        await Promise.all(batch.map(async (mint) => {
          try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
            if (response.ok) {
              const data = await response.json()
              // Get the pair with highest liquidity (usually the main one)
              if (data.pairs && data.pairs.length > 0) {
                const mainPair = data.pairs.sort((a: any, b: any) =>
                  (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                )[0]
                if (mainPair.fdv) {
                  marketCaps[mint] = mainPair.fdv
                } else if (mainPair.marketCap) {
                  marketCaps[mint] = mainPair.marketCap
                }
              }
            }
          } catch {
            // Ignore individual token errors
          }
        }))

        // Small delay between batches to avoid rate limits
        if (i + batchSize < mints.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (e) {
        console.error('Failed to fetch market caps batch:', e)
      }
    }

    return marketCaps
  }

  const fetchBaseTransactions = async () => {
    const walletLower = walletAddress.toLowerCase()

    setFetchProgress('Fetching Base token transfers via Blockscout...')

    // Fetch ETH price for WETH fallback (some sells route through WETH instead of USDC)
    let ethUsdPrice = 3000 // Default fallback
    try {
      const ethPriceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006')
      if (ethPriceRes.ok) {
        const ethPriceData = await ethPriceRes.json()
        if (ethPriceData.pairs?.[0]?.priceUsd) {
          ethUsdPrice = parseFloat(ethPriceData.pairs[0].priceUsd)
          console.log('Current WETH price:', ethUsdPrice)
        }
      }
    } catch (e) {
      console.log('Failed to fetch WETH price, using default:', ethUsdPrice)
    }

    // Use Blockscout API (free, no key needed) to get token transfers for this wallet
    // Paginate to get all transfers
    let allTransfers: any[] = []
    let nextPageParams: any = null
    let pageCount = 0
    const maxPages = 20

    while (pageCount < maxPages) {
      let url = `https://base.blockscout.com/api/v2/addresses/${walletAddress}/token-transfers?type=ERC-20`
      if (nextPageParams) {
        url += `&block_number=${nextPageParams.block_number}&index=${nextPageParams.index}`
      }

      const res = await fetch(url)
      if (!res.ok) {
        setWalletError('Failed to fetch Base transactions from Blockscout')
        return
      }

      const data = await res.json()
      const items = data.items || []
      allTransfers = [...allTransfers, ...items]
      pageCount++

      setFetchProgress(`Fetching Base transfers... ${allTransfers.length} found`)

      if (data.next_page_params) {
        nextPageParams = data.next_page_params
      } else {
        break
      }
    }

    if (allTransfers.length === 0) {
      setWalletError('No token transfers found for this wallet on Base')
      return
    }

    console.log(`Fetched ${allTransfers.length} token transfers from Blockscout`)

    // Identify buys and sells from the address-level transfers
    // Fomo uses Account Abstraction (AA), so the wallet holds meme tokens while
    // a separate AA account handles USDC. We need to fetch tx details for each
    // trade to find the USDC amount.
    //
    // BUY: wallet receives meme tokens (method: permit2TransferAndMulticall)
    //   - USDC amount is in the tx's token_transfers (from the AA user address)
    // SELL: wallet sends meme tokens (method: handleOps)
    //   - USDC amount is in the tx's token_transfers (to the AA user address)

    // Group by tx hash and classify
    const txMap: Record<string, { transfers: any[]; method: string; timestamp: string }> = {}
    for (const item of allTransfers) {
      const txHash = item.transaction_hash
      const fromAddr = item.from?.hash?.toLowerCase()
      const toAddr = item.to?.hash?.toLowerCase()

      // Only include transfers where this wallet is involved
      if (fromAddr !== walletLower && toAddr !== walletLower) continue

      if (!txMap[txHash]) {
        txMap[txHash] = {
          transfers: [],
          method: item.method || '',
          timestamp: item.timestamp || '',
        }
      }
      txMap[txHash].transfers.push(item)
    }

    setFetchProgress(`Processing ${Object.keys(txMap).length} transactions...`)

    // Known stablecoin and WETH addresses on Base
    const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const USDbC_ADDRESS = '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ab'
    const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
    const stablecoinAddresses = [USDC_ADDRESS, USDbC_ADDRESS]

    // Skip known airdrop/spam patterns (small fixed amounts like 3.0 tokens from multicall)
    const isLikelyAirdrop = (transfers: any[], method: string) => {
      if (transfers.length !== 1) return false
      const t = transfers[0]
      const total = t.total || {}
      const dec = parseInt(total.decimals || '18')
      const value = Number(total.value || '0') / Math.pow(10, dec)
      // Small fixed amounts from multicall/batchTransfer are usually airdrops
      if ((method === 'multicall' || method === 'batchTransfer') && value <= 100 && transfers.every((tr: any) => tr.to?.hash?.toLowerCase() === walletLower)) {
        return true
      }
      return false
    }

    const parsedTxns: WalletTransaction[] = []
    const mintAddresses = new Set<string>()
    let aaUserAddress: string | null = null // Will be discovered from first buy tx

    // Fetch tx details for each trade to find USDC amounts
    let processed = 0
    for (const [txHash, txData] of Object.entries(txMap)) {
      processed++
      if (processed % 5 === 0) {
        setFetchProgress(`Fetching trade details... ${processed}/${Object.keys(txMap).length}`)
      }

      const { transfers, method, timestamp } = txData

      // Skip likely airdrops
      if (isLikelyAirdrop(transfers, method)) {
        console.log(`Skipping airdrop: ${txHash.slice(0, 16)}... method=${method}`)
        continue
      }

      // Determine if this is a buy or sell
      const outgoing = transfers.filter((t: any) => t.from?.hash?.toLowerCase() === walletLower)
      const incoming = transfers.filter((t: any) => t.to?.hash?.toLowerCase() === walletLower)

      // For Fomo AA, each tx has only one side (meme token in or out)
      // We need to fetch the tx details to find the USDC counterpart
      const isBuy = incoming.length > 0 && outgoing.length === 0
      const isSell = outgoing.length > 0

      if (!isBuy && !isSell) continue

      // Get the meme token details from the address-level transfer
      const memeTransfer = isBuy ? incoming[0] : outgoing[0]
      const memeToken = memeTransfer.token || {}
      const memeTotal = memeTransfer.total || {}
      const memeDec = parseInt(memeTotal.decimals || '18')
      const memeAmount = Number(memeTotal.value || '0') / Math.pow(10, memeDec)

      if (memeAmount === 0) continue

      // Skip if the token IS a stablecoin (not a meme token trade)
      const memeAddress = (memeToken.address_hash || '').toLowerCase()
      if (stablecoinAddresses.includes(memeAddress)) continue

      // Fetch tx details to find USDC amount
      let usdcAmount = 0
      try {
        // Add small delay to avoid rate limiting Blockscout
        await new Promise(resolve => setTimeout(resolve, 200))

        const txRes = await fetch(`https://base.blockscout.com/api/v2/transactions/${txHash}`)
        if (txRes.ok) {
          const txDetails = await txRes.json()
          const txTokenTransfers = txDetails.token_transfers || []

          // Discover AA user address from buy tx decoded input
          if (isBuy && !aaUserAddress && txDetails.decoded_input?.parameters) {
            const userParam = txDetails.decoded_input.parameters.find((p: any) => p.name === 'user')
            if (userParam?.value) {
              aaUserAddress = userParam.value.toLowerCase()
              console.log('Discovered AA user address:', aaUserAddress)
            }
          }

          // Find USDC transfers in this tx
          for (const tt of txTokenTransfers) {
            const ttToken = tt.token || {}
            const ttAddress = (ttToken.address_hash || '').toLowerCase()
            if (!stablecoinAddresses.includes(ttAddress)) continue

            const ttTotal = tt.total || {}
            const ttDec = parseInt(ttTotal.decimals || '6')
            const ttValue = Number(ttTotal.value || '0') / Math.pow(10, ttDec)

            const ttFrom = (tt.from?.hash || '').toLowerCase()
            const ttTo = (tt.to?.hash || '').toLowerCase()

            if (isBuy && aaUserAddress && ttFrom === aaUserAddress) {
              // For buys: USDC FROM the AA user = amount spent
              usdcAmount = ttValue
              break
            } else if (isSell && aaUserAddress && ttTo === aaUserAddress) {
              // For sells: USDC TO the AA user = amount received
              usdcAmount = ttValue
              break
            } else if (isBuy && !aaUserAddress && ttValue > 0) {
              // Fallback: use first USDC transfer as estimate
              usdcAmount = ttValue
              break
            } else if (isSell && ttValue > 0) {
              // For sells without AA address: use the last USDC transfer
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

              // Use the largest WETH transfer as the sale proceeds
              if (ttValue > maxWethAmount) {
                maxWethAmount = ttValue
              }
            }
            if (maxWethAmount > 0) {
              usdcAmount = maxWethAmount * ethUsdPrice
              console.log(`WETH fallback: ${maxWethAmount.toFixed(6)} WETH * $${ethUsdPrice} = $${usdcAmount.toFixed(2)}`)
            }
          }
        }
      } catch (e) {
        console.log(`Failed to fetch tx details for ${txHash.slice(0, 16)}...`)
      }

      if (usdcAmount === 0) {
        console.log(`Skipping ${txHash.slice(0, 16)}... - no USDC/WETH amount found`)
        continue
      }

      const memeSymbol = memeToken.symbol || 'Unknown'
      const memeName = memeToken.name || null
      if (memeAddress) mintAddresses.add(memeAddress)

      console.log(`Base ${isBuy ? 'BUY' : 'SELL'}: ${usdcAmount.toFixed(2)} USDC <-> ${memeAmount.toFixed(4)} ${memeSymbol}`)

      // Build WalletTransaction in the same format as Solana trades
      // tokenIn = what user spent, tokenOut = what user received
      parsedTxns.push({
        signature: txHash,
        timestamp: new Date(timestamp).getTime(),
        type: 'swap',
        tokenIn: isBuy
          ? { symbol: 'USDC', name: 'USD Coin', amount: usdcAmount, decimals: 6, mint: USDC_ADDRESS }
          : { symbol: memeSymbol, name: memeName || undefined, amount: memeAmount, decimals: memeDec, mint: memeAddress },
        tokenOut: isBuy
          ? { symbol: memeSymbol, name: memeName || undefined, amount: memeAmount, decimals: memeDec, mint: memeAddress }
          : { symbol: 'USDC', name: 'USD Coin', amount: usdcAmount, decimals: 6, mint: USDC_ADDRESS },
        fee: 0,
        platform: 'Fomo',
        selected: true,
      })
    }

    // Fetch market caps for tokens from DexScreener
    const allMints = Array.from(mintAddresses)
    if (allMints.length > 0) {
      setFetchProgress('Fetching market cap data...')
      const marketCaps = await getMarketCaps(allMints)
      for (const tx of parsedTxns) {
        if (tx.tokenIn?.mint && marketCaps[tx.tokenIn.mint]) {
          tx.tokenIn.marketCap = marketCaps[tx.tokenIn.mint]
        }
        if (tx.tokenOut?.mint && marketCaps[tx.tokenOut.mint]) {
          tx.tokenOut.marketCap = marketCaps[tx.tokenOut.mint]
        }
      }
    }

    setFetchProgress(null)

    if (parsedTxns.length === 0) {
      setWalletError('No swap transactions found in Base transaction history')
      return
    }

    console.log(`Found ${parsedTxns.length} swaps on Base`)

    // Import trades - all USDC denominated, so usdPrice=1
    setFetchProgress('Importing trades...')
    await autoImportTransactions(parsedTxns, 'Base')
  }

  const fetchSolanaTransactions = async () => {
    if (!apiKey) {
      setWalletError('Please enter your Helius API key to fetch Solana transactions')
      return
    }

    // Fetch ALL transactions with pagination
    let allTransactions: any[] = []
    let lastSignature: string | null = null
    let hasMore = true
    let pageCount = 0
    const maxPages = 100 // Safety limit - 100 pages * 100 = 10000 transactions max

    setFetchProgress('Fetching transactions...')

    while (hasMore && pageCount < maxPages) {
      const url: string = lastSignature
        ? `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=100&before=${lastSignature}`
        : `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=100`

      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key')
        }
        throw new Error(`API error: ${response.status}`)
      }

      const pageData = await response.json()

      if (pageData.length === 0) {
        hasMore = false
      } else {
        allTransactions = [...allTransactions, ...pageData]
        lastSignature = pageData[pageData.length - 1].signature
        pageCount++
        setFetchProgress(`Fetching transactions... ${allTransactions.length} found`)

        // If we got less than 100, we've reached the end
        if (pageData.length < 100) {
          hasMore = false
        }
      }
    }

    const data = allTransactions
    setFetchProgress(`Processing ${data.length} transactions...`)
    console.log(`Fetched ${data.length} total transactions across ${pageCount} pages`)

    // Collect all unique mint addresses to look up metadata
    const mintAddresses = new Set<string>()

    // Parse transactions into our format
    const parsedTxns: WalletTransaction[] = []

    for (const tx of data) {
      // Look for swap transactions
      if (tx.type === 'SWAP' && tx.events?.swap) {
        const swap = tx.events.swap

        // Debug: Log the full swap data to understand routing
        console.log('=== SWAP TRANSACTION ===')
        console.log('Signature:', tx.signature)
        console.log('nativeInput:', swap.nativeInput)
        console.log('nativeOutput:', swap.nativeOutput)
        console.log('tokenInputs:', JSON.stringify(swap.tokenInputs, null, 2))
        console.log('tokenOutputs:', JSON.stringify(swap.tokenOutputs, null, 2))
        console.log('innerSwaps count:', swap.innerSwaps?.length || 0)
        if (swap.innerSwaps) {
          swap.innerSwaps.forEach((inner: any, i: number) => {
            console.log(`innerSwap[${i}] inputs:`, JSON.stringify(inner.tokenInputs, null, 2))
            console.log(`innerSwap[${i}] outputs:`, JSON.stringify(inner.tokenOutputs, null, 2))
          })
        }
        console.log('========================')

        // Determine what the user SPENT (tokenIn) and what they RECEIVED (tokenOut)
        let tokenInSymbol = ''
        let tokenInAmount = 0
        let tokenInDecimals = 9
        let tokenInMint: string | undefined
        let tokenInName: string | undefined
        let tokenInImage: string | undefined

        let tokenOutSymbol = ''
        let tokenOutAmount = 0
        let tokenOutDecimals = 9
        let tokenOutMint: string | undefined
        let tokenOutName: string | undefined
        let tokenOutImage: string | undefined

        // Check for native SOL input (user spending SOL)
        if (swap.nativeInput && swap.nativeInput.amount > 0) {
          tokenInSymbol = 'SOL'
          tokenInAmount = swap.nativeInput.amount / 1e9
          tokenInDecimals = 9
        }

        // Check for native SOL output (user receiving SOL)
        if (swap.nativeOutput && swap.nativeOutput.amount > 0) {
          tokenOutSymbol = 'SOL'
          tokenOutAmount = swap.nativeOutput.amount / 1e9
          tokenOutDecimals = 9
        }

        // Check for token inputs (user spending tokens)
        if (swap.tokenInputs && swap.tokenInputs.length > 0) {
          for (const ti of swap.tokenInputs) {
            // Skip if this is just wrapped SOL
            if (ti.mint === 'So11111111111111111111111111111111111111112') continue

            const amount = ti.rawTokenAmount?.tokenAmount
              ? Number(ti.rawTokenAmount.tokenAmount) / Math.pow(10, ti.rawTokenAmount.decimals || 9)
              : ti.tokenAmount || 0

            if (amount > 0) {
              tokenInSymbol = ti.symbol || ti.name || 'Unknown'
              tokenInAmount = amount
              tokenInDecimals = ti.rawTokenAmount?.decimals || ti.decimals || 9
              tokenInMint = ti.mint
              tokenInName = ti.name
              if (tokenInMint) mintAddresses.add(tokenInMint)
              break
            }
          }
        }

        // Check for token outputs (user receiving tokens)
        // Use LAST token output to get final destination in multi-hop swaps
        if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
          for (const to of swap.tokenOutputs) {
            // Skip if this is just wrapped SOL
            if (to.mint === 'So11111111111111111111111111111111111111112') continue

            const amount = to.rawTokenAmount?.tokenAmount
              ? Number(to.rawTokenAmount.tokenAmount) / Math.pow(10, to.rawTokenAmount.decimals || 9)
              : to.tokenAmount || 0

            if (amount > 0) {
              tokenOutSymbol = to.symbol || to.name || 'Unknown'
              tokenOutAmount = amount
              tokenOutDecimals = to.rawTokenAmount?.decimals || to.decimals || 9
              tokenOutMint = to.mint
              tokenOutName = to.name
              if (tokenOutMint) mintAddresses.add(tokenOutMint)
              // Don't break - keep iterating to get the LAST token (final destination)
            }
          }
        }

        // Fallback to innerSwaps if main swap data is incomplete
        // Use first innerSwap for input (what user sold) and last innerSwap for output (what user received)
        if (swap.innerSwaps && swap.innerSwaps.length > 0) {
          const firstInnerSwap = swap.innerSwaps[0]
          const lastInnerSwap = swap.innerSwaps[swap.innerSwaps.length - 1]

          if (!tokenInSymbol && firstInnerSwap.tokenInputs?.[0]) {
            const ti = firstInnerSwap.tokenInputs[0]
            tokenInSymbol = ti.symbol || ti.name || 'Unknown'
            tokenInAmount = ti.rawTokenAmount?.tokenAmount
              ? Number(ti.rawTokenAmount.tokenAmount) / Math.pow(10, ti.rawTokenAmount.decimals || 9)
              : ti.tokenAmount || 0
            tokenInDecimals = ti.rawTokenAmount?.decimals || ti.decimals || 9
            tokenInMint = ti.mint
            tokenInName = ti.name
            if (tokenInMint) mintAddresses.add(tokenInMint)
          }

          // Use last innerSwap's last output for final destination
          const lastOutputs = lastInnerSwap.tokenOutputs
          if (!tokenOutSymbol && lastOutputs && lastOutputs.length > 0) {
            const to = lastOutputs[lastOutputs.length - 1]
            tokenOutSymbol = to.symbol || to.name || 'Unknown'
            tokenOutAmount = to.rawTokenAmount?.tokenAmount
              ? Number(to.rawTokenAmount.tokenAmount) / Math.pow(10, to.rawTokenAmount.decimals || 9)
              : to.tokenAmount || 0
            tokenOutDecimals = to.rawTokenAmount?.decimals || to.decimals || 9
            tokenOutMint = to.mint
            tokenOutName = to.name
            if (tokenOutMint) mintAddresses.add(tokenOutMint)
          }
        }

        // Skip if we couldn't determine both sides
        if (!tokenInSymbol || !tokenOutSymbol || tokenInAmount === 0 || tokenOutAmount === 0) {
          continue
        }

        // Determine trade direction
        const baseCurrencies = ['SOL', 'USDC', 'USDT', 'PYUSD', 'DAI', 'WSOL']
        const tokenInIsBase = baseCurrencies.includes(tokenInSymbol.toUpperCase())
        const tokenOutIsBase = baseCurrencies.includes(tokenOutSymbol.toUpperCase())

        // Skip stablecoin-only swaps (e.g., SOL -> USDC)
        if (tokenInIsBase && tokenOutIsBase) {
          continue
        }

        // Skip platform fees (~$0.95 transactions - roughly 0.004-0.02 SOL depending on price)
        const isLikelyPlatformFee = tokenInSymbol === 'SOL' && tokenInAmount < 0.02

        if (!isLikelyPlatformFee) {
          console.log(`>>> PARSED: ${tokenInSymbol} (${tokenInAmount}) -> ${tokenOutSymbol} (${tokenOutAmount})`)
          console.log(`    nativeInput: ${swap.nativeInput?.amount}, nativeOutput: ${swap.nativeOutput?.amount}`)

          parsedTxns.push({
            signature: tx.signature,
            timestamp: tx.timestamp * 1000,
            type: 'swap',
            description: tx.description,
            tokenIn: {
              symbol: tokenInSymbol,
              name: tokenInName,
              amount: tokenInAmount,
              decimals: tokenInDecimals,
              mint: tokenInMint,
              image: tokenInImage
            },
            tokenOut: {
              symbol: tokenOutSymbol,
              name: tokenOutName,
              amount: tokenOutAmount,
              decimals: tokenOutDecimals,
              mint: tokenOutMint,
              image: tokenOutImage
            },
            fee: tx.fee / 1e9,
            platform: swap.innerSwaps?.[0]?.programInfo?.source || 'DEX',
            selected: true
          })
        }
      }
      // Also look for token transfers that might be trades (backup parsing)
      else if (tx.tokenTransfers && tx.tokenTransfers.length >= 2) {
        const transfers = tx.tokenTransfers.filter((t: { fromUserAccount: string; toUserAccount: string }) =>
          t.fromUserAccount === walletAddress || t.toUserAccount === walletAddress
        )

        if (transfers.length >= 2) {
          // Find what user sent out and what they received
          const outgoing = transfers.find((t: { fromUserAccount: string }) => t.fromUserAccount === walletAddress)
          const incoming = transfers.find((t: { toUserAccount: string }) => t.toUserAccount === walletAddress)

          if (outgoing && incoming && outgoing.mint !== incoming.mint) {
            if (outgoing.mint) mintAddresses.add(outgoing.mint)
            if (incoming.mint) mintAddresses.add(incoming.mint)

            const tokenInSymbol = outgoing.symbol || 'Unknown'
            const tokenOutSymbol = incoming.symbol || 'Unknown'
            const tokenInAmount = outgoing.tokenAmount || 0
            const tokenOutAmount = incoming.tokenAmount || 0

            // Skip base-to-base swaps
            const baseCurrencies = ['SOL', 'USDC', 'USDT', 'PYUSD', 'DAI', 'WSOL']
            const tokenInIsBase = baseCurrencies.includes(tokenInSymbol.toUpperCase())
            const tokenOutIsBase = baseCurrencies.includes(tokenOutSymbol.toUpperCase())

            if (tokenInIsBase && tokenOutIsBase) {
              continue
            }

            // Skip platform fees
            const isLikelyPlatformFee = tokenInSymbol === 'SOL' && tokenInAmount < 0.02

            if (!isLikelyPlatformFee && tokenInAmount > 0 && tokenOutAmount > 0) {
              parsedTxns.push({
                signature: tx.signature,
                timestamp: tx.timestamp * 1000,
                type: 'swap',
                description: tx.description,
                tokenIn: {
                  symbol: tokenInSymbol,
                  amount: tokenInAmount,
                  decimals: outgoing.decimals || 9,
                  mint: outgoing.mint
                },
                tokenOut: {
                  symbol: tokenOutSymbol,
                  amount: tokenOutAmount,
                  decimals: incoming.decimals || 9,
                  mint: incoming.mint
                },
                fee: tx.fee / 1e9,
                platform: 'Unknown',
                selected: true
              })
            }
          }
        }
      }
    }

    // Look up metadata for ALL tokens to ensure correct symbols
    // (Helius swap data sometimes returns wrong symbols)
    const allTokenMints = Array.from(mintAddresses)

    if (allTokenMints.length > 0) {
      const metadata = await getTokenMetadata(allTokenMints)

      // Update transactions with fetched metadata - always prefer metadata over swap data
      for (const tx of parsedTxns) {
        if (tx.tokenIn?.mint && metadata[tx.tokenIn.mint]) {
          const meta = metadata[tx.tokenIn.mint]
          // Always use metadata symbol if available (more reliable than swap data)
          if (meta.symbol && meta.symbol !== 'Unknown') tx.tokenIn.symbol = meta.symbol
          if (meta.name) tx.tokenIn.name = meta.name
          if (meta.image) tx.tokenIn.image = meta.image
        }
        if (tx.tokenOut?.mint && metadata[tx.tokenOut.mint]) {
          const meta = metadata[tx.tokenOut.mint]
          // Always use metadata symbol if available (more reliable than swap data)
          if (meta.symbol && meta.symbol !== 'Unknown') tx.tokenOut.symbol = meta.symbol
          if (meta.name) tx.tokenOut.name = meta.name
          if (meta.image) tx.tokenOut.image = meta.image
        }
      }
    }

    // Fetch market caps for all tokens
    setFetchProgress('Fetching market cap data...')
    const allMints = Array.from(mintAddresses)
    if (allMints.length > 0) {
      const marketCaps = await getMarketCaps(allMints)

      // Update transactions with market cap data
      for (const tx of parsedTxns) {
        if (tx.tokenIn?.mint && marketCaps[tx.tokenIn.mint]) {
          tx.tokenIn.marketCap = marketCaps[tx.tokenIn.mint]
        }
        if (tx.tokenOut?.mint && marketCaps[tx.tokenOut.mint]) {
          tx.tokenOut.marketCap = marketCaps[tx.tokenOut.mint]
        }
      }
    }

    setFetchProgress(null)

    if (parsedTxns.length === 0) {
      setWalletError('No swap transactions found in transaction history')
      return
    }

    // Auto-import all transactions immediately
    setFetchProgress('Importing trades...')
    await autoImportTransactions(parsedTxns)
  }

  const autoImportTransactions = async (txns: WalletTransaction[], chain: string = 'Solana', nativeUsdPrice?: number) => {
    console.log('=== AUTO IMPORT START ===')
    console.log('Total transactions to process:', txns.length, 'Chain:', chain)

    const errors: string[] = []
    const trades: Trade[] = []

    // Base currencies (what you trade with, not what you track)
    const baseCurrencies = ['SOL', 'USDC', 'USDT', 'PYUSD', 'DAI', 'WETH', 'ETH', 'USDbC']

    // Stablecoins for USD conversion (these are ~$1)
    const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'USD1', 'BUSD', 'TUSD', 'FRAX', 'USDbC']

    // Native/wrapped tokens that need USD price conversion
    const nativeTokens = ['SOL', 'WETH', 'ETH']

    // Common routing/liquidity tokens that are often intermediaries in multi-hop swaps
    // These will be completely skipped to avoid recording intermediate routing legs
    const routingTokens = ['BONK', 'RAY', 'SRM', 'ORCA', 'MNGO', 'WSOL']

    const defaultPlatform = chain === 'Base' ? 'DEX' : 'Jupiter'

    for (const tx of txns) {
      try {
        if (!tx.tokenOut || !tx.tokenIn) continue

        const tokenInSymbol = tx.tokenIn.symbol.toUpperCase()
        const tokenOutSymbol = tx.tokenOut.symbol.toUpperCase()

        console.log(`Checking tx: ${tx.tokenIn.symbol} (${tokenInSymbol}) -> ${tx.tokenOut.symbol} (${tokenOutSymbol})`)

        // Completely skip any transaction involving routing tokens
        // These are intermediate hops that shouldn't be recorded as actual trades
        if (routingTokens.includes(tokenInSymbol) || routingTokens.includes(tokenOutSymbol)) {
          console.log(`>>> SKIPPING routing token: ${tx.tokenIn.symbol} -> ${tx.tokenOut.symbol}`)
          continue
        }
        console.log(`>>> NOT a routing token, continuing...`)

        const tokenInIsBase = baseCurrencies.includes(tokenInSymbol)
        const tokenOutIsBase = baseCurrencies.includes(tokenOutSymbol)

        console.log(`    tokenInIsBase: ${tokenInIsBase}, tokenOutIsBase: ${tokenOutIsBase}`)

        // Standard buy: base -> non-base token
        let isBuy = tokenInIsBase && !tokenOutIsBase

        // Standard sell: non-base token -> base
        let isSell = !tokenInIsBase && tokenOutIsBase

        console.log(`    isBuy: ${isBuy}, isSell: ${isSell}`)

        // Direction validation from description - override if description contradicts parsed direction
        const desc = (tx.description || '').toLowerCase()
        if (desc.includes('sold') || desc.includes('sell')) {
          // Description says SELL - verify we have isSell
          if (isBuy && !isSell) {
            console.log(`    Direction correction: description says SELL but parsed as BUY, swapping direction`)
            // Swap tokenIn and tokenOut references by swapping the direction flags
            isBuy = false
            isSell = true
            // Swap the token references in tx
            const tempToken = tx.tokenIn
            tx.tokenIn = tx.tokenOut
            tx.tokenOut = tempToken
          }
        } else if (desc.includes('bought') || desc.includes('buy')) {
          // Description says BUY - verify we have isBuy
          if (isSell && !isBuy) {
            console.log(`    Direction correction: description says BUY but parsed as SELL, swapping direction`)
            isBuy = true
            isSell = false
            const tempToken = tx.tokenIn
            tx.tokenIn = tx.tokenOut
            tx.tokenOut = tempToken
          }
        }

        if (!isBuy && !isSell) {
          console.log(`    SKIPPING: neither buy nor sell`)
          continue
        }

        if (isBuy) {
          const baseAmount = tx.tokenIn.amount
          const tokenAmount = tx.tokenOut.amount
          const baseCurrencySymbol = tx.tokenIn.symbol.toUpperCase()
          const isStablecoin = stablecoins.includes(baseCurrencySymbol)
          const isNativeToken = nativeTokens.includes(baseCurrencySymbol)

          // USD conversion: stablecoins = 1:1, native tokens use fetched price
          const usdPrice = isStablecoin ? 1 : (isNativeToken && nativeUsdPrice ? nativeUsdPrice : null)
          const totalValueUsd = usdPrice ? baseAmount * usdPrice : null
          // entry_price in USD terms when possible, otherwise in base currency terms
          const entryPrice = usdPrice ? (baseAmount * usdPrice) / tokenAmount : baseAmount / tokenAmount

          const trade: Trade = {
            id: generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token_symbol: tx.tokenOut.symbol,
            token_name: tx.tokenOut.name || null,
            token_chain: chain,
            token_contract_address: tx.tokenOut.mint || null,
            token_image: tx.tokenOut.image || null,
            direction: 'buy',
            entry_price: entryPrice,
            exit_price: null,
            quantity: tokenAmount,
            total_value: totalValueUsd || baseAmount,
            entry_date: new Date(tx.timestamp).toISOString(),
            exit_date: null,
            platform: tx.platform || defaultPlatform,
            status: 'open',
            pnl_amount: null,
            pnl_percent: null,
            market_cap_at_trade: tx.tokenOut.marketCap || null,
            base_currency: baseCurrencySymbol,
            base_currency_usd_price: usdPrice,
            total_value_usd: totalValueUsd,
          }

          console.log(`Recording buy: ${trade.token_symbol}, qty: ${trade.quantity}, value: ${trade.total_value} (USD: ${totalValueUsd})`)
          trades.push(trade)
        } else if (isSell) {
          const baseAmount = tx.tokenOut.amount
          const tokenAmount = tx.tokenIn.amount
          const baseCurrencySymbol = tx.tokenOut.symbol.toUpperCase()
          const isStablecoin = stablecoins.includes(baseCurrencySymbol)
          const isNativeToken = nativeTokens.includes(baseCurrencySymbol)

          const usdPrice = isStablecoin ? 1 : (isNativeToken && nativeUsdPrice ? nativeUsdPrice : null)
          const totalValueUsd = usdPrice ? baseAmount * usdPrice : null
          const exitPrice = usdPrice ? (baseAmount * usdPrice) / tokenAmount : baseAmount / tokenAmount

          const trade: Trade = {
            id: generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token_symbol: tx.tokenIn.symbol,
            token_name: tx.tokenIn.name || null,
            token_chain: chain,
            token_contract_address: tx.tokenIn.mint || null,
            token_image: tx.tokenIn.image || null,
            direction: 'sell',
            entry_price: exitPrice,
            exit_price: null,
            quantity: tokenAmount,
            total_value: totalValueUsd || baseAmount,
            entry_date: new Date(tx.timestamp).toISOString(),
            exit_date: null,
            platform: tx.platform || defaultPlatform,
            status: 'closed',
            pnl_amount: null,
            pnl_percent: null,
            market_cap_at_trade: tx.tokenIn.marketCap || null,
            base_currency: baseCurrencySymbol,
            base_currency_usd_price: usdPrice,
            total_value_usd: totalValueUsd,
          }

          console.log(`Recording sell: ${trade.token_symbol}, qty: ${trade.quantity}, value: ${trade.total_value}`)
          trades.push(trade)
        }
      } catch (err) {
        errors.push(`Transaction ${tx.signature.slice(0, 8)}...: Parse error`)
      }
    }

    if (trades.length > 0) {
      try {
        await db.bulkImportTrades(trades)
        setResult({ success: trades.length, errors })
        // Redirect to home after successful import
        setTimeout(() => {
          router.push('/')
        }, 1000)
      } catch (err) {
        errors.push('Database error during import')
        setResult({ success: 0, errors })
      }
    } else {
      setResult({ success: 0, errors: ['No valid trades found to import'] })
    }
  }

  // CSV handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    Papa.parse<ParsedRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const csvHeaders = Object.keys(results.data[0] as object)
          setHeaders(csvHeaders)
          setParsedData(results.data)

          const autoMapping: Record<string, string> = {}
          allFields.forEach((field) => {
            const match = csvHeaders.find(
              (h) =>
                h.toLowerCase().replace(/[_\s-]/g, '') ===
                field.toLowerCase().replace(/[_\s-]/g, '')
            )
            if (match) {
              autoMapping[field] = match
            }
          })
          setMapping(autoMapping)
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        setResult({ success: 0, errors: ['Failed to parse CSV file'] })
      },
    })
  }

  const handleCsvImport = async () => {
    if (parsedData.length === 0) return

    setImporting(true)
    const errors: string[] = []
    const trades: Trade[] = []

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      try {
        const symbol = row[mapping.token_symbol || '']
        const entryPriceStr = row[mapping.entry_price || '']
        const quantityStr = row[mapping.quantity || '']
        const entryDate = row[mapping.entry_date || '']

        if (!symbol || !entryPriceStr || !quantityStr || !entryDate) {
          errors.push(`Row ${i + 2}: Missing required field(s)`)
          continue
        }

        const entryPrice = parseFloat(entryPriceStr.replace(/[,$]/g, ''))
        const quantity = parseFloat(quantityStr.replace(/[,$]/g, ''))
        const exitPriceStr = row[mapping.exit_price || '']
        const exitPrice = exitPriceStr ? parseFloat(exitPriceStr.replace(/[,$]/g, '')) : null

        if (isNaN(entryPrice) || isNaN(quantity)) {
          errors.push(`Row ${i + 2}: Invalid price or quantity`)
          continue
        }

        const direction = (row[mapping.direction || ''] || 'buy').toLowerCase() as 'buy' | 'sell'
        const status = (row[mapping.status || ''] || (exitPrice ? 'closed' : 'open')).toLowerCase() as 'open' | 'closed' | 'partial'

        let pnlAmount: number | null = null
        let pnlPercent: number | null = null

        if (exitPrice !== null && status === 'closed') {
          const priceDiff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
          pnlAmount = priceDiff * quantity
          pnlPercent = (priceDiff / entryPrice) * 100
        }

        const trade: Trade = {
          id: generateId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_symbol: symbol.toUpperCase(),
          token_name: row[mapping.token_name || ''] || null,
          token_chain: row[mapping.token_chain || ''] || null,
          token_contract_address: null,
          token_image: null,
          direction,
          entry_price: entryPrice,
          exit_price: exitPrice,
          quantity,
          total_value: entryPrice * quantity,
          entry_date: entryDate,
          exit_date: row[mapping.exit_date || ''] || null,
          platform: row[mapping.platform || ''] || null,
          status,
          pnl_amount: pnlAmount,
          pnl_percent: pnlPercent,
          market_cap_at_trade: null,
          base_currency: null, // Unknown from CSV
          base_currency_usd_price: null,
          total_value_usd: null,
        }

        trades.push(trade)
      } catch (err) {
        errors.push(`Row ${i + 2}: Parse error`)
      }
    }

    if (trades.length > 0) {
      try {
        await db.bulkImportTrades(trades)
        setResult({ success: trades.length, errors })
      } catch (err) {
        errors.push('Database error during import')
        setResult({ success: 0, errors })
      }
    } else {
      setResult({ success: 0, errors })
    }

    setImporting(false)
  }

  const downloadTemplate = () => {
    const template = `token_symbol,token_name,token_chain,direction,entry_price,exit_price,quantity,entry_date,exit_date,platform,status
SOL,Solana,Solana,buy,100.50,120.75,10,2024-01-15,2024-01-20,Jupiter,closed
ETH,Ethereum,Ethereum,buy,2500,,,1,2024-01-18,,MetaMask,open
BONK,Bonk,Solana,buy,0.00001,0.000025,100000000,2024-01-10,2024-01-15,Raydium,closed`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trade_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Import Trades</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Import trades from CSV or directly from your wallet
        </p>
      </div>

      {/* Portfolio Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Portfolio Settings
          </CardTitle>
          <CardDescription>
            Enter values from your Fomo app for accurate P&L. The easiest method is to enter your Total Portfolio Value directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="initial-capital">Initial Capital (USD)</Label>
              <Input
                id="initial-capital"
                type="number"
                step="0.01"
                placeholder="e.g. 1076.81"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                How much you originally deposited (Total - P&L from Fomo)
              </p>
            </div>
            <div>
              <Label htmlFor="total-portfolio">Total Portfolio Value (USD)</Label>
              <Input
                id="total-portfolio"
                type="number"
                step="0.01"
                placeholder="e.g. 2004.01"
                value={totalPortfolioValue}
                onChange={(e) => setTotalPortfolioValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your total value from Fomo app (overrides calculated positions)
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <strong>Quick setup:</strong> From Fomo, enter your Total (e.g. $2,004.01) above, then calculate Initial Capital = Total - P&L (e.g. $2,004.01 - $927.20 = $1,076.81)
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={savePortfolioSettings}>
              {portfolioSaved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            {initialCapital && walletBalance && (
              <span className="text-sm text-muted-foreground">
                Implied P&L from wallet: {formatCurrency(parseFloat(walletBalance) - parseFloat(initialCapital))}
                {' '}(before open positions)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="wallet">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wallet">
            <Wallet className="h-4 w-4 mr-2" />
            Wallet Import
          </TabsTrigger>
          <TabsTrigger value="csv">
            <FileText className="h-4 w-4 mr-2" />
            CSV Import
          </TabsTrigger>
        </TabsList>

        {/* Wallet Import Tab */}
        <TabsContent value="wallet" className="space-y-6 mt-6">
          {/* API Key Setup */}
          {walletChain === 'solana' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  API Configuration
                  <Badge variant="secondary">Required</Badge>
                </CardTitle>
                <CardDescription>
                  Enter your Helius API key to fetch Solana transactions.{' '}
                  <a
                    href="https://helius.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Get a free key <ExternalLink className="h-3 w-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Your Helius API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button variant="outline" onClick={saveApiKey}>
                    Save Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  API Configuration
                  <Badge variant="outline">No Key Needed</Badge>
                </CardTitle>
                <CardDescription>
                  Base transactions are fetched via Blockscout (free, no API key required).
                  Supports Fomo app Account Abstraction transactions.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Wallet Input */}
          <Card>
            <CardHeader>
              <CardTitle>Wallet Address</CardTitle>
              <CardDescription>
                Enter your wallet address to fetch swap transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label htmlFor="wallet">Wallet Address</Label>
                  <Input
                    id="wallet"
                    placeholder="Enter Solana wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="chain">Chain</Label>
                  <Select value={walletChain} onChange={(e) => setWalletChain(e.target.value)}>
                    <option value="solana">Solana</option>
                    <option value="base">Base</option>
                    <option value="ethereum" disabled>Ethereum (Coming Soon)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="label">Label (Optional)</Label>
                  <Input
                    id="label"
                    placeholder="My Trading Wallet"
                    value={walletLabel}
                    onChange={(e) => setWalletLabel(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchWalletTransactions} disabled={fetchingTxns || !walletAddress}>
                  {fetchingTxns ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {fetchProgress || 'Fetching...'}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Fetch All Transactions
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={addWalletToWatchlist} disabled={!walletAddress}>
                  Add to Watchlist
                </Button>
              </div>

              {walletError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {walletError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Wallets */}
          {savedWallets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Watched Wallets</CardTitle>
                <CardDescription>
                  Click on a wallet to load it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {savedWallets.map((wallet) => (
                    <div
                      key={`${wallet.chain}-${wallet.address}`}
                      className="flex items-center gap-2 px-3 py-2 border bg-muted/50"
                    >
                      <button
                        onClick={() => {
                          setWalletAddress(wallet.address)
                          setWalletChain(wallet.chain)
                        }}
                        className="text-sm hover:text-primary"
                      >
                        {wallet.label || `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`}
                      </button>
                      <Badge variant="secondary" className="text-xs">
                        {wallet.chain}
                      </Badge>
                      <button
                        onClick={() => removeWalletFromWatchlist(wallet.address, wallet.chain)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Fetches your recent swap transactions from the blockchain</li>
                    <li>Parses token swaps (buys) automatically</li>
                    <li>Creates open trade entries you can later close with exit prices</li>
                    <li>Your API key is stored locally and never sent to our servers</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Import Tab */}
        <TabsContent value="csv" className="space-y-6 mt-6">
          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle>CSV Template</CardTitle>
              <CardDescription>
                Download a template CSV file to see the expected format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select a CSV file containing your trade data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {parsedData.length} rows found
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Click to select a CSV file
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Column Mapping */}
          {headers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>
                  Match your CSV columns to trade fields. Required fields are marked with *.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {allFields.map((field) => (
                    <div key={field} className="space-y-2">
                      <Label>
                        {field.replace(/_/g, ' ')}
                        {requiredFields.includes(field) && (
                          <span className="text-destructive"> *</span>
                        )}
                      </Label>
                      <Select
                        value={mapping[field] || ''}
                        onChange={(e) =>
                          setMapping({ ...mapping, [field]: e.target.value })
                        }
                      >
                        <option value="">-- Select column --</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  First 5 rows of your data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left">Symbol</th>
                        <th className="p-2 text-left">Direction</th>
                        <th className="p-2 text-right">Entry</th>
                        <th className="p-2 text-right">Exit</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{row[mapping.token_symbol || ''] || '-'}</td>
                          <td className="p-2">{row[mapping.direction || ''] || 'buy'}</td>
                          <td className="p-2 text-right">{row[mapping.entry_price || ''] || '-'}</td>
                          <td className="p-2 text-right">{row[mapping.exit_price || ''] || '-'}</td>
                          <td className="p-2 text-right">{row[mapping.quantity || ''] || '-'}</td>
                          <td className="p-2">{row[mapping.entry_date || ''] || '-'}</td>
                          <td className="p-2">{row[mapping.status || ''] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions for CSV */}
          {parsedData.length > 0 && (
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFile(null)
                  setParsedData([])
                  setHeaders([])
                  setMapping({})
                  setResult(null)
                }}
              >
                Clear
              </Button>
              <Button
                className="flex-1"
                onClick={handleCsvImport}
                disabled={
                  importing ||
                  !requiredFields.every((f) => mapping[f])
                }
              >
                {importing ? 'Importing...' : `Import ${parsedData.length} Trades`}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Import Result */}
      {result && (
        <Card className={result.success > 0 ? 'border-green-500' : 'border-destructive'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {result.success > 0 ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-destructive" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold">
                  {result.success > 0
                    ? `Successfully imported ${result.success} trades`
                    : 'Import failed'}
                </h3>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      {result.errors.length} error(s):
                    </p>
                    <ul className="text-sm text-destructive">
                      {result.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
