const Leave = require("../model/LeaveModel");
const User = require("../model/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Email = require("../utils/email");
const { filterObj, requiredFields } = require("../utils/utiltites");
var mongoose = require("mongoose");
var dateFormat = require("dateformat");
const moment = require("moment");
const Constant = require("../utils/constant");
const Wfh = require("../model/WorkHomeModel");
const Attendance = require("../model/AttendanceModel");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const {helpers,logupdate} = require("../utils/helper");



exports.Leave = catchAsync(async (req, res, next) => {
  const myUser = await User.findOne({ _id: req.user.id });
  let obj = {
    Subject: req.body.Subject,
    Purpose: req.body.Purpose,
    FromDate: dateFormat(req.body.FromDate, "dd-mm-yyyy"),
    ToDate: dateFormat(req.body.ToDate, "dd-mm-yyyy"),
    createdAt: dateFormat(new Date(), "dd-mm-yyyy"),
    adminEmail: req.body.adminEmail,
  };
  if (!myUser) {
    return next(new AppError("User not found", 404));
  }
  const leave = await Leave.findOne({ user: { $eq: req.user._id } });
  let id = mongoose.Types.ObjectId(req.user._id);

  const appliedhalfday= await helpers(id,req.body.FromDate,req.body.ToDate);
  if(appliedhalfday>=2){
    return next(new AppError("Can't Apply more than 2(Wfh or Leave) On Same Day", 400));
  }
  try {
    let newLeave;
    if (leave) {
      newLeave = await Leave.findOneAndUpdate(
        { user: req.user._id },
        {
          $push: {
            myLeave: {
              Subject: req.body.Subject,
              Purpose: req.body.Purpose,
              FromDate: dateFormat(req.body.FromDate, "yyyy-mm-dd"),
              ToDate: dateFormat(req.body.ToDate, "yyyy-mm-dd"),
              createdAt: dateFormat(new Date(), "yyyy-mm-dd"),
              adminEmail: req.body.adminEmail,
            },
          },
        },
        { new: true }
      ).populate("user");
    } else {
      let leaves = await Leave.create({
        user: req.user._id,
        myLeave: [
          {
            Subject: req.body.Subject,
            Purpose: req.body.Purpose,
            FromDate: dateFormat(req.body.FromDate, "yyyy-mm-dd"),
            ToDate: dateFormat(req.body.ToDate, "yyyy-mm-dd"),
            createdAt: dateFormat(new Date(), "yyyy-mm-dd"),
            adminEmail: req.body.adminEmail,
          },
        ],
      });
      newLeave = await leaves.populate("user").execPopulate();
      await User.findOneAndUpdate(
        { _id: myUser._id },
        {
          $addToSet: {
            leave_id: newLeave._id,
          },
        },
        { new: true }
      );
    }
    // const url = `${req.protocol}://${req.get("host")}/api/v1/leave/${
    //   newLeave._id
    // }`;

    await new Email(myUser, obj, "applyLeave").send(
      "leave",
      myUser.name + " Leave Request (" + obj.FromDate + " To " + obj.ToDate + ")"
    );

    return res.status(200).json({
      status: "success",
      data: {
        newLeave,
      },
    });
  } catch (error) {}
});

exports.getLeave = catchAsync(async (req, res, next) => {
  try {
    const myLeave = await Leave.find({ user: req.params.id }).populate("user", [
      "name",
      "email",
    ]);
    if (!myLeave) {
      return next(new AppError("Leave does not exists", 404));
    }
    if(myLeave.length>0){
      myLeave[0].myLeave.sort((a, b) => (a.FromDate > b.FromDate) ? -1 : 1);
    }
    return res.status(200).json({
      status: "success",
      data: myLeave,
    });
  } catch (error) {
    res.status(400).send(error);
  }
});

exports.singleLeave = catchAsync(async (req, res, next) => {
  const singleLeave = await Leave.findOne(
    {
      "myLeave._id": req.params.id,
    },
    { "myLeave.$": 1 }
  ).populate("user", ["name", "email"]);

  if (!singleLeave) {
    return next(new AppError("Leave does not exists", 404));
  }

  return res.status(200).json({
    status: "success",
    data: singleLeave,
  });
});

exports.updateLeave = catchAsync(async (req, res, next) => {
  let findLeave = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: {
        "myLeave._id": mongoose.Types.ObjectId(req.params.id),
        "myLeave.Status": "Approved",
      },
    },
    {
      $project: {
        "myLeave._id": 1,
        "myLeave.Status": 1,
      },
    },
  ]);

  if (findLeave.length > 0) {
    return next(new AppError("This Leave is already approved", 404));
  }

  newUser = await Leave.findOneAndUpdate(
    { "myLeave._id": req.params.id },
    {
      $set: {
        "myLeave.$.Subject": req.body.Subject,
        "myLeave.$.Purpose": req.body.Purpose,
        "myLeave.$.FromDate": req.body.FromDate,
        "myLeave.$.ToDate": req.body.ToDate,
        "myLeave.$.adminEmail": req.body.adminEmail,
      },
    },
    { upsert: true, new: true }
  );
  return res.status(200).json({
    status: "success",
    message: "Update successfully",
  });
});

exports.getLeaveMonthwise = catchAsync(async (req, res, next) => {
  var dateObj = new Date(req.query.year, req.query.month);
  var month = dateObj.getUTCMonth();
  var year = dateObj.getUTCFullYear();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month, 31));
  let id = mongoose.Types.ObjectId(req.user._id);

  const userLeave = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: {
        user: id,
        $or: [
          {
            "myLeave.FromDate": {
              $gte: new Date (from),
              $lte: new Date (to),
            },
          },
          {
            "myLeave.ToDate": {
              $lte: new Date(to),
              $gte: new Date(from),
            }
          },
        ],
      },
    },
  ]);
  const data = await Leave.populate(userLeave, {
    path: "user",
    select: { name: 1, _id: 0 },
  });
  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
    alloted_leave: req.user.alloted_leave,
    used_leave: req.user.used_leave,
  });
});

exports.deleteLeave = catchAsync(async (req, res, next) => {
  let findLeave = await Leave.findOne(
    { "myLeave._id": req.params.id },
    { "myLeave.$": 1, user: 1, Status: 1 }
  ).populate("user", ["used_leave", "alloted_leave", "name", "email"]);

  const leave = await Leave.findOneAndUpdate(
    {
      user: req.user._id,
      "myLeave._id": req.params.id,
    },
    {
      $pull: { myLeave: { _id: req.params.id } },
    },
    { "myLeave.$": 1 }
  );
  let myUser = { name: findLeave.user.name, email: findLeave.user.email };

  let obj = {
    Subject: findLeave.myLeave[0]["Subject"],
    Purpose: findLeave.myLeave[0]["Purpose"],
    Status: findLeave.myLeave[0]["Status"],
    FromDate: dateFormat(findLeave.myLeave[0]["FromDate"], "dd-mm-yyyy"),
    ToDate: dateFormat(findLeave.myLeave[0]["ToDate"], "dd-mm-yyyy"),
    adminEmail: findLeave.myLeave[0]["adminEmail"],
    createdAt: dateFormat(findLeave.myLeave[0]["createdAt"], "dd-mm-yyyy"),
  };

  await new Email(myUser, obj, "deleteLeaveWfhbyUser").sendDelete(
    "leave" + "Delete",
    `${myUser.name} Deleted The Applied ${obj.Subject} Leave (${obj.FromDate} To ${obj.ToDate})`,
    "Leave"
  );
  
  res.status(200).json({
    status: "success",
    message: "deleted successfully...!",
  });
});

exports.getAllApprovedLeave = catchAsync(async (req, res, next) => {
  let id = mongoose.Types.ObjectId(req.user._id);
  const allLeaves = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: {
        user: id,
        "myLeave.Status": "Approved",
      },
    },
  ]);
  const data = await Leave.populate(allLeaves, {
    path: "user",
    select: { name: 1, email: 1 },
  });
  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
  });
});

exports.pendingLeave = catchAsync(async (req, res, next) => {
  const leaveId = await Leave.findOne({ "myLeave._id": req.params.id });
});

///////==== API RESTRICT TO TEAMLEADER OR ADMIN ====////

exports.leaveApprove = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    const userExist = req.user.user_leads.indexOf(req.body.userId);
      if(userExist === -1) {
        return next(new AppError("You do not have permission to update this userData.",403));
      }
    }
    let findLeave = await Leave.findOne(
      { "myLeave._id": req.params.id },
      { "myLeave.$": 1, user: 1, Status: 1 }
    ).populate("user", ["used_leave", "alloted_leave", "name", "email"]);

    // ---- CODES FOR LOG  --- //
    const beforeStatus = findLeave.myLeave.length>0?findLeave.myLeave[0].Status:'';
    const afterStatus = req.body.Status?req.body.Status:'';
    var actionstatus = "userLeaveReject";
    // ---- CODES FOR LOG END HERE   --- //

    await Leave.updateOne(
      { "myLeave._id": req.params.id },
      {
        $set: {
          "myLeave.$.Status": req.body.Status,
        },
      }
    );

    if (req.body.Status === "Approved") {
      actionstatus = "userLeaveApprove";
      const date1 = new Date(findLeave.myLeave[0].FromDate);
      const date2 = new Date(findLeave.myLeave[0].ToDate);
      const days = await Constant.getBusinessDatesCount(date1,date2);
      if (findLeave.myLeave[0].Subject === "Half Leave") {
       await User.findOneAndUpdate(
          { _id: findLeave.user._id },
          {
            used_leave: (findLeave.user.used_leave + (days/2)),
            alloted_leave: (findLeave.user.alloted_leave - (days/2)),
          }
        );
      } else {
        await User.findOneAndUpdate(
          { _id: findLeave.user._id },
          {
            used_leave: findLeave.user.used_leave + days,
            alloted_leave: findLeave.user.alloted_leave - days,
          }
        );
      }
    }

    // ---- CODES FOR LOG  --- //
    const payload = {
      leaveId:req.params.id?req.params.id:'',
      employeeId:findLeave.user._id?findLeave.user._id:'',
      subject:findLeave.myLeave.length>0?findLeave.myLeave[0].Subject:'',
      purpose:findLeave.myLeave.length>0?findLeave.myLeave[0].Purpose:'',
      fromDate:findLeave.myLeave.length>0?findLeave.myLeave[0].FromDate:'',
      toDate:findLeave.myLeave.length>0?findLeave.myLeave[0].ToDate:'',
      beforeStatus,
      afterStatus
    };

    await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

    // ---- CODES FOR LOG END HERE   --- //

    let myUser = { name: findLeave.user.name, email: findLeave.user.email };
    let obj = {
      Subject: findLeave.myLeave[0]["Subject"],
      Purpose: findLeave.myLeave[0]["Purpose"],
      Status: req.body.Status,
      FromDate: dateFormat(findLeave.myLeave[0]["FromDate"], "dd-mm-yyyy"),
      ToDate: dateFormat(findLeave.myLeave[0]["ToDate"], "dd-mm-yyyy"),
      createdAt: dateFormat(findLeave.myLeave[0]["createdAt"], "dd-mm-yyyy"),
    };
    await new Email(myUser, obj, "updateLeaveByAdmin").sendApprove(
      "leave" + req.body.Status,
      req.body.Status + " Leave"
    );
  return res.status(200).json({
    status: "Update",
  });
});

exports.leaveCancel = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    const userExist = req.user.user_leads.indexOf(req.body.userId);
    if(userExist === -1) {
      return next(new AppError("You do not have permission to update this userData.",403));
    }
  }
  if(!req.body.reasonToCancel){
    return next(new AppError("Reason to cancleLeave must required.",403));
  }
  let findLeave = await Leave.findOne(
    { "myLeave._id": req.params.id },
    { "myLeave.$": 1, user: 1, Status: 1 }
  ).populate("user", ["used_leave", "alloted_leave","name", "email"]);

  // ---- CODES FOR LOG  --- //
  const beforeStatus = findLeave.myLeave.length>0?findLeave.myLeave[0].Status:'';
  const afterStatus = req.body.Status?req.body.Status:'';
  var actionstatus = "userLeaveCancel";
  // ---- CODES FOR LOG END HERE   --- //

  await Leave.updateOne(
    { "myLeave._id": req.params.id },
    {
      $set: {
        "myLeave.$.Status": req.body.Status,
        "myLeave.$.reasonToCancel":req.body.reasonToCancel
      },
    }
  );

  if (req.body.Status === "Canceled") {
    const date1 = new Date(findLeave.myLeave[0].FromDate);
    const date2 = new Date(findLeave.myLeave[0].ToDate);
    const days = await Constant.getBusinessDatesCount(date1,date2);
    if (findLeave.myLeave[0].Subject === "Half Leave") {
      await User.findOneAndUpdate(
        { _id: findLeave.user._id },
        {
          used_leave: (findLeave.user.used_leave - (days/2)),
          alloted_leave: (findLeave.user.alloted_leave + (days/2)),
        }
      );
    } else {
      await User.findOneAndUpdate(
        { _id: findLeave.user._id },
        {
          used_leave: findLeave.user.used_leave - days,
          alloted_leave: findLeave.user.alloted_leave + days,
        }
      );
    }
  }

  let myUser = { name: findLeave.user.name, email: findLeave.user.email };
  let obj = {
    Subject: findLeave.myLeave[0]["Subject"],
    Purpose: findLeave.myLeave[0]["Purpose"],
    Status: req.body.Status,
    reasonToCancel:req.body.reasonToCancel,
    FromDate: dateFormat(findLeave.myLeave[0]["FromDate"], "dd-mm-yyyy"),
    ToDate: dateFormat(findLeave.myLeave[0]["ToDate"], "dd-mm-yyyy"),
    createdAt: dateFormat(findLeave.myLeave[0]["createdAt"], "dd-mm-yyyy"),
  };
  await new Email(myUser, obj, "updateLeaveByAdmin").sendApprove(
    "leave" + req.body.Status,
    req.body.Status + " Leave"
  );

  // ---- CODES FOR LOG  --- //

  const payload = {
    leaveId:req.params.id?req.params.id:'',
    employeeId:findLeave.user._id?findLeave.user._id:'',
    subject:findLeave.myLeave.length>0?findLeave.myLeave[0].Subject:'',
    purpose:findLeave.myLeave.length>0?findLeave.myLeave[0].Purpose:'',
    fromDate:findLeave.myLeave.length>0?findLeave.myLeave[0].FromDate:'',
    toDate:findLeave.myLeave.length>0?findLeave.myLeave[0].ToDate:'',
    reason:req.body.reasonToCancel?req.body.reasonToCancel:'',
    beforeStatus,
    afterStatus 
  };

  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);
  
  // ---- CODES FOR LOG END HERE   --- //

  return res.status(200).json({
    status: "success To Update",
  });
});

exports.getPendingLeave = catchAsync(async (req, res, next) => {
  let where = {
        "myLeave.Status": "Pending"
      }

  if(req.user.usesrRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    where = { ...where, "user": {$in : req.user.user_leads}};
  }

  let allLeaves = await Leave.aggregate([
    {$unwind: "$myLeave"},
    {$match : where},
  ]);

  const data = await Leave.populate(allLeaves, {
    path: "user",
    select: { name: 1, email: 1 },
  });

  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
  });
});

exports.attendanceLeaveCancel = catchAsync(async (req, res, next) => {
  let leaveData;
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    const userExist = req.user.user_leads.indexOf(req.body.userId);
    if(userExist === -1) {
      return next(new AppError("You do not have permission to update this userData.",403));
    }
  }
  leaveData = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match:{
        user: mongoose.Types.ObjectId(req.body.userId),
        "myLeave.createdAt":new Date(req.body.Date),
      }
    }
  ]);

  // if(leaveData.length == 0){
  //   return "Leave does not exists";
  // }
  
  return res.status(200).json({
    status: "success",
    data: leaveData,

  });
});

exports.getLeaveDateWise = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
    let myId;
    if (req.body.userId) {
      myId = mongoose.Types.ObjectId(req.body.userId);
    }
    const fromDate = req.body.FromDate;
    const toDate = req.body.ToDate;
    const leaveStatus = req.body.statusLeave;
    let where;
    if (myId && fromDate && toDate) {
      where = {
        user: myId,
        $or: [
          {
            "myLeave.FromDate": {
              $gte: new Date(fromDate),
              $lte: new Date(toDate),
            },
          },
          {
            "myLeave.ToDate": {
              $lte: new Date(toDate),
              $gte: new Date(fromDate),
            },
          },
        ],
      };
    } else if (myId) {
      where = { user: myId };
    } else if (fromDate && toDate) {
      where = {
        $or: [
          {
            "myLeave.FromDate": {
              $gte: new Date (fromDate),
              $lte: new Date (toDate),
            },
          },
          {
            "myLeave.ToDate": {
              $lte: new Date(toDate),
              $gte: new Date(fromDate),
            }
          },
        ],
      };
    }
  
    if (leaveStatus == "all") {
      if (where !== undefined) {
        delete where["myLeave.Status"];
      } else {
        where = {};
      }
    }
  
    if (leaveStatus !== "all" && leaveStatus !== undefined) {
      where = { ...where, "myLeave.Status": leaveStatus };
    }
  
    if(req.user.userRole === 'teamLeader') {
      if(req.user.user_leads.length >= 0 && !myId) {
        where = { ...where, "user": {$in : req.user.user_leads}};
      }
    }
    const leaveDateWise = await Leave.aggregate([
      { $unwind: "$myLeave" },
      { $match: where },
    ]);
    const data = await Leave.populate(leaveDateWise, {
      path: "user",
      select: { name: 1, _id: 1},
    });
  
    return res.status(200).json({
      status: "success",
      total: data.length,
      data: data,
    });
});

///////==== API RESTRICT TO  ADMIN ====////

exports.getAllLeaveMonthWise = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
    var dateObj = new Date(req.body.year, req.body.month);

    var month = dateObj.getUTCMonth();
    var year = dateObj.getUTCFullYear();
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month, 31));
  
    const data = await Leave.find().populate("user",{branch_id:1});
  
    let userIds = [];
    data.forEach((element) => {
      req.body.branchId.forEach((branchId,index)=>{
        if (element.user !== null && element.user.branch_id == req.body.branchId[index]) {
          userIds.push(element.user._id);
        }
      })
    });
  
    const allLeaves = await Leave.aggregate([
      { $unwind: "$myLeave" },
      {
        $match: {
          user: { $in: userIds },
          $or: [
            {
              "myLeave.FromDate": {
                $gte: new Date (from),
                $lte: new Date (to),
              },
            },
            {
              "myLeave.ToDate": {
                $lte: new Date(to),
                $gte: new Date(from),
              }
            },
          ],
        },
      },
      {$sort: {"myLeave.FromDate": -1}}
    ]);
  const allLeave = await Leave.populate(allLeaves, {
    path: "user",
    select: { name: 1 },
  });
  return res.status(200).json({
    status: "success",
    total: allLeave.length,
    data: allLeave,
  });
});

exports.leaveRecord = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else {
    let branchId;
    if (req.body.Id) {
      branchId = mongoose.Types.ObjectId(req.body.Id);
    }

    const startDate = new Date(req.body.fromDate);
    const toDate = new Date(req.body.toDate);
    toDate.setDate(toDate.getDate() + 1);
    const endDate = new Date(req.body.toDate);
    let users;

    let where = {};
    if(req.body.hasOwnProperty("Id")) {
      where = {
        isBlackListed:false,
        active:true,
        userRole:{ $in: ["user","teamLeader"] },
        branch_id: branchId,
      }
    } else if (!req.body.hasOwnProperty("Id")){
      where = {
        isBlackListed:false,
        active:true,
        userRole:{ $in: ["user","teamLeader"] },
      }
    }
      users = await User.aggregate([
        {$match:where},
        {
          $project:{
            email:1,
            name:1,
            alloted_leave:1,
            used_leave:1,
            alloted_wfh:1,
            used_wfh:1,
            branch_id :1,
          }
        }
      ]);
    if(!users) {
      return ("users does not exists");
    }

    let userData =[];
    for (let user of users){
      const userId = user._id;
      let halfLeave =0;
      let fullLeave =0;
      let halfWfh = 0;
      let fullWfh = 0;
      let payLoadAttendance = {};
      if((req.body.hasOwnProperty("fromDate")) && (req.body.hasOwnProperty("toDate"))) {
        payLoadAttendance = {
          user: userId,
          $or: [
            {
              "myAttendance.dateOut": {
                $gte: new Date(startDate),
                $lte: new Date(toDate),
              },
            },
          ]
        }
      } else {
        payLoadAttendance = {
          user: userId,
        }
      }
      const userAttendance = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        { $match: payLoadAttendance},
      ]);
      let payLoadLeave = {};
      if((req.body.hasOwnProperty("fromDate")) && (req.body.hasOwnProperty("toDate"))) {
        payLoadLeave = {
          user: userId,
          "myLeave.Status": "Approved",
          $or: [
            {
              "myLeave.FromDate": {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
              },
            },
            {
              "myLeave.ToDate": {
                $lte: new Date(endDate),
                $gte: new Date(startDate),
              },
            },
          ]
        }
      }else {
        payLoadLeave = {
          user: userId,
          "myLeave.Status": "Approved",
        }
      }
      const allLeave = await Leave.aggregate([
        { $unwind: "$myLeave" },
        { $match: payLoadLeave},
      ]);
      let days;
      let totalLeaveDays =0;
      let balancedLeave;
      let occupiedLeave;
      if(allLeave.length > 0 ){
        for (let leave of allLeave) {
          if(new Date(leave.myLeave.ToDate).getTime() >= endDate.getTime()) {
            days = await Constant.getBusinessDatesCount(leave.myLeave.FromDate,endDate);
          }
          else if (new Date(leave.myLeave.FromDate).getTime() <= startDate.getTime()){
            days = await Constant.getBusinessDatesCount(startDate,leave.myLeave.ToDate);
          }
          else{
            days = await Constant.getBusinessDatesCount(leave.myLeave.FromDate,leave.myLeave.ToDate);
          }
  
          if(leave.myLeave.Subject == "Half Leave") {
            halfLeave += (days/2);
          }
          else {
            fullLeave += days;
          }
        } 
        totalLeaveDays = halfLeave + fullLeave;
      }
      balancedLeave = user.leaveRecord?.alloted_leave;
      occupiedLeave = totalLeaveDays;
      let payLoadWfh;
      if((req.body.hasOwnProperty("fromDate")) && (req.body.hasOwnProperty("toDate"))){
      payLoadWfh = {
        user: userId,
        "myWfh.Status": "Approved",
        $or: [
          {
            "myWfh.FromDate": {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          },
          {
            "myWfh.ToDate": {
              $lte: new Date(endDate),
              $gte: new Date(startDate),
            },
          },
        ]
      }
    }else {
      payLoadWfh = {
        user: userId,
        "myWfh.Status": "Approved",
      }
    }
      const allWfh = await Wfh.aggregate([
        { $unwind: "$myWfh" },
        { $match: payLoadWfh},
      ]);
      let day;
      let totalWfhDays = 0;
      let balancedWfh;
      let occupiedWfh;
      if(allWfh.length > 0 ){
        for (let wfh of allWfh) {
          if(new Date(wfh.myWfh.ToDate).getTime() >= new Date(endDate).getTime()) {
            day = await Constant.getBusinessDatesCount(wfh.myWfh.FromDate,endDate);
          }
          else if (new Date(wfh.myWfh.FromDate).getTime() <= new Date(startDate).getTime()){
            day = await Constant.getBusinessDatesCount(startDate,wfh.myWfh.ToDate);
          }
          else{
            day = await Constant.getBusinessDatesCount(wfh.myWfh.FromDate,wfh.myWfh.ToDate);
          }
          if(wfh.myWfh.Subject == "Half Day"){
            halfWfh += (day/2);
          }else {
            fullWfh += day;
          }
        }
        totalWfhDays = halfWfh + fullWfh;
      }
      let attendanceDay = 0;
      if(userAttendance.length > 0){
        attendanceDay = userAttendance.length - halfLeave - halfWfh;
      }
      balancedWfh = user.leaveRecord?.alloted_wfh;
      occupiedWfh = totalWfhDays;
      userData.push({"user":user,"attendanceDay":attendanceDay,"balancedLeave":balancedLeave,"occupiedLeave":occupiedLeave,"balancedWfh":balancedWfh,"occupiedWfh":occupiedWfh})
    }
    if(req.body.type == "search") {
      return res.status(200).json({
        status: "success",
        data:userData,
      });
    }else if (req.body.type == "download"){
      if(userData)
      {
        const workSheetColumnNames = [
          "Name","Email","BalanceLeave","BalanceWfh","AttendanceDay","OccupiedLeave","OccupiedWfh",
        ];
        const workSheetName = 'LeaveRecord';
        var filePath = './leaveRecords.xlsx';
        let data;
        data =  userData.map((item)=>{
          return [
            item.user.name,item.user.email,item.user.alloted_leave,item.user.alloted_wfh,item.attendanceDay,item.occupiedLeave,item.occupiedWfh,
          ]
        });
        const workBook = new XLSX.utils.book_new();
        const workSheetData = [ 
          workSheetColumnNames,
          ... data
        ];
    
        const workSheet = XLSX.utils.json_to_sheet(workSheetData,{skipHeader: true});
          workSheet["!cols"] = [{wch:20},{wch:30},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}];
          XLSX.utils.book_append_sheet(workBook,workSheet);
          XLSX.writeFile(workBook, path.resolve(filePath));
    
        await deleteExportLeaveRecord(filePath);
        res.sendFile(path.join(__dirname, "..", "/leaveRecords.xlsx"));
      };
    } 
  }
});

function deleteExportLeaveRecord(filePath) {
  setTimeout(() => {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      return err;
    }
  }, 5000);
} 

///-----Extra Api ---////
  // exports.allLeave = catchAsync(async (req, res, next) => {
  //   const allLeaves = await Leave.aggregate([
  //     { $unwind: "$myLeave" },
  //     { $match: { "myLeave.Status": "Approved" } },
  //   ]);
  //   const data = await Leave.populate(allLeaves, { path: "user" });
  //   return res.status(200).json({
  //     status: "success",
  //     total: data.length,
  //     data: data,
  //   });
  // });