const mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");
const User = require("../model/UserModel");
const Email = require("../utils/email");
var dateFormat = require("dateformat");
const moment = require("moment");
const Constant = require("../utils/constant");
const WorkHome = require("../model/WorkHomeModel");
const LeaveEmail = require("../utils/leaveEmail");

const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },
  myLeave: [
    {
      Subject: {
        type: String,
        enum: ["Full Leave", "Half Leave"],
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

const Leave = mongoose.model("Leave", leaveSchema);

module.exports = Leave;

module.exports.leaveApprove = async function () {
  return new Promise(async (resolve, reject) => {
    let leaveId = [];
    var pastDate = new Date(); // Get current Date
    pastDate.setDate(pastDate.getDate() - 5);
    let findLeave = await Leave.aggregate([
      { $unwind: "$myLeave" },
      {
        $match: {
          "myLeave.Status": "Pending",
          "myLeave.createdAt": { $lt: pastDate },
        },
      },
      {
        $project: {
          "user":1,
          "myLeave._id": 1,
          "myLeave.Status": 1,
          "myLeave.FromDate": 1,
          "myLeave.ToDate": 1,
          "myLeave.Subject": 1,
          "myLeave.Purpose": 1,
          "myLeave.createdAt": 1,
        },
      },
    ]);
    for(let element of findLeave) {
      const date1 = new Date(element.myLeave.FromDate);
      const date2 = new Date(element.myLeave.ToDate);
      const days = await Constant.getBusinessDatesCount(date1,date2);
      leaveId.push(mongoose.Types.ObjectId(element.myLeave._id));
      await Leave.updateOne(
        { "myLeave._id": mongoose.Types.ObjectId(element.myLeave._id) },
        { $set: { "myLeave.$.Status": "Approved" } }
      );
      let userFind = await User.findOne({ _id: element.user});
      if (element.myLeave.Subject === "Half Leave") {
        let user = await User.updateOne(
          { _id: element.user },
          {
            used_leave: (userFind.used_leave + (days/2)),
            alloted_leave: (userFind.alloted_leave - (days/2)),
          },
        );
      } else {
        let user = await User.updateOne(
          { _id: element.user },
          {
            used_leave: userFind.used_leave + days,
            alloted_leave: userFind.alloted_leave - days,
          },
        );
      }
     // ---- Send Email -----//
      let myUser = { name: userFind.name, email: userFind.email };
      let obj = {
        Subject: element.myLeave.Subject,
        Purpose: element.myLeave.Purpose,
        Status: "Approved",
        FromDate: dateFormat(element.myLeave.FromDate, "dd-mm-yyyy"),
        ToDate: dateFormat(element.myLeave.ToDate, "dd-mm-yyyy"),
        createdAt: dateFormat(element.myLeave.createdAt, "dd-mm-yyyy"),
      };
      await new Email(myUser, obj, "updateLeaveByAdmin").sendApprove(
        "leaveApproved",
        "Approved Leave"
      );
    }
    return resolve("Updated");
  });
};

module.exports.onLeaveUsers = async function () {
  return new Promise(async (resolve, reject) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let userListArr = [];
    const adminUser = await User.find({ userRole: "admin",active:true,isBlackListed:false }, { email: 1 });
    const adminEmails = adminUser.map((x) => x.email);
    const leaveList = await Leave.aggregate([
      { $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      }},
      {$unwind:"$myLeave"},
      {$match:{
        $and: [
          {
            "myLeave.FromDate": {
              $lte: new Date(new Date(tomorrow).setHours(23, 58, 00)),
            },
            "myLeave.ToDate": {
              $gte: new Date(new Date(today).setHours(00, 00, 00)),
            },
          },
          {
            $or: [
              { "myLeave.Status": "Pending" },
              { "myLeave.Status": "Approved" },
            ],
          },
        ],
      }
      },
      {
        $project: {
          "myLeave": 1,
           name:'$user.name',
           email:'$user.email',
           userId:'$user._id'
        },
      },
      {$sort:{"myLeave.fromDate": -1}},
    ]);
    if(leaveList.length >0){
      for (let element of leaveList){
        element.myLeave.FromDate = dateFormat(element.myLeave.FromDate, "dd-mm-yyyy");
        element.myLeave.ToDate = dateFormat(element.myLeave.ToDate, "dd-mm-yyyy");
      }
    }

    const wfhList = await WorkHome.aggregate([
      { $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      }},
      {$unwind:"$myWfh"},
      {
        $match:{
          $and: [
            {
              "myWfh.FromDate": {
                $lte: new Date(new Date(tomorrow).setHours(23, 58, 00)),
              },
              "myWfh.ToDate": {
                $gte: new Date(new Date(today).setHours(00, 00, 00)),
              },
            },
            {
              $or: [
                { "myWfh.Status": "Pending" },
                { "myWfh.Status": "Approved" },
              ],
            },
          ],
        }
      },
      {
        $project: {
          "myWfh": 1,
           name:'$user.name',
           email:'$user.email',
           userId:'$user._id'
        },
      },
      {$sort: {"myWfh.fromDate": -1}},
    ])
    if(wfhList.length > 0) {
      for (let element of wfhList){
        element.myWfh.FromDate = dateFormat(element.myWfh.FromDate, "dd-mm-yyyy");
        element.myWfh.ToDate = dateFormat(element.myWfh.ToDate, "dd-mm-yyyy");
      }
    }

    if(leaveList.length >0 || wfhList.length >0) {
      userListArr.push(leaveList,wfhList);
    //------ SENDING E-MAIL ----- //
    await new LeaveEmail(adminEmails, userListArr, "onLeaveUser").sendOnUserLeave(
      "onLeaveUser",
      "Employee Leave/Wfh Details"
    );
  }
    return resolve("Updated");
  });
}