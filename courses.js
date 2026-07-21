export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const r = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Key ${process.env.VITE_GOLF_API_KEY}` }
  });
  res.json(await r.json());
}
