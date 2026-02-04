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
            
            // Async function to fetch data
            const fetchData = async () => {
              try {
                console.log('[Polymarket] Fetching live market data for "Will Jesus Christ return before 2027?"...')
                
                let marketData = null
                
                // Approach 1: Try direct slug search first (most specific)
                console.log('[Polymarket] Trying direct slug search...')
                const slugResult = await fetchHttps('https://gamma-api.polymarket.com/events?slug=will-jesus-christ-return-before-2027')
                if (slugResult.status === 200 && slugResult.data) {
                  const events = Array.isArray(slugResult.data) ? slugResult.data : [slugResult.data]
                  if (events.length > 0 && events[0].markets && events[0].markets.length > 0) {
                    marketData = events[0].markets[0]
                    console.log('[Polymarket] Found via slug:', marketData.question)
                  }
                }
                
                // Approach 2: Search by market slug directly
                if (!marketData) {
                  console.log('[Polymarket] Trying market slug search...')
                  const marketSlugResult = await fetchHttps('https://gamma-api.polymarket.com/markets?slug=will-jesus-christ-return-before-2027')
                  if (marketSlugResult.status === 200 && marketSlugResult.data) {
                    const markets = Array.isArray(marketSlugResult.data) ? marketSlugResult.data : [marketSlugResult.data]
                    if (markets.length > 0) {
                      marketData = markets[0]
                      console.log('[Polymarket] Found via market slug:', marketData.question)
                    }
                  }
                }
                
                // Approach 3: Try Gamma API endpoints and search for SPECIFIC "2027" market
                if (!marketData) {
                  const gammaEndpoints = [
                    'https://gamma-api.polymarket.com/markets?closed=false&limit=1000',
                    'https://gamma-api.polymarket.com/markets?active=true&limit=1000',
                    'https://gamma-api.polymarket.com/markets?limit=2000',
                  ]
                  
                  for (const endpoint of gammaEndpoints) {
                    console.log('[Polymarket] Trying:', endpoint)
                    const result = await fetchHttps(endpoint)
                    
                    if (result.status === 200 && result.data) {
                      const markets = Array.isArray(result.data) ? result.data : []
                      console.log(`[Polymarket] Got ${markets.length} markets`)
                      
                      // Search specifically for "2027" market (must include 2027 to avoid GTA VI market)
                      const jesusMarket = markets.find(m => {
                        const q = (m.question || '').toLowerCase()
                        const s = (m.slug || '').toLowerCase()
                        // Must include "2027" to be specific
                        return (q.includes('jesus') && q.includes('christ') && q.includes('2027')) ||
                               s.includes('jesus-christ-return-before-2027')
                      })
                      
                      if (jesusMarket) {
                        console.log('[Polymarket] Found market:', jesusMarket.question)
                        marketData = jesusMarket
                        break
                      }
                    }
                  }
                }
                
                // Approach 4: Try Strapi API with 2027 filter
                if (!marketData) {
                  console.log('[Polymarket] Trying Strapi API...')
                  const strapiResult = await fetchHttps('https://strapi-matic.poly.market/markets?slug_contains=jesus-christ-return-before-2027')
                  if (strapiResult.status === 200 && strapiResult.data) {
                    const markets = Array.isArray(strapiResult.data) ? strapiResult.data : []
                    const filtered = markets.filter(m => (m.question || m.title || '').toLowerCase().includes('2027'))
                    if (filtered.length > 0) {
                      marketData = filtered[0]
                      console.log('[Polymarket] Found via Strapi:', marketData.question || marketData.title)
                    }
                  }
                }
                
                // Approach 5: Direct CLOB API for specific token (known 2027 market tokens)
                if (!marketData) {
                  console.log('[Polymarket] Trying CLOB API with known token IDs...')
                  const tokenIds = [
                    '69324317355037271422943965141382095011871956039434394956830818206664869608517',
                    '51797157743046504218541616681751597845468055908324407922581755135522797852101'
                  ]
                  
                  for (const tokenId of tokenIds) {
                    const clobResult = await fetchHttps(`https://clob.polymarket.com/markets/${tokenId}`)
                    if (clobResult.status === 200 && clobResult.data) {
                      console.log('[Polymarket] Found via CLOB:', clobResult.data)
                      marketData = {
                        question: 'Will Jesus Christ return before 2027?',
                        outcomePrices: JSON.stringify([clobResult.data.price || 0.04, 1 - (clobResult.data.price || 0.04)]),
                        volume: clobResult.data.volume || 0,
                        volume24hr: 0,
                        uniqueBettors: clobResult.data.traders || 0,
                        slug: 'will-jesus-christ-return-before-2027',
                        clobSource: true,
                      }
                      break
                    }
                  }
                }
                
                if (marketData) {
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
