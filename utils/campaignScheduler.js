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

    for (const campaign of pendingCampaigns) {
      console.log(`🚀 [CampaignScheduler] Evaluating Campaign "${campaign.title}"...`);

      const isTargeted = 
        (campaign.targetLocations && campaign.targetLocations.length > 0) ||
        (campaign.targetStreams && campaign.targetStreams.length > 0) ||
        (campaign.targetEduLevels && campaign.targetEduLevels.length > 0) ||
        (campaign.targetKeywords && campaign.targetKeywords.length > 0);

      let activeSubscribers = [];

      if (!isTargeted) {
        // Global Broadcast: Send to all active subscribers
        activeSubscribers = await NotificationSubscription.find({ isActive: true }).lean();
        console.log(`📢 [CampaignScheduler] Global Broadcast mode: Found ${activeSubscribers.length} total active subscribers.`);
      } else {
        // Targeted Broadcast: Only send to subscribers whose UserPreferences match the tags
        const matchConditions = [];

        // Note: For targeted broadcasts, we inherently require a logged-in user with a preference profile.
        // Unauthenticated guests do not receive targeted notifications in this design.
        
        if (campaign.targetLocations && campaign.targetLocations.length > 0) {
          matchConditions.push({ "preferences.preferredLocations": { $in: campaign.targetLocations.map(t => t.toLowerCase()) } });
        }
        if (campaign.targetStreams && campaign.targetStreams.length > 0) {
          matchConditions.push({ "preferences.education.stream": { $in: campaign.targetStreams.map(t => t.toLowerCase()) } });
        }
        if (campaign.targetEduLevels && campaign.targetEduLevels.length > 0) {
          matchConditions.push({ "preferences.education.levels": { $in: campaign.targetEduLevels } });
        }
        if (campaign.targetKeywords && campaign.targetKeywords.length > 0) {
          const lowerKeywords = campaign.targetKeywords.map(k => k.toLowerCase());
          matchConditions.push({
            $or: [
              { "preferences.interests": { $in: lowerKeywords } },
              { "preferences.organizationTypes": { $in: lowerKeywords } }
            ]
          });
        }

        // We use Aggregation to join the subscriptions with user preferences
        const pipeline = [
          { $match: { isActive: true, userId: { $ne: null } } },
          {
            $lookup: {
              from: "userpreferences",
              localField: "userId",
              foreignField: "userId",
              as: "preferences"
            }
          },
          { $unwind: { path: "$preferences", preserveNullAndEmptyArrays: false } }, // Ensure they have a profile
          { $match: { $and: matchConditions } } // Apply targeting filters (AND logic between different target arrays)
        ];

        activeSubscribers = await NotificationSubscription.aggregate(pipeline);
        console.log(`🎯 [CampaignScheduler] Targeted Broadcast mode: Found ${activeSubscribers.length} matching subscribers out of all active tokens.`);
      }

      if (activeSubscribers.length === 0) {
        console.log(`ℹ️ [CampaignScheduler] No subscribers found/matched for "${campaign.title}". Skipping broadcast.`);
        await NotificationCampaign.updateOne(
          { _id: campaign._id },
          { $set: { status: "sent", isSent: true, sentAt: new Date(), recipientsCount: 0 } }
        );
        continue;
      }

      console.log(`🚀 [CampaignScheduler] Broadcasting "${campaign.title}" to ${activeSubscribers.length} devices...`);

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
