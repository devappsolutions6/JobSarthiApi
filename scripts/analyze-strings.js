require('dotenv').config();
const mongoose = require('mongoose');
const Database = require('../config/db');
const { Job } = require('../models');

async function analyzeCollections() {
  await Database();
  
  const domains = await Job.distinct("jobDomains");
  const locations = await Job.distinct("location");
  const conductingBodies = await Job.distinct("conductingBody");
  const streams = await Job.distinct("eligibility.education.stream");
  const specializations = await Job.distinct("eligibility.education.specialization");

  console.log("--- DISTINCT VALUES ---");
  console.log(`Job Domains (${domains.length}):`, domains.slice(0, 20).join(", "));
  console.log(`Locations (${locations.length}):`, locations.slice(0, 20).join(", "));
  console.log(`Conducting Bodies (${conductingBodies.length}):`, conductingBodies.slice(0, 20).join(", "));
  console.log(`Streams (${streams.length}):`, streams.slice(0, 20).join(", "));
  console.log(`Specializations (${specializations.length}):`, specializations.slice(0, 20).join(", "));
  
  process.exit(0);
}

analyzeCollections().catch(console.error);
