export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { engine, q, gl, hl } = req.query;
    const apiKey = process.env.VITE_SERP_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error: API Key missing" });
    }

    const serpUrl = `https://serpapi.com/search.json?engine=${engine || 'google_news'}&q=${encodeURIComponent(q)}&gl=${gl || 'kr'}&hl=${hl || 'ko'}&api_key=${apiKey}`;
    
    const response = await fetch(serpUrl);
    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
