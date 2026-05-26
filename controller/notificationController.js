const { NotificationSubscriptionData } = require("../models/webmodel");
const fcmService = require("../services/fcmService");
const jwt = require("jsonwebtoken");

const subscribe = async (req, res) => {
  try {
    const { fcmToken, deviceType = "web" } = req.body;
    
    // Optional authentication - associate with logged-in user if token is present
    let userId = null;
    let token = req.cookies?.token;
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId || null;
      } catch (err) {
        // Fallback to guest if token is expired/invalid
      }
    }

    if (!fcmToken) {
      return res.status(400).json({ error: "fcmToken is required" });
    }

    const subscription = await NotificationSubscriptionData.findOneAndUpdate(
      { fcmToken },
      { userId, deviceType, isActive: true },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: "Subscribed to push notifications successfully", data: subscription });
  } catch (err) {
    res.status(500).json({ error: "Failed to subscribe", details: err.message });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: "fcmToken is required" });
    }

    await NotificationSubscriptionData.deleteOne({ fcmToken });
    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to unsubscribe", details: err.message });
  }
};

// Optional: Admin/Testing route to trigger notification to a token
const testNotification = async (req, res) => {
  try {
    const { fcmToken, title, body } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: "fcmToken is required" });
    }

    const success = await fcmService.sendPushNotification(fcmToken, {
      title: title || "Test Notification 🔔",
      body: body || "Hello, this is a test notification from JobSarthi!",
      clickAction: "http://localhost:3000"
    });

    if (success) {
      return res.status(200).json({ message: "Test notification sent successfully" });
    } else {
      return res.status(500).json({ error: "FCM service failed to send the notification" });
    }
  } catch (err) {
    res.status(500).json({ error: "Test trigger failed", details: err.message });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  testNotification
};
