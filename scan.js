export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  const r = await fetch(`${supaUrl}/rest/v1/trips?join_code=eq.${code}&select=*`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
  });
  const data = await r.json();
  res.json(data);
}
