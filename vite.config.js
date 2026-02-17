import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// Helper to fetch from HTTPS URL with better error handling
function fetchHttps(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      timeout: timeout,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data })
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data, error: e.message })
        }
      })
    })
    req.on('error', (e) => resolve({ status: 0, data: null, error: e.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ status: 0, data: null, error: 'Request timeout' })
    })
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-contact',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/contact' && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try {
                const data = JSON.parse(body)
                if (!data.name || !data.email || !data.message || data.message.length < 10) {
                  res.writeHead(400, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ ok: false, error: 'Validation failed' }))
                  return
                }
                console.log('[Contact]', data)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false }))
              }
            })
          } else {
            next()
          }
        })
      },
    },
    {
      name: 'api-alpha-access',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/alpha-access' && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const data = JSON.parse(body)
                if (!data.name || !data.email || !data.role) {
                  res.writeHead(400, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ ok: false, error: 'Validation failed' }))
                  return
                }
                console.log('[Alpha Access]', data)
                
                // In production, this would send an email via Resend or similar service
                // For now, log it (in production, the Vercel serverless function will handle email sending)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: e.message }))
              }
            })
          } else {
            next()
          }
        })
      },
    },
    {
      name: 'polymarket-live-data',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/polymarket-live' || req.url.startsWith('/api/polymarket-live?')) {
            console.log('[Polymarket] Browser request received for /api/polymarket-live')
            
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            res.setHeader('Content-Type', 'application/json')
            
            // Handle OPTIONS preflight
            if (req.method === 'OPTIONS') {
              res.writeHead(200)
              res.end()
              return
            }
            
            // Async function to fetch data (BTC $100k by Dec 31 2026 – same as trade-demo)
            const BTC100K_SLUG = 'will-bitcoin-reach-100000-by-december-31-2026-571'
            const fetchData = async () => {
              try {
                console.log('[Polymarket] Fetching live market data for "Will Bitcoin reach $100,000 by December 31, 2026?"...')
                
                let marketData = null
                
                // Approach 1: Market slug directly
                console.log('[Polymarket] Trying market slug...')
                const marketSlugResult = await fetchHttps(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(BTC100K_SLUG)}`)
                if (marketSlugResult.status === 200 && marketSlugResult.data) {
                  const raw = marketSlugResult.data
                  const markets = Array.isArray(raw) ? raw : raw.markets || raw.data || [raw]
                  if (markets.length > 0) {
                    marketData = markets[0]
                    console.log('[Polymarket] Found via market slug:', marketData.question)
                  }
                }
                
                // Approach 2: Events API with slug
                if (!marketData) {
                  console.log('[Polymarket] Trying events slug...')
                  const slugResult = await fetchHttps(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(BTC100K_SLUG)}`)
                  if (slugResult.status === 200 && slugResult.data) {
                    const events = Array.isArray(slugResult.data) ? slugResult.data : [slugResult.data]
                    if (events.length > 0 && events[0].markets && events[0].markets.length > 0) {
                      marketData = events[0].markets[0]
                      console.log('[Polymarket] Found via events slug:', marketData.question)
                    }
                  }
                }
                
                // Approach 3: Search all markets for BTC 100k Dec 31 2026
                if (!marketData) {
                  const gammaEndpoints = [
                    'https://gamma-api.polymarket.com/markets?closed=false&limit=1000',
                    'https://gamma-api.polymarket.com/markets?active=true&limit=1000',
                  ]
                  for (const endpoint of gammaEndpoints) {
                    const result = await fetchHttps(endpoint)
                    if (result.status === 200 && result.data) {
                      const markets = Array.isArray(result.data) ? result.data : []
                      const btcMarket = markets.find(m => {
                        const s = (m.slug || '').toLowerCase()
                        const q = (m.question || '').toLowerCase()
                        return s.includes('bitcoin') && (s.includes('100000') || s.includes('100k')) ||
                               (q.includes('bitcoin') && q.includes('100') && q.includes('2026'))
                      })
                      if (btcMarket) {
                        marketData = btcMarket
                        console.log('[Polymarket] Found via search:', marketData.question)
                        break
                      }
                    }
                  }
                }
                
                if (marketData) {
                  // Enrich with live best bid/ask from CLOB
                  let tokenIds = marketData.clobTokenIds
                  if (!tokenIds && marketData.tokens) tokenIds = marketData.tokens.map(t => t.token_id || t.tokenId)
                  if (Array.isArray(tokenIds) && tokenIds.length > 0) {
                    try {
                      const bookResult = await fetchHttps(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenIds[0])}`)
                      if (bookResult.status === 200 && bookResult.data) {
                        const book = bookResult.data
                        const bids = book.bids || []
                        const asks = book.asks || []
                        if (bids.length > 0 || asks.length > 0) {
                          const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : null
                          const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : null
                          if (bestBid != null || bestAsk != null) {
                            marketData = { ...marketData, bestBid: bestBid ?? marketData.bestBid, bestAsk: bestAsk ?? marketData.bestAsk }
                          }
                        }
                      }
                    } catch (e) {
                      console.log('[Polymarket] CLOB book failed:', e.message)
                    }
                  }
                  console.log('[Polymarket] SUCCESS - Returning market data:', marketData.question)
                  res.writeHead(200)
                  res.end(JSON.stringify({ success: true, market: marketData, source: 'live' }))
                } else {
                  throw new Error('Market not found after trying all approaches')
                }
              } catch (error) {
                console.error('[Polymarket] Error:', error.message)
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: error.message }))
              }
            }
            
            // Execute the async function
            fetchData()
          } else {
            next()
          }
        })
      },
    },
  ],
  server: {
    proxy: {
      // Proxy Polymarket Gamma API (events, markets data)
      '/polymarket-gamma': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/polymarket-gamma/, ''),
        secure: true,
      },
      // Proxy Polymarket CLOB API (prices, orderbook)
      '/polymarket-clob': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/polymarket-clob/, ''),
        secure: true,
      },
    },
  },
})
