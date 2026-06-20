require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const RecommendationService = require('../services/recommendationService');
const { Job } = require('../models');

async function testMockCandidates() {
  await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
  
  // Create Mock Profiles
  const mockCandidates = [
    {
      name: "Ravi (Gen, Fresher, No Special)",
      profile: {
        education: { levels: ["graduation"], streamCodes: ["STR_ARTS"], percentage: 50 },
        gender: "MALE", category: "UR", dob: new Date("2000-01-01"),
        experienceStatus: "FRESHER"
      }
    },
    {
      name: "Priya (OBC, Female, NCC C Certificate)",
      profile: {
        education: { levels: ["graduation"], streamCodes: ["STR_SCI_PHY"], percentage: 65 },
        gender: "FEMALE", category: "OBC", dob: new Date("1998-01-01"),
        nccCertificate: "C", experienceStatus: "FRESHER"
      }
    },
    {
      name: "Amit (Ex-Serviceman, 15 Yrs Service)",
      profile: {
        education: { levels: ["10th", "12th"], streamCodes: ["STR_ANY"], percentage: 45 },
        gender: "MALE", category: "UR", dob: new Date("1980-01-01"), // 46 years old
        isExServiceman: true, yearsOfService: 15, experienceStatus: "EXPERIENCED"
      }
    },
    {
      name: "Suresh (PwD - OH, Experienced)",
      profile: {
        education: { levels: ["graduation"], streamCodes: ["STR_COMMERCE"], percentage: 55 },
        gender: "MALE", category: "SC", dob: new Date("1990-01-01"), // 36 years old
        isPwD: true, pwdCategory: "OH", experienceStatus: "EXPERIENCED"
      }
    }
  ];

  console.log("=== RUNNING HIGH-SPEED ENUM RECOMMENDATION ENGINE ===\n");
  
  const totalJobs = await Job.countDocuments({ status: "active" });
  console.log(`Total Active Jobs in DB: ${totalJobs}\n`);

  for (const candidate of mockCandidates) {
    console.log(`Evaluating Candidate: ${candidate.name}`);
    const results = await RecommendationService.getRecommendedJobs(candidate.profile);
    console.log(`Eligible for ${results.length} jobs.`);
    if (results.length > 0) {
      console.log(`Top 3 Matches:`);
      results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.title} | Score: ${r.relevanceScore}`);
      });
    }
    console.log("-------------------------------------------------");
  }

  process.exit(0);
}

testMockCandidates().catch(console.error);
