// Vercel serverless function — proxies course search to golfcourseapi.com.
// Uses CommonJS exports for maximum Vercel compatibility.

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if(req.method !== "GET"){
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if(!apiKey){
    return res.status(500).json({
      error: "Golf course API key not configured",
      hint: "Add GOLF_COURSE_API_KEY to Vercel environment variables."
    });
  }

  const { q, id } = req.query;
  let url;

  if(id){
    url = `https://api.golfcourseapi.com/v1/courses/${encodeURIComponent(id)}`;
  } else if(q){
    url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`;
  } else {
    return res.status(400).json({ error: "Provide ?q=search+term or ?id=courseId" });
  }

  try {
    const response = await fetch(url, {
      headers: { "Authorization": `Key ${apiKey}` }
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e){
      return res.status(response.status).json({
        error: `API returned non-JSON (${response.status})`,
        raw: text.slice(0, 300)
      });
    }
    return res.status(response.status).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message || "Course lookup failed" });
  }
}
