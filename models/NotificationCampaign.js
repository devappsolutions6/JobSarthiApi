const mongoose = require("mongoose");

const NotificationCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "", // optional banner image
    },
    clickAction: {
      type: String,
      default: "http://localhost:3000",
    },
    // --- TARGETING FIELDS ---
    // If these arrays are empty, the campaign is a global broadcast.
    // If populated, the campaign only goes to users whose preferences match.
    targetLocations: {
      type: [String],
      default: [],
    },
    targetStreams: {
      type: [String],
      default: [],
    },
    targetEduLevels: {
      type: [String],
      default: [],
    },
    targetKeywords: {
      type: [String],
      default: [],
    },
    // ------------------------
    status: {
      type: String,
      enum: ["draft", "ready", "sent"],
      default: "draft", // Admin sets this to "ready" to trigger dispatch
    },
    isSent: {
      type: Boolean,
      default: false, // Flag that flips to true once broadcast is complete
    },
    sentAt: {
      type: Date,
      default: null,
    },
    recipientsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "notificationcampaigns",
  NotificationCampaignSchema,
  "notificationcampaigns"
);
