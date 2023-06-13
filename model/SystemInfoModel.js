const mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");

const systeminfoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
    },

    description: {
      type: Object,
      required:true
    },
    branch_id: {
      type: mongoose.Schema.ObjectId,
      ref: "branch",
      default: null,
    },
    isVerify:{
      type:Boolean,
      default:false
    }
  },
  {
    timestamps:true,
  }
);

const SystemInfo = mongoose.model("systeminfos", systeminfoSchema);

module.exports = SystemInfo;
