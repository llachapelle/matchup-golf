export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/trips?join_code=eq.${code}&select=*`, {
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` }
  });
  res.json(await r.json());
}
