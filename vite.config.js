import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// Helper function to fetch URL content
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
      }
    }, (response) => {
      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => resolve({ status: response.statusCode, data }))
      response.on('error', reject)
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
      name: 'polymarket-scraper',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Endpoint to scrape Polymarket comments for a specific market
          if (req.url?.startsWith('/api/polymarket-comments')) {
            const urlParams = new URL(req.url, 'http://localhost').searchParams
            const slug = urlParams.get('slug') || 'will-jesus-christ-return-before-2027'
            
            try {
              console.log(`[Polymarket Scraper] Fetching comments for: ${slug}`)
              
              // Try multiple API endpoints to get comments
              const endpoints = [
                `https://gamma-api.polymarket.com/comments?event_slug=${slug}&limit=10`,
                `https://gamma-api.polymarket.com/comments?market_slug=${slug}&limit=10`,
                `https://gamma-api.polymarket.com/events/slug/${slug}`,
              ]
              
              let comments = []
              
              for (const endpoint of endpoints) {
                try {
                  const result = await fetchUrl(endpoint)
                  if (result.status === 200) {
                    const data = JSON.parse(result.data)
                    
                    // Check if this is event data (contains markets)
                    if (data.markets && data.markets.length > 0) {
                      const market = data.markets[0]
                      const conditionId = market.conditionId
                      
                      // Try to fetch comments using conditionId
                      if (conditionId) {
                        const commentsResult = await fetchUrl(
                          `https://gamma-api.polymarket.com/comments?market=${conditionId}&limit=10`
                        )
                        if (commentsResult.status === 200) {
                          const commentsData = JSON.parse(commentsResult.data)
                          const arr = Array.isArray(commentsData) ? commentsData : commentsData.comments || []
                          if (arr.length > 0) {
                            comments = arr.slice(0, 3)
                            break
                          }
                        }
                      }
                    }
                    
                    // Direct comments response
                    const arr = Array.isArray(data) ? data : data.comments || []
                    if (arr.length > 0) {
                      comments = arr.slice(0, 3)
                      break
                    }
                  }
                } catch (e) {
                  console.warn(`[Polymarket Scraper] Endpoint failed: ${endpoint}`, e.message)
                }
              }
              
              // If API didn't return comments, try scraping the actual page
              if (comments.length === 0) {
                console.log('[Polymarket Scraper] API returned no comments, trying page scrape...')
                
                const pageUrl = `https://polymarket.com/event/${slug}`
                const pageResult = await fetchUrl(pageUrl)
                
                if (pageResult.status === 200) {
                  // Look for __NEXT_DATA__ script tag which contains the page data
                  const nextDataMatch = pageResult.data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/)
                  
                  if (nextDataMatch) {
                    try {
                      const nextData = JSON.parse(nextDataMatch[1])
                      const pageProps = nextData?.props?.pageProps
                      
                      // Extract comments from page props
                      if (pageProps?.comments) {
                        comments = pageProps.comments.slice(0, 3)
                      } else if (pageProps?.event?.comments) {
                        comments = pageProps.event.comments.slice(0, 3)
                      }
                    } catch (e) {
                      console.warn('[Polymarket Scraper] Failed to parse __NEXT_DATA__:', e.message)
                    }
                  }
                }
              }
              
              // Format comments
              const formattedComments = comments.map((c, idx) => ({
                id: c.id || `scraped-${idx}`,
                user: c.username || c.user?.username || c.author || 'Anonymous',
                text: c.content || c.text || c.body || '',
                timestamp: c.created_at || c.createdAt || c.timestamp || new Date().toISOString(),
                avatar: c.user?.profile_picture || c.profilePicture || c.avatar || null,
              }))
              
              console.log(`[Polymarket Scraper] Found ${formattedComments.length} comments`)
              
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ 
                success: true, 
                comments: formattedComments,
                source: comments.length > 0 ? 'polymarket' : 'none'
              }))
            } catch (error) {
              console.error('[Polymarket Scraper] Error:', error)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: error.message, comments: [] }))
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
