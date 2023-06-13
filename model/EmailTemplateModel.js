const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["VerifyEmail", "ResetPassword", "OfferSend", "Leave", "applyWFH"],
    unique: true,
    //lowercase: true,
    required: [true, "Type is required"],
  },
  title: {
    type: String,
    required: [true, "Title is required"],
  },
  content: {
    type: String,
    required: [true, "Message Content is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  status: {
    type: Boolean,
    default: false,
  },
});

const Email_Template = mongoose.model("Email_Template", emailTemplateSchema);

module.exports = Email_Template;
