export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const apiKey = process.env.VITE_GOLF_API_KEY;
  const r = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Key ${apiKey}` }
  });
  const data = await r.json();
  res.json(data);
}
