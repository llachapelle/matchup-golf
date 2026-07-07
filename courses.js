// Vercel serverless function — proxies course search to golfcourseapi.com.
// API key stored as GOLF_COURSE_API_KEY environment variable in Vercel.

export default async function handler(req, res) {
  // Allow CORS from the app
  res.setHeader("Access-Control-Allow-Origin", "*");

  if(req.method !== "GET"){
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if(!apiKey){
    return res.status(500).json({
      error: "Golf course API key not configured",
      hint: "Add GOLF_COURSE_API_KEY to Vercel environment variables, then redeploy."
    });
  }

  const { q, id } = req.query;

  // golfcourseapi.com endpoints:
  //   Search: GET /v1/search?search_query=giants+ridge
  //   Detail: GET /v1/courses/:id
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
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json",
      }
    });

    const text = await response.text();

    // Try to parse as JSON; if it fails, return raw text so we can debug
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(response.status).json({
        error: `API returned non-JSON (status ${response.status})`,
        raw: text.slice(0, 500),
      });
    }

    return res.status(response.status).json(data);
  } catch(e) {
    return res.status(500).json({
      error: e.message || "Course lookup failed",
      url: url, // include the URL we tried so we can debug
    });
  }
}
