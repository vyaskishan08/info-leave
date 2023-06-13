const mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");
const User = require("./UserModel");
var dateFormat = require("dateformat");
const moment = require("moment");
const WfhEmail = require("../utils/WfhEmail");
const Constant = require("../utils/constant");

const workHomeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },
  myWfh: [
    {
      Subject: {
        type: String,
        enum: ["Full Day", "Half Day"],
        required: true,
      },
      Purpose: {
        type: String,
        required: true,
      },
      FromDate: {
        type: Date,
        required: true,
      },
      ToDate: {
        type: Date,
        required: true,
      },
      Status: {
        type: String,
        enum: ["Approved", "Rejected", "Pending", "Canceled"],
        default: "Pending",
      },
      createdAt: {
        type: Date,
        default: Date.now(),
      },
      adminEmail: {
        type: Array,
        required: true,
      },
      reasonToCancel: {
        type: String,
        default: ''
      },
    },
  ],
});

const WorkHome = mongoose.model("WorkHome", workHomeSchema);

module.exports = WorkHome;

module.exports.wfhApproved = async function () {
  return new Promise(async (resolve, reject) => {
    let wfhId = [];

    var pastDate = new Date(); // Get current Date
    pastDate.setDate(pastDate.getDate() - 5);

    let findWfh = await WorkHome.aggregate([
      { $unwind: "$myWfh" },
      {
        $match: {
          "myWfh.Status": "Pending",
          "myWfh.createdAt": { $lt: pastDate },
        },
      },
      {
        $project: {
          myWfh: 1,
          "user":1,
        },
      },
    ]);

    for(let element of findWfh) {
      const date1 = new Date(element.myWfh.FromDate);
      const date2 = new Date(element.myWfh.ToDate);
      const days = await Constant.getBusinessDatesCount(date1,date2);
      wfhId.push(element.myWfh._id);
      await WorkHome.updateOne(
        { "myWfh._id": element.myWfh._id },
        { $set: { "myWfh.$.Status": "Approved" } }
      );
      let userFind = await User.findOne({ _id: element.user});
      if (element.myWfh.Subject === "Half Day") {
        let user = await User.findOneAndUpdate(
          { _id: element.user},
          {
            used_wfh: (userFind.used_wfh + (days/2)),
            alloted_wfh: (userFind.alloted_wfh - (days/2)),
          }
        );
      } else {
        let user = await User.findOneAndUpdate(
          { _id: element.user},
          {
            used_wfh: userFind.used_wfh + days,
            alloted_wfh: userFind.alloted_wfh - days,
          }
        );
      }

      //---- Send Email -----//
      let myUser = { name: userFind.name, email: userFind.email };
      let obj = {
        Subject: element.myWfh.Subject,
        Purpose: element.myWfh.Purpose,
        Status: "Approved",
        FromDate: dateFormat(element.myWfh.FromDate, "dd-mm-yyyy"),
        ToDate: dateFormat(element.myWfh.ToDate, "dd-mm-yyyy"),
        createdAt: dateFormat(element.myWfh.createdAt, "dd-mm-yyyy"),
      };
      await new WfhEmail(myUser, obj, "updateWfhByAdmin").sendApproveWFH(
        "wfhApproved",
        "Approved Wfh"
      );
    };
    return resolve("Updated");
  });
};
