const mongoose = require("mongoose");

const NotificationSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "accounts", // References the user account schema
      default: null, // Allow guest/anonymous subscriptions
    },
    email: {
      type: String,
      default: null, // User's email (if logged in or supplied)
      trim: true,
      lowercase: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceType: {
      type: String,
      default: "web",
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "notificationsubscriptions",
  NotificationSubscriptionSchema,
  "notificationsubscriptions"
);
