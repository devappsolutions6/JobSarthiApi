const { NotificationCampaign, NotificationSubscription } = require("../models");
const fcmService = require("../services/fcmService");

const POLL_INTERVAL_MS = 30 * 1000; // Poll every 30 seconds for pending campaigns

async function processPendingCampaigns() {
  try {
    // Find all campaigns that are marked ready to send and have not been sent yet
    const pendingCampaigns = await NotificationCampaign.find({
      status: "ready",
      isSent: false
    });

    if (pendingCampaigns.length === 0) {
      return;
    }

    console.log(`📢 [CampaignScheduler] Found ${pendingCampaigns.length} pending broadcast campaigns to execute.`);

    // Fetch all active subscribers from database
    const activeSubscribers = await NotificationSubscription.find({ isActive: true }).lean();
    if (activeSubscribers.length === 0) {
      console.log("ℹ️ [CampaignScheduler] No active subscribers found. Skipping broadcast.");
      
      // Update campaign as processed with 0 recipients
      for (const campaign of pendingCampaigns) {
        await NotificationCampaign.updateOne(
          { _id: campaign._id },
          { $set: { status: "sent", isSent: true, sentAt: new Date(), recipientsCount: 0 } }
        );
      }
      return;
    }

    for (const campaign of pendingCampaigns) {
      console.log(`🚀 [CampaignScheduler] Broadcasting Campaign "${campaign.title}" to ${activeSubscribers.length} devices...`);

      let successCount = 0;
      const { getCampaignCategoryImage } = require("./categoryImages");
      const campaignImage = campaign.image || getCampaignCategoryImage(campaign.title, campaign.body);

      for (const sub of activeSubscribers) {
        try {
          const success = await fcmService.sendPushNotification(sub.fcmToken, {
            title: campaign.title,
            body: campaign.body,
            image: campaignImage,
            clickAction: campaign.clickAction || "http://localhost:3000",
            userId: sub.userId
          });
          if (success) successCount++;
        } catch (dispatchErr) {
          console.error(`⚠️ [CampaignScheduler] Failed to dispatch to token ending in ...${sub.fcmToken.slice(-6)}:`, dispatchErr.message);
        }
      }

      // Mark campaign as successfully sent
      await NotificationCampaign.updateOne(
        { _id: campaign._id },
        { 
          $set: { 
            status: "sent", 
            isSent: true, 
            sentAt: new Date(), 
            recipientsCount: successCount 
          } 
        }
      );

      console.log(`🎉 [CampaignScheduler] Broadcast complete for "${campaign.title}". Successfully delivered to ${successCount}/${activeSubscribers.length} subscribers.`);
    }

  } catch (err) {
    console.error("❌ [CampaignScheduler] Error polling broadcast campaigns:", err.message);
  }
}

function startCampaignScheduler() {
  console.log("⚡ [CampaignScheduler] Initializing Admin Broadcast Campaign Scheduler (30s poll)...");
  
  // Run polling routine periodically
  setInterval(async () => {
    await processPendingCampaigns();
  }, POLL_INTERVAL_MS);
}

module.exports = {
  processPendingCampaigns,
  startCampaignScheduler
};
