/**
 * Utility helper to dynamically map job domains/categories to high-quality,
 * live, and highly-relevant sector-specific landscape images for push alerts.
 */
function getJobNotificationImage(job) {
  if (!job) return "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&h=600&q=80";

  // Consolidate all identifiers and tags to lowercase for robust keyword matching
  const jobTokens = [
    ...(job.jobDomains || []),
    ...(job.tags || []),
    job.conductingBody,
    job.title,
    job.shortDescription,
    job.category
  ].filter(Boolean).map(t => t.toLowerCase());

  // 1. Railways (RRB, NTPC, Train, Railway)
  if (jobTokens.some(t => t.includes("railway") || t.includes("rrb") || t.includes("ntpc") || t.includes("train") || t.includes("loco"))) {
    return "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 2. Banking / Finance / Insurance (SBI, IBPS, RBI, Bank, Insurance)
  if (jobTokens.some(t => t.includes("bank") || t.includes("ibps") || t.includes("sbi") || t.includes("rbi") || t.includes("lic") || t.includes("insurance") || t.includes("finance"))) {
    return "https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 3. Police / Defence / Army / Forces (Police, BSF, CRPF, Navy, Army, Force)
  if (jobTokens.some(t => t.includes("police") || t.includes("defence") || t.includes("army") || t.includes("navy") || t.includes("force") || t.includes("bsf") || t.includes("crpf") || t.includes("cops") || t.includes("soldier"))) {
    return "https://images.unsplash.com/photo-1508847154043-be12a62861c1?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 4. Medical / Nursing / Health / Hospital (Doctor, Nurse, Hospital, Pharmacy)
  if (jobTokens.some(t => t.includes("medical") || t.includes("doctor") || t.includes("nurse") || t.includes("health") || t.includes("pharmacy") || t.includes("hospital") || t.includes("pharmacist"))) {
    return "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 5. Engineering / Technical / IT / Scientific (Software, Engineer, IT, Science)
  if (jobTokens.some(t => t.includes("engineering") || t.includes("technical") || t.includes("it") || t.includes("software") || t.includes("engineer") || t.includes("scientific") || t.includes("scientist") || t.includes("tech"))) {
    return "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 6. Teaching / Professor / Education (School, College, Teacher, Lecturer)
  if (jobTokens.some(t => t.includes("teaching") || t.includes("teacher") || t.includes("professor") || t.includes("school") || t.includes("college") || t.includes("lecturer") || t.includes("faculty"))) {
    return "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // 7. Civil Services / UPSC / SSC / Public Service Commission (IAS, PSC, Admin)
  if (jobTokens.some(t => t.includes("upsc") || t.includes("ssc") || t.includes("ias") || t.includes("civil") || t.includes("psc") || t.includes("admin") || t.includes("public service"))) {
    return "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&h=600&q=80";
  }

  // Default beautiful resume / career workspace desk image
  return "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&h=600&q=80";
}

/**
 * Maps a generic campaign text (title & body) to a category image for admins
 */
function getCampaignCategoryImage(title, body) {
  const text = `${title || ""} ${body || ""}`.toLowerCase();
  
  // Reuse the keyword matching engine using a mock job object
  return getJobNotificationImage({
    title: text,
    jobDomains: [],
    tags: []
  });
}

module.exports = {
  getJobNotificationImage,
  getCampaignCategoryImage
};
