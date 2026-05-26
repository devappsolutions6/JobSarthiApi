const { GoogleAuth } = require("google-auth-library");

class FCMService {
  constructor() {
    this.projectId = process.env.FCM_PROJECT_ID;
    this.auth = null;
    this.init();
  }

  init() {
    try {
      const clientEmail = process.env.FCM_CLIENT_EMAIL;
      let privateKey = process.env.FCM_PRIVATE_KEY ? process.env.FCM_PRIVATE_KEY.trim() : null;

      // Clean surrounding quotes added by some hosting environments
      if (privateKey) {
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
          privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      if (!this.projectId || !clientEmail || !privateKey) {
        console.warn("⚠️ [FCM] Missing Firebase environment variables. Push notifications will be bypassed.");
        return;
      }

      this.auth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
          project_id: this.projectId
        },
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
      
      console.log(`✅ [FCM] Service initialized from environment for project: ${this.projectId}`);
    } catch (err) {
      console.error("❌ [FCM] Failed to initialize Google Auth credentials:", err.message);
    }
  }

  async getAccessToken() {
    if (!this.auth) throw new Error("FCM Auth not initialized (Check your environment variables)");
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  }

  async sendPushNotification(fcmToken, { title, body, icon, image, clickAction, data = {}, userId = null }) {
    if (!this.auth) {
      console.warn("⚠️ [FCM] Skipping push notification: FCM not initialized.");
      return false;
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
      
      const payload = {
        message: {
          token: fcmToken,
          data: {
            title: title || "",
            body: body || "",
            icon: icon || "/logo.png",
            clickAction: clickAction || "https://www.aspirantcareer.in/",
            ...(image ? { image } : {}),
            ...Object.keys(data).reduce((acc, k) => {
              if (data[k] !== undefined && data[k] !== null) {
                acc[k] = typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]);
              }
              return acc;
            }, {})
          }
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(`FCM API Error: ${JSON.stringify(result)}`);
      }

      console.log(`✉️ [FCM] Successfully sent notification to token ending in ...${fcmToken.slice(-6)}`);

      // Automatically log the notification in the 'notifications' collection
      try {
        const Notification = require("../models/Notification");
        await Notification.create({
          userId,
          fcmToken,
          title,
          body,
          clickAction: clickAction || ""
        });
        console.log("💾 [FCM] Saved notification copy in database history log.");
      } catch (logErr) {
        console.error("⚠️ [FCM] Failed to log push notification to DB:", logErr.message);
      }

      return true;
    } catch (err) {
      console.error("❌ [FCM] Failed to send push notification:", err.message);
      return false;
    }
  }
}

module.exports = new FCMService();
