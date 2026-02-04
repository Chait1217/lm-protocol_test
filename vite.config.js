import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
