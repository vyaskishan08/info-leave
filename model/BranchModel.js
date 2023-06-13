const mongoose = require("mongoose");
const validator = require("validator");

const branchschema = new mongoose.Schema({
  user: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "users",
    },
  ],
  attendanceMember: {
    type: Number,
    default: 0,
  },
  branchname: {
    type: String,
  },
  description: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
        type: Date,
        default: Date.now(),
  },
  ipAddress: {
    type: String,
    default: "",
  },
});

const Branch = mongoose.model("branch", branchschema);

module.exports = Branch;
