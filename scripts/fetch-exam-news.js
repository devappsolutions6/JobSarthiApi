/**
 * fetch-exam-news.js
 * Fetches latest Indian govt exam news from Google News RSS
 * and syncs them into the MongoDB `news` collection.
 * Run manually or via a cron job to refresh news.
 *
 * Usage: node scripts/fetch-exam-news.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const https    = require("https");
const mongoose = require("mongoose");
const NewsData = require("../models/News");

// ─── Config ──────────────────────────────────────────────────────────────────
const RSS_URL =
  "https://news.google.com/rss/search?q=government+exams+India+recruitment&hl=en-IN&gl=IN&ceid=IN:en";

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const DBURL = process.env.DBURL;
  if (!DBURL) {
    console.error("❌  DBURL env variable is not set. Aborting.");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(DBURL);
  console.log("✅  Connected to MongoDB.\n");

  console.log("🌐  Fetching latest government exam news from Google News RSS...");
  const rawXml = await fetchUrl(RSS_URL);

  const items = parseRSS(rawXml);
  console.log(`📰  Parsed ${items.length} news items.\n`);

  // ── Wipe old news & insert fresh batch ─────────────────────────────────────
  console.log("🗑   Clearing old news collection...");
  await NewsData.deleteMany({});

  const docs = items.map((item) => ({
    title:   item.title,
    source:  item.source,
    pubDate: item.pubDate ? new Date(item.pubDate) : null,
    link:    item.link,
  }));

  await NewsData.insertMany(docs);
  console.log(`✅  Inserted ${docs.length} fresh news articles into MongoDB.\n`);

  // ── Print summary ───────────────────────────────────────────────────────────
  items.slice(0, 10).forEach((item, i) => {
    console.log(`\x1b[36m[${i + 1}] ${item.title}\x1b[0m`);
    console.log(`    Source : \x1b[33m${item.source}\x1b[0m`);
    console.log(`    Date   : ${item.pubDate}`);
    console.log("-".repeat(80));
  });
  if (items.length > 10) console.log(`    … and ${items.length - 10} more.`);

  await mongoose.disconnect();
  console.log("\n🏁  Done. MongoDB connection closed.");
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// ─── RSS parser ───────────────────────────────────────────────────────────────
function parseRSS(xmlString) {
  const items      = [];
  const itemRegex  = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const block  = match[1];
    const title  = extractTag(block, "title");
    const link   = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source");

    let cleanTitle = title;
    if (source && title.endsWith(` - ${source}`)) {
      cleanTitle = title.slice(0, title.length - source.length - 3);
    }

    items.push({
      title:   cleanTitle,
      source:  source || "Google News",
      pubDate: pubDate || null,
      link,
    });
  }

  return items;
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

// ─── Run ──────────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
