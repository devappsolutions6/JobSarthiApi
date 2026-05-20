// Backwards-compatibility wrapper for legacy imports
// All active controllers currently require "../models/webmodel"

const AnnouncementData = require("./Announcement");
const JobsSchemaDatas = require("./Job");
const AdmitCardData = require("./AdmitCard");
const ResultCardData = require("./ResultCard");
const UserSignupSchemaDatas = require("./User");
const UserprefrenceData = require("./UserPreference");
const ExamCalendarData = require("./ExamCalendar");
const SavedJobData = require("./SavedJob");
const UserRecommendationData = require("./UserRecommendation");

module.exports = {
  AnnouncementData,
  JobsSchemaDatas,
  AdmitCardData,
  ResultCardData,
  UserSignupSchemaDatas,
  UserprefrenceData,
  ExamCalendarData,
  SavedJobData,
  UserRecommendationData,
};
