// Vercel Serverless Function to fetch Polymarket price history
// This runs server-side, bypassing CORS issues

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle both 'market' and 'tokenId' query params for compatibility
  const { market, tokenId, interval = '1d', fidelity = '60' } = req.query;
  const token = market || tokenId;

  if (!token) {
    return res.status(400).json({ success: false, error: 'market or tokenId is required' });
  }

  try {
    console.log('[Polymarket History] Fetching price history for token:', token);
    
    const response = await fetch(
      `https://clob.polymarket.com/prices-history?market=${token}&interval=${interval}&fidelity=${fidelity}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.log('[Polymarket History] API returned:', response.status);
      return res.status(response.status).json({ success: false, error: 'Failed to fetch history' });
    }
    
    const data = await response.json();
    const history = data.history || data || [];
    console.log('[Polymarket History] Got', history.length, 'data points');
    
    return res.status(200).json({
      success: true,
      history: history,
    });
  } catch (error) {
    console.error('[Polymarket History] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
