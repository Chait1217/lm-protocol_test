// Vercel Serverless Function to fetch Polymarket data
// This runs server-side, bypassing CORS issues

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('[Polymarket API] Fetching market data...');
    
    let marketData = null;
    
    const BTC100K_SLUG = 'will-bitcoin-reach-100000-by-december-31-2026-571';

    // Approach 1: Try market slug directly (Gamma: single market by slug)
    try {
      const marketResponse = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(BTC100K_SLUG)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        }
      );

      if (marketResponse.ok) {
        const data = await marketResponse.json();
        const markets = Array.isArray(data) ? data : data.markets || data.data || [data];
        if (markets.length > 0) {
          marketData = markets[0];
          console.log('[Polymarket API] Found via market slug:', marketData.question);
        }
      }
    } catch (e) {
      console.log('[Polymarket API] Market slug search failed:', e.message);
    }

    // Approach 2: Try events API with slug
    if (!marketData) {
      try {
        const slugResponse = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(BTC100K_SLUG)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          }
        );

        if (slugResponse.ok) {
          const data = await slugResponse.json();
          const events = Array.isArray(data) ? data : [data];
          if (events.length > 0 && events[0].markets && events[0].markets.length > 0) {
            marketData = events[0].markets[0];
            console.log('[Polymarket API] Found via events slug:', marketData.question);
          }
        }
      } catch (e) {
        console.log('[Polymarket API] Events slug search failed:', e.message);
      }
    }

    // Approach 3: Search all markets for BTC 100k Dec 31 2026
    if (!marketData) {
      try {
        const allResponse = await fetch(
          'https://gamma-api.polymarket.com/markets?closed=false&limit=1000',
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          }
        );

        if (allResponse.ok) {
          const markets = await allResponse.json();
          if (Array.isArray(markets)) {
            marketData = markets.find(m => {
              const s = (m.slug || '').toLowerCase();
              const q = (m.question || '').toLowerCase();
              return s.includes('bitcoin') && (s.includes('100000') || s.includes('100k')) ||
                     (q.includes('bitcoin') && q.includes('100') && q.includes('2026'));
            });
            if (marketData) {
              console.log('[Polymarket API] Found via search:', marketData.question);
            }
          }
        }
      } catch (e) {
        console.log('[Polymarket API] Market search failed:', e.message);
      }
    }
    
    if (marketData) {
      // Enrich with live best bid/ask from CLOB when we have token IDs
      let clobTokenIds = marketData.clobTokenIds;
      if (!clobTokenIds && marketData.tokens) {
        clobTokenIds = marketData.tokens.map(t => t.token_id || t.tokenId);
      }
      if (Array.isArray(clobTokenIds) && clobTokenIds.length > 0) {
        try {
          const tokenId = clobTokenIds[0]; // YES token
          const bookRes = await fetch(
            `https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`,
            { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
          );
          if (bookRes.ok) {
            const book = await bookRes.json();
            const bids = book.bids || [];
            const asks = book.asks || [];
            if (bids.length > 0 || asks.length > 0) {
              const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : null;
              const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : null;
              if (bestBid != null || bestAsk != null) {
                marketData = { ...marketData, bestBid: bestBid ?? marketData.bestBid, bestAsk: bestAsk ?? marketData.bestAsk };
              }
            }
          }
        } catch (e) {
          console.log('[Polymarket API] CLOB book fetch failed:', e.message);
        }
      }
      return res.status(200).json({
        success: true,
        market: marketData,
        source: 'live'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }
  } catch (error) {
    console.error('[Polymarket API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
