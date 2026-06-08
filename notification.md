# Targeted Notifications Broadcasting System

We have successfully overhauled the backend Firebase Cloud Messaging (FCM) broadcast system. The API now fully supports sending push notifications tailored strictly to the user's Personalized Profile interests.

## How it Works

The `NotificationCampaign` schema has been upgraded with four new Targeting Array fields:
- `targetLocations`: e.g. `["odisha", "delhi"]`
- `targetStreams`: e.g. `["science", "engineering"]`
- `targetEduLevels`: e.g. `["EDU_GRAD", "EDU_POSTGRAD"]`
- `targetKeywords`: e.g. `["police", "clerk", "psu"]`

### Global Broadcast Mode
If an Admin creates a campaign and leaves **all four target arrays empty** (`[]`), the `campaignScheduler` treats this as a Global Broadcast. 
- It will query `NotificationSubscription.find({ isActive: true })`
- **Every active user**, including anonymous guest users, will receive the notification.

### Targeted Broadcast Mode
If an Admin adds **any value** to **any** of the target arrays, the `campaignScheduler` automatically switches to Targeted Mode.
1. It uses a high-performance MongoDB `$lookup` Aggregation Pipeline to join `notificationsubscriptions` with `userpreferences`.
2. It completely filters out unauthenticated Guest users (since they don't have a profile to match against).
3. It uses `$match` conditions to mathematically intersect the Campaign's targets with the User's profile values (`preferredLocations`, `education.stream`, `education.levels`, `interests`, `organizationTypes`).
4. **The notification is ONLY dispatched to users who mathematically match ALL provided target criteria.**

## Files Updated
- **`models/NotificationCampaign.js`**: Schema upgraded to hold targeting definitions.
- **`utils/campaignScheduler.js`**: Re-written using MongoDB Aggregation to perform live, on-the-fly cross-collection preference matching before broadcasting to FCM.

With these changes, the backend is now 100% capable of sending laser-focused notifications based on a user's exact job setup!
