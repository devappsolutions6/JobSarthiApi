const { JobsSchemaDatas } = require("../models/webmodel");

const parseDate = (d) => {
  if (!d) return null;
  const parsed = new Date(d.date || d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const getDiffDays = (targetDate, today) => {
  const targetMidnight = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
  const todayMidnight = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Math.round((targetMidnight - todayMidnight) / (24 * 60 * 60 * 1000));
};

const getRecruitmentPulse = async (req, res) => {
  try {
    const activeJobs = await JobsSchemaDatas.find({ status: "active", isActive: true }).lean();
    const today = new Date();
    const bulletins = [];

    for (const job of activeJobs) {
      const applyStart = parseDate(job.importantDates?.applyStart);
      const applyEnd = parseDate(job.importantDates?.applyEnd);
      const examDate = parseDate(job.importantDates?.examDate);
      const admitCardDate = parseDate(job.importantDates?.admitCardDate);
      const resultDate = parseDate(job.importantDates?.resultDate);

      const body = job.conductingBody || "Govt Job";
      const title = job.title;
      const linkId = job._id;
      const urlTitle = job.urlTitle || "job";

      // 1. Application Start Milestones
      if (applyStart) {
        const diff = getDiffDays(applyStart, today);
        if (diff === 0) {
          bulletins.push({
            type: "apply_start",
            message: `📢 ${body}: Online applications have started today for ${title}!`,
            jobId: linkId,
            urlTitle,
            urgency: 4
          });
        } else if (diff > 0 && diff <= 3) {
          bulletins.push({
            type: "apply_soon",
            message: `⏳ Coming Soon: Online registration for ${body} ${title} starts in ${diff} days.`,
            jobId: linkId,
            urlTitle,
            urgency: 2
          });
        } else if (diff < 0 && diff >= -3) {
          bulletins.push({
            type: "apply_active",
            message: `📢 Applications Open: Apply online now for ${body} ${title}.`,
            jobId: linkId,
            urlTitle,
            urgency: 1
          });
        }
      }

      // 2. Closing Milestones
      if (applyEnd) {
        const diff = getDiffDays(applyEnd, today);
        if (diff === 0) {
          bulletins.push({
            type: "apply_end_today",
            message: `🚨 Last Day! Registration for ${body} ${title} closes today. Apply immediately!`,
            jobId: linkId,
            urlTitle,
            urgency: 5
          });
        } else if (diff > 0 && diff <= 3) {
          bulletins.push({
            type: "apply_end_soon",
            message: `⏳ Closing Soon: Only ${diff} days left to apply for ${body} ${title}.`,
            jobId: linkId,
            urlTitle,
            urgency: 4
          });
        }
      }

      // 3. Admit Card Milestones
      if (admitCardDate) {
        const diff = getDiffDays(admitCardDate, today);
        if (diff === 0) {
          bulletins.push({
            type: "admit_card_out",
            message: `🎟️ Admit Card Out: Download admit cards now for ${body} ${title}.`,
            jobId: linkId,
            urlTitle,
            urgency: 4
          });
        } else if (diff < 0 && diff >= -3) {
          bulletins.push({
            type: "admit_card_active",
            message: `🎟️ Admit Cards: Download link is active for ${body} ${title}.`,
            jobId: linkId,
            urlTitle,
            urgency: 2
          });
        }
      }

      // 4. Exam Date Milestones
      if (examDate) {
        const diff = getDiffDays(examDate, today);
        if (diff === 0) {
          bulletins.push({
            type: "exam_today",
            message: `📝 Exam Alert: Exam for ${body} ${title} is scheduled for today. Best of luck!`,
            jobId: linkId,
            urlTitle,
            urgency: 3
          });
        } else if (diff === 1) {
          bulletins.push({
            type: "exam_tomorrow",
            message: `📝 Exam Alert: Exam for ${body} ${title} is scheduled for tomorrow. Prepare well!`,
            jobId: linkId,
            urlTitle,
            urgency: 3
          });
        }
      }

      // 5. Result Milestones
      if (resultDate) {
        const diff = getDiffDays(resultDate, today);
        if (diff === 0) {
          bulletins.push({
            type: "result_out",
            message: `🏆 Results Announced: Check your scorecard for ${body} ${title} now!`,
            jobId: linkId,
            urlTitle,
            urgency: 5
          });
        } else if (diff < 0 && diff >= -3) {
          bulletins.push({
            type: "result_recent",
            message: `🏆 Results: Scorecards are available for ${body} ${title}.`,
            jobId: linkId,
            urlTitle,
            urgency: 2
          });
        }
      }
    }

    // Fallback alerts: if we have few bulletins, populate with ongoing active listings
    if (bulletins.length < 5) {
      const fallbackJobs = await JobsSchemaDatas.find({
        status: "active",
        isActive: true,
        $or: [
          { "importantDates.applyEnd.date": { $gte: today } },
          { "importantDates.applyEnd.date": null }
        ]
      })
      .sort({ "importantDates.applyEnd.date": 1, createdAt: -1 })
      .limit(8)
      .lean();

      for (const job of fallbackJobs) {
        const body = job.conductingBody || "Govt Job";
        const title = job.title;
        const linkId = job._id;
        const urlTitle = job.urlTitle || "job";
        const applyEnd = parseDate(job.importantDates?.applyEnd);

        const formattedEnd = applyEnd ? applyEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
        const endStr = formattedEnd ? ` before ${formattedEnd}` : "";

        if (!bulletins.some(b => b.jobId.toString() === linkId.toString())) {
          bulletins.push({
            type: "active_alert",
            message: `📢 Ongoing Recruitment: Applications are open for ${body} ${title}. Apply${endStr}!`,
            jobId: linkId,
            urlTitle,
            urgency: 1
          });
        }
      }
    }

    // Sort by urgency descending, then by type
    bulletins.sort((a, b) => b.urgency - a.urgency);

    return res.status(200).json({ status: "success", count: bulletins.length, data: bulletins.slice(0, 15) });
  } catch (error) {
    console.error("Recruitment Pulse error:", error);
    return res.status(500).json({ error: "Failed to generate recruitment pulse", details: error.message });
  }
};

module.exports = {
  getRecruitmentPulse
};
