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
    
    // Approach 1: Try direct slug search (most reliable)
    try {
      const slugResponse = await fetch(
        'https://gamma-api.polymarket.com/events?slug=will-jesus-christ-return-before-2027',
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
          console.log('[Polymarket API] Found via slug:', marketData.question);
        }
      }
    } catch (e) {
      console.log('[Polymarket API] Slug search failed:', e.message);
    }
    
    // Approach 2: Try market slug directly
    if (!marketData) {
      try {
        const marketResponse = await fetch(
          'https://gamma-api.polymarket.com/markets?slug=will-jesus-christ-return-before-2027',
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          }
        );
        
        if (marketResponse.ok) {
          const data = await marketResponse.json();
          const markets = Array.isArray(data) ? data : [data];
          if (markets.length > 0) {
            marketData = markets[0];
            console.log('[Polymarket API] Found via market slug:', marketData.question);
          }
        }
      } catch (e) {
        console.log('[Polymarket API] Market slug search failed:', e.message);
      }
    }
    
    // Approach 3: Search all markets for the specific 2027 market
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
              const q = (m.question || '').toLowerCase();
              const s = (m.slug || '').toLowerCase();
              return (q.includes('jesus') && q.includes('christ') && q.includes('2027')) ||
                     s.includes('jesus-christ-return-before-2027');
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
