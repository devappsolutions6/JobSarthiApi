const mongoose = require("mongoose");

const NotificationSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null, // Allow guest/anonymous subscriptions
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
