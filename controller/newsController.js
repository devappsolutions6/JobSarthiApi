const https    = require("https");
const { NewsData } = require("../models/webmodel");

// ─── RSS helpers ──────────────────────────────────────────────────────────────
const RSS_URL =
  "https://news.google.com/rss/search?q=government+exams+India+recruitment&hl=en-IN&gl=IN&ceid=IN:en";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function extractTag(xml, tag) {
  const re    = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  if (!match) return "";
  return match[1]
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function parseRSS(xmlString) {
  const items     = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const block   = match[1];
    const title   = extractTag(block, "title");
    const link    = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source  = extractTag(block, "source");
    let cleanTitle = title;
    if (source && title.endsWith(` - ${source}`)) {
      cleanTitle = title.slice(0, title.length - source.length - 3);
    }
    items.push({ title: cleanTitle, source: source || "Google News", pubDate: pubDate || null, link });
  }
  return items;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /web/api/news
 * Returns the latest news articles stored in the `news` collection.
 */
const getLatestNews = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const news  = await NewsData.find({})
      .sort({ pubDate: -1 })
      .limit(limit)
      .select("title source pubDate link")
      .lean();

    return res.status(200).json({ status: "success", count: news.length, data: news });
  } catch (err) {
    console.error("[newsController] getLatestNews error:", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch news." });
  }
};

/**
 * POST /web/api/admin/news/sync
 * Fetches fresh news from Google News RSS and replaces the entire collection.
 * Should be called manually to refresh the news feed.
 */
const syncNews = async (req, res) => {
  try {
    console.log("[newsController] Starting news sync from Google RSS...");
    const rawXml = await fetchUrl(RSS_URL);
    const items  = parseRSS(rawXml);

    if (!items.length) {
      return res.status(502).json({ status: "error", message: "No news items parsed from feed." });
    }

    await NewsData.deleteMany({});

    const docs = items.map((item) => ({
      title:   item.title,
      source:  item.source,
      pubDate: item.pubDate ? new Date(item.pubDate) : null,
      link:    item.link,
    }));

    await NewsData.insertMany(docs);
    console.log(`[newsController] Synced ${docs.length} news articles to MongoDB.`);

    return res.status(200).json({
      status:  "success",
      message: `Synced ${docs.length} news articles.`,
      count:   docs.length,
    });
  } catch (err) {
    console.error("[newsController] syncNews error:", err);
    return res.status(500).json({ status: "error", message: "News sync failed.", detail: err.message });
  }
};

module.exports = { getLatestNews, syncNews };
