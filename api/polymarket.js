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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    };

    // Preferred: Gavin Newsom 2028 Democratic nomination, then BTC $100k
    const PREFERRED_SLUGS = [
      'will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568',
      'will-gavin-newsom-win-the-2028-democratic-presidential-nomination',
      'will-bitcoin-reach-100000-by-december-31-2026-571',
      'will-bitcoin-reach-100000-by-december-31-2026',
      'bitcoin-100k-december-2026',
    ];

    // Approach 1: Path-based slug (official Gamma API: GET /markets/slug/{slug})
    for (const slug of PREFERRED_SLUGS) {
      try {
        const marketResponse = await fetch(
          `https://gamma-api.polymarket.com/markets/slug/${encodeURIComponent(slug)}`,
          { headers }
        );
        if (marketResponse.ok) {
          const data = await marketResponse.json();
          const single = data && (data.slug || data.question);
          if (single) {
            marketData = data;
            console.log('[Polymarket API] Found via path slug:', marketData.question);
            break;
          }
        }
      } catch (e) {
        console.log('[Polymarket API] Path slug failed for', slug, e.message);
      }
      if (marketData) break;
    }

    // Approach 2: Query-based slug (legacy)
    if (!marketData) {
      for (const slug of PREFERRED_SLUGS) {
        try {
          const marketResponse = await fetch(
            `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`,
            { headers }
          );
          if (marketResponse.ok) {
            const data = await marketResponse.json();
            const markets = Array.isArray(data) ? data : data.markets || data.data || (data && data.slug ? [data] : []);
            if (markets.length > 0) {
              marketData = markets[0];
              console.log('[Polymarket API] Found via query slug:', marketData.question);
              break;
            }
          }
        } catch (e) {
          console.log('[Polymarket API] Query slug failed for', slug, e.message);
        }
        if (marketData) break;
      }
    }

    // Approach 3: Events API with slug
    if (!marketData) {
      for (const slug of PREFERRED_SLUGS) {
        try {
          const slugResponse = await fetch(
            `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`,
            { headers }
          );
          if (slugResponse.ok) {
            const data = await slugResponse.json();
            const events = Array.isArray(data) ? data : [data];
            if (events.length > 0 && events[0].markets && events[0].markets.length > 0) {
              marketData = events[0].markets[0];
              console.log('[Polymarket API] Found via events slug:', marketData.question);
              break;
            }
          }
        } catch (e) {
          console.log('[Polymarket API] Events slug failed:', e.message);
        }
        if (marketData) break;
      }
    }

    // Approach 4: Fallback — fetch active markets and pick highest 24h volume (high volume + volatile)
    if (!marketData) {
      try {
        const allResponse = await fetch(
          'https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200',
          { headers }
        );
        if (allResponse.ok) {
          const markets = await allResponse.json();
          if (Array.isArray(markets) && markets.length > 0) {
            const parseTokenIds = (m) => {
              let ids = m.clobTokenIds || (m.tokens && m.tokens.map(t => t.token_id || t.tokenId));
              if (typeof ids === 'string') {
                try { ids = JSON.parse(ids); } catch (_) { ids = []; }
              }
              return Array.isArray(ids) ? ids : [];
            };
            const withVolume = markets.filter(m => {
              const tokenIds = parseTokenIds(m);
              const vol = m.volume24hrNum ?? m.volumeNum ?? Number(m.volume24hr) ?? Number(m.volume) ?? 0;
              return vol > 0 && tokenIds.length > 0;
            });
            const byVolume = [...withVolume].sort((a, b) => {
              const vA = a.volume24hrNum ?? a.volumeNum ?? Number(a.volume24hr) ?? Number(a.volume) ?? 0;
              const vB = b.volume24hrNum ?? b.volumeNum ?? Number(b.volume24hr) ?? Number(b.volume) ?? 0;
              return vB - vA;
            });
            if (byVolume.length > 0) {
              marketData = byVolume[0];
              console.log('[Polymarket API] Using top by volume:', marketData.question);
            }
          }
        }
      } catch (e) {
        console.log('[Polymarket API] High-volume fallback failed:', e.message);
      }
    }
    
    if (marketData) {
      // Enrich with live best bid/ask from CLOB when we have token IDs
      let clobTokenIds = marketData.clobTokenIds;
      if (typeof clobTokenIds === 'string') {
        try { clobTokenIds = JSON.parse(clobTokenIds); } catch (_) { clobTokenIds = []; }
      }
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
            const toPrice = (level) => typeof level === 'object' && level != null
              ? (level.price != null ? parseFloat(level.price) : (Array.isArray(level) ? parseFloat(level[0]) : NaN))
              : NaN;
            const bidPrices = bids.map(toPrice).filter((p) => !isNaN(p) && p >= 0 && p <= 1);
            const askPrices = asks.map(toPrice).filter((p) => !isNaN(p) && p >= 0 && p <= 1);
            const bestBid = bidPrices.length > 0 ? Math.max(...bidPrices) : null;
            const bestAsk = askPrices.length > 0 ? Math.min(...askPrices) : null;
            if (bestBid != null || bestAsk != null) {
              marketData = { ...marketData, bestBid: bestBid ?? marketData.bestBid, bestAsk: bestAsk ?? marketData.bestAsk };
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
