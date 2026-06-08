const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const dbUrl = 'mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority';
const { EDUCATION_RANKS: educationRank } = require("./utils/educationHelper");

mongoose.connect(dbUrl).then(async () => {
  const db = mongoose.connection.db;

  const users = await db.collection('accounts').find({ email: 'imvksb@gmail.com' }).toArray();
  const activeJobs = await db.collection('jobschemas').find({ isActive: true }).toArray();

  const user = users[0];
  console.log(`DIAGNOSING FILTER DETAILS FOR ${user.firstName}`);

  const preferredLocations = user.preferredLocations || ["all india"];
  const wantsAllIndia = preferredLocations.length === 0 || preferredLocations.includes("all india") || preferredLocations.includes("All India");
  const stateLocations = preferredLocations.filter(l => l.toLowerCase() !== "all india");
  const userMaxEduRank = (user.education?.levels || []).reduce((max, lvl) => Math.max(max, educationRank[lvl] || 0), 0);
  const educationStreams = user.education?.stream || [];
  const organizationTypes = user.organizationTypes || [];
  const selectionPreference = (user.selectionPreference || "any").toLowerCase();

  for (const job of activeJobs) {
    const jobLocation = String(job.location || "all india").toLowerCase();
    
    // Education Check
    let isEduEligible = false;
    if (job.eligibility?.posts && job.eligibility.posts.length > 0) {
      for (const post of job.eligibility.posts) {
        if (post.education && post.education.length > 0) {
          for (const edu of post.education) {
            const requiredRank = educationRank[edu.levelCode] || 0;
            if (requiredRank > 0 && userMaxEduRank >= requiredRank) {
              if (edu.stream && edu.stream.trim().toLowerCase() !== "any" && educationStreams.length > 0) {
                const reqStream = edu.stream.toLowerCase();
                const streamMatch = educationStreams.some(s => 
                  reqStream.includes(s.toLowerCase()) || s.toLowerCase().includes(reqStream)
                );
                if (streamMatch) {
                  isEduEligible = true;
                  break;
                }
              } else {
                isEduEligible = true;
                break;
              }
            }
          }
        } else {
          isEduEligible = true;
        }
        if (isEduEligible) break;
      }
    } else {
      isEduEligible = true;
    }

    // Location Check
    let isLocEligible = false;
    if (wantsAllIndia || jobLocation === "all india") {
      isLocEligible = true;
    } else {
      isLocEligible = stateLocations.some(prefLoc => jobLocation.includes(prefLoc.toLowerCase()));
    }

    // Org Check
    let isOrgEligible = true;
    const jobTokens = job.searchTokens || [
      ...(job.jobDomains || []),
      ...(job.tags || []),
      ...(job.searchKeywords || [])
    ].map(t => t.toLowerCase());
    if (organizationTypes.length > 0) {
      isOrgEligible = organizationTypes.some(prefOrg =>
        jobTokens.some(jobToken => jobToken.includes(prefOrg.toLowerCase()))
      );
    }

    // Selection Check
    const stages = (job.selectionProcess || []).map(s => (s.stage || "").toLowerCase());
    let isSelEligible = true;
    if (selectionPreference === "written") {
      const hasPhysical = stages.some(s => /pet|physical|medical/i.test(s));
      const hasInterview = stages.some(s => /interview/i.test(s));
      if (hasPhysical || hasInterview) isSelEligible = false;
    }

    const passed = isEduEligible && isLocEligible && isOrgEligible && isSelEligible;

    if (passed) {
      console.log(`PASSED: "${job.title}"`);
      console.log(`  Location: ${job.location}`);
      console.log(`  Domains:`, JSON.stringify(job.jobDomains));
      console.log(`  Education:`, JSON.stringify(job.eligibility?.posts?.map(p => p.education)));
      console.log("-----------------------------------------");
    }
  }

  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
