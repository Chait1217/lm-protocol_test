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
        const to = process.env.CONTACT_TO_EMAIL || 'lmprotocolcontact@gmail.com'
        const from = process.env.CONTACT_FROM_EMAIL || 'lmprotocolcontact@gmail.com'
        const apiKey = process.env.RESEND_API_KEY
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/contact' && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const data = JSON.parse(body)
                if (!data.name || !data.email || !data.message || data.message.length < 10) {
                  res.writeHead(400, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ ok: false, error: 'Validation failed' }))
                  return
                }
                if (apiKey) {
                  const fromAddr = from.includes('<') ? from : `LM Protocol <${from}>`
                  const emailRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      from: fromAddr,
                      to: [to],
                      subject: `Contact form: ${data.category ? `[${data.category}] ` : ''}from ${data.name}`,
                      text: `Name: ${data.name}\nEmail: ${data.email}\n${data.category ? `Category: ${data.category}\n` : ''}\n${data.message}`,
                    }),
                  })
                  if (!emailRes.ok) {
                    const errText = await emailRes.text()
                    console.error('[Contact] Resend error:', emailRes.status, errText)
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ ok: false, error: 'Failed to send email' }))
                    return
                  }
                } else {
                  console.log('[Contact] (no RESEND_API_KEY) ', data.name, data.email)
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: e.message || 'Bad request' }))
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
        const to = process.env.CONTACT_TO_EMAIL || 'lmprotocolcontact@gmail.com'
        const from = process.env.CONTACT_FROM_EMAIL || 'lmprotocolcontact@gmail.com'
        const apiKey = process.env.RESEND_API_KEY
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
                if (apiKey) {
                  const fromAddr = from.includes('<') ? from : `LM Protocol <${from}>`
                  const textBody = `New Alpha Access Application\n\nName: ${data.name}\nEmail: ${data.email}\nRole: ${data.role}\n${data.message ? `Message: ${data.message}` : ''}\n\nSubmitted at: ${new Date().toISOString()}`
                  const emailRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      from: fromAddr,
                      to: [to],
                      subject: `New Alpha Access Application from ${data.name}`,
                      text: textBody,
                    }),
                  })
                  if (!emailRes.ok) {
                    const errText = await emailRes.text()
                    console.error('[Alpha Access] Resend error:', emailRes.status, errText)
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ ok: false, error: 'Failed to send email' }))
                    return
                  }
                } else {
                  console.log('[Alpha Access] (no RESEND_API_KEY)', data.name, data.email)
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: e.message || 'Bad request' }))
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
            
            // Async function to fetch data: prefer BTC $100k by Dec 31 2026, fallback to top by volume
            const PREFERRED_SLUGS = [
              'will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568',
              'will-gavin-newsom-win-the-2028-democratic-presidential-nomination',
              'will-bitcoin-reach-100000-by-december-31-2026-571',
              'will-bitcoin-reach-100000-by-december-31-2026',
              'bitcoin-100k-december-2026',
            ]
            const fetchData = async () => {
              try {
                console.log('[Polymarket] Fetching live market data...')
                let marketData = null

                // Approach 1: Path-based slug (GET /markets/slug/{slug})
                for (const slug of PREFERRED_SLUGS) {
                  const pathResult = await fetchHttps(`https://gamma-api.polymarket.com/markets/slug/${encodeURIComponent(slug)}`)
                  if (pathResult.status === 200 && pathResult.data && (pathResult.data.slug || pathResult.data.question)) {
                    marketData = pathResult.data
                    console.log('[Polymarket] Found via path slug:', marketData.question)
                    break
                  }
                }

                // Approach 2: Query-based slug
                if (!marketData) {
                  for (const slug of PREFERRED_SLUGS) {
                    const queryResult = await fetchHttps(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`)
                    if (queryResult.status === 200 && queryResult.data) {
                      const raw = queryResult.data
                      const markets = Array.isArray(raw) ? raw : raw.markets || raw.data || (raw.slug ? [raw] : [])
                      if (markets.length > 0) {
                        marketData = markets[0]
                        console.log('[Polymarket] Found via query slug:', marketData.question)
                        break
                      }
                    }
                  }
                }

                // Approach 3: Events API with slug
                if (!marketData) {
                  for (const slug of PREFERRED_SLUGS) {
                    const slugResult = await fetchHttps(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`)
                    if (slugResult.status === 200 && slugResult.data) {
                      const events = Array.isArray(slugResult.data) ? slugResult.data : [slugResult.data]
                      if (events.length > 0 && events[0].markets && events[0].markets.length > 0) {
                        marketData = events[0].markets[0]
                        console.log('[Polymarket] Found via events slug:', marketData.question)
                        break
                      }
                    }
                  }
                }

                // Approach 4: Fallback — top active market by 24h volume (high volume + volatile)
                if (!marketData) {
                  const listResult = await fetchHttps('https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200')
                  if (listResult.status === 200 && listResult.data) {
                    const markets = Array.isArray(listResult.data) ? listResult.data : []
                    const parseTokenIds = (m) => {
                      let ids = m.clobTokenIds || (m.tokens && m.tokens.map(t => t.token_id || t.tokenId))
                      if (typeof ids === 'string') {
                        try { ids = JSON.parse(ids) } catch (_) { ids = [] }
                      }
                      return Array.isArray(ids) ? ids : []
                    }
                    const withVolume = markets.filter(m => {
                      const tokenIds = parseTokenIds(m)
                      const vol = m.volume24hrNum ?? m.volumeNum ?? Number(m.volume24hr) ?? Number(m.volume) ?? 0
                      return vol > 0 && tokenIds.length > 0
                    })
                    const byVolume = [...withVolume].sort((a, b) => {
                      const vA = a.volume24hrNum ?? a.volumeNum ?? Number(a.volume24hr) ?? Number(a.volume) ?? 0
                      const vB = b.volume24hrNum ?? b.volumeNum ?? Number(b.volume24hr) ?? Number(b.volume) ?? 0
                      return vB - vA
                    })
                    if (byVolume.length > 0) {
                      marketData = byVolume[0]
                      console.log('[Polymarket] Using top by volume:', marketData.question)
                    }
                  }
                }
                
                if (marketData) {
                  // Enrich with live best bid/ask from CLOB
                  let tokenIds = marketData.clobTokenIds
                  if (typeof tokenIds === 'string') {
                    try { tokenIds = JSON.parse(tokenIds) } catch (_) { tokenIds = [] }
                  }
                  if (!tokenIds && marketData.tokens) tokenIds = marketData.tokens.map(t => t.token_id || t.tokenId)
                  if (Array.isArray(tokenIds) && tokenIds.length > 0) {
                    try {
                      const bookResult = await fetchHttps(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenIds[0])}`)
                      if (bookResult.status === 200 && bookResult.data) {
                        const book = bookResult.data
                        const bids = book.bids || []
                        const asks = book.asks || []
                        const toPrice = (level) => typeof level === 'object' && level != null
                          ? (level.price != null ? parseFloat(level.price) : (Array.isArray(level) ? parseFloat(level[0]) : NaN))
                          : NaN
                        const bidPrices = bids.map(toPrice).filter(p => !isNaN(p) && p >= 0 && p <= 1)
                        const askPrices = asks.map(toPrice).filter(p => !isNaN(p) && p >= 0 && p <= 1)
                        const bestBid = bidPrices.length > 0 ? Math.max(...bidPrices) : null
                        const bestAsk = askPrices.length > 0 ? Math.min(...askPrices) : null
                        if (bestBid != null || bestAsk != null) {
                          marketData = { ...marketData, bestBid: bestBid ?? marketData.bestBid, bestAsk: bestAsk ?? marketData.bestAsk }
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
