const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, required: true }, 
  link: { type: String, required: true },
  orderNo: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("announcement", AnnouncementSchema);
