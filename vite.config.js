import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// Helper to fetch from HTTPS URL
function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: e.message })
        }
      })
    }).on('error', reject)
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
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/polymarket-live') {
            try {
              console.log('[Polymarket] Fetching live market data...')
              
              // Fetch all active markets from Gamma API
              const result = await fetchHttps('https://gamma-api.polymarket.com/markets?closed=false&limit=1000')
              
              if (result.status !== 200 || !result.data) {
                throw new Error(`API returned ${result.status}`)
              }
              
              const markets = Array.isArray(result.data) ? result.data : []
              
              // Find the Jesus Christ market
              const jesusMarket = markets.find(m => {
                const q = (m.question || '').toLowerCase()
                return q.includes('jesus') && q.includes('christ') && q.includes('2027')
              })
              
              if (!jesusMarket) {
                // Try alternative search
                const altMarket = markets.find(m => {
                  const q = (m.question || '').toLowerCase()
                  return q.includes('jesus') && q.includes('return')
                })
                
                if (altMarket) {
                  console.log('[Polymarket] Found market (alt):', altMarket.question)
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: true, market: altMarket, source: 'live' }))
                  return
                }
                
                throw new Error('Market not found')
              }
              
              console.log('[Polymarket] Found market:', jesusMarket.question)
              console.log('[Polymarket] Probability:', jesusMarket.outcomePrices)
              
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true, market: jesusMarket, source: 'live' }))
            } catch (error) {
              console.error('[Polymarket] Error:', error.message)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: error.message }))
            }
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
