const Attendance = require("../model/AttendanceModel");
const User = require("../model/UserModel");
const Leave = require("../model/LeaveModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
var mongoose = require("mongoose");
var dateFormat = require("dateformat");
var request = require("request");
const { IP } = require("../utils/constant");
const Branch = require("../model/BranchModel");
const constant = require("../utils/constant");
const DataLimit = require("../utils/constant");
const WorkHome = require("../model/WorkHomeModel");
const {logupdate,offenceCount} = require("../utils/helper");

exports.getAttendance = catchAsync(async (req, res, next) => {
  const myUser = await User.findById({ _id: req.user.id });
  if (!myUser) {
    return next(new AppError("User not found", 404));
  }
  const today = new Date();
  let offset = today.getTimezoneOffset() - 210;
  let dt1 = new Date(today.getTime() - offset * 60000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayOfWeek = today.getDay();
  const attendanceUser = await Attendance.findOne(
    {
      user: req.user.id,
      myAttendance: {
        $elemMatch: {
          createdAt: {
            $gte: dateFormat(today, "yyyy-mm-dd"),
            $lt: dateFormat(tomorrow, "yyyy-mm-dd"),
          },
        },
      },
    },
    { myAttendance: { $slice: -1 } }
  );

  //------ CHECK IN TODAY'S USER LEAVE ----- //
  const leaveList = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: {
        user: req.user._id,
        $and:[
          {
            "myLeave.FromDate": {
              $lte: new Date(new Date(today).setHours(23, 58, 00)),
            },
            "myLeave.ToDate": {
              $gte: new Date(new Date(today).setHours(00, 00, 00)),
            },
          },
          {
            $or: [
              {"myLeave.Status": "Pending" },
              {"myLeave.Status": "Approved" },
            ],
          },
        ],
      },
    },
  ]);
  let leave;
  if(leaveList.length>0){
    leave = leaveList[0].myLeave.Subject;
  }
  //------ CHECK IN TODAY'S USER WORKHOME ----- //
  const wfhList = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        user: req.user._id,
        $and:[
          {
            "myWfh.FromDate": {
              $lte: new Date(new Date(today).setHours(23, 58, 00)),
            },
            "myWfh.ToDate": {
              $gte: new Date(new Date(today).setHours(00, 00, 00)),
            },
          },
          {
            $or: [
              { "myWfh.Status": "Approved" },
              { "myWfh.Status": "Pending" },
            ],
          },
        ],
      },
    },
  ]);
  let wfh;
  if(wfhList.length>0) {
    wfh = wfhList[0].myWfh.Subject;
  }
  let dayIn = 0;
  let dayOut = 0;

  if(dayOfWeek == 0 || dayOfWeek == 6 || leave === "Full Leave" || wfh === "Full Day" || (leave === "Half Leave" && wfh === "Half Day")){
    dayIn = 1;
    dayOut = 1;
  }else {
    if (!attendanceUser) {
      dayIn = 0;
      dayOut = 0;
    } else {
      if (
        attendanceUser.myAttendance[0].dateIn != null &&
        attendanceUser.myAttendance[0].dateOut != null
      ) {
        dayIn = 1;
        dayOut = 1;
      } else if (attendanceUser.myAttendance[0].dateIn != null) {
        dayIn = 1;
        dayOut = 0;
      } else if (attendanceUser.myAttendance[0].dateOut != null) {
        dayIn = 0;
        dayOut = 1;
      }
    }
  }

  // ----------- For Pagination -----------//
  let pageLimit = req.query.pageLimit
  ? Number(req.query.pageLimit)
  : DataLimit.PER_PAGE;
  const skip = (req.query.page - 1) * pageLimit ? Number((req.query.page - 1) * pageLimit) :0;

  const userAttend = await Attendance.aggregate([
    {$unwind:"$myAttendance"},
    {
      $match: {
        user: req.user._id,
      }
    },
    {$sort: {"myAttendance.createdAt": -1}},
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: skip }, { $limit: pageLimit }],
      },
    },
  
  ])
  return res.status(200).json({
    status: "success",
    total: userAttend[0].metaData[0].total,
    data: {
      dayIn,
      dayOut,
      userAttend: userAttend[0].records,
      currentTime:dt1,
    },
  });
});

exports.getIpAddress = catchAsync(async (req, res, next) => {
  await request("http://api.ipify.org", function (error, response, body) {
    if (!error && response.statusCode == 200) {
      return res.status(200).json({
        status: "success",
        ip: body,
      });
    }
  });
});

exports.verifiedAttendance = catchAsync(async (req, res, next) => {
  const myUser = await User.findById({ _id: req.user.id });
  if (!myUser) {
    return next(new AppError("User not found", 404));
  }

  const branch = await Branch.findOne({
    _id: req.user.branch_id,
    isActive: true,
  });

  if (!branch) {
    return next(new AppError("Branch not found", 404));
  }

  if (myUser.systemUniqueId != req.body.systemUniqueId) {
    return next(
      new AppError(
        "Sorry,You can't fill the attendance because it is not your system and network",
        404
      )
    );
  }

  if (!req.body.type) {
    return next(new AppError("Type not defined", 404));
  }

  var now = new Date();
  var offset = now.getTimezoneOffset() - 210;
  let dt1 = new Date(now.getTime() - (offset * 60000));
  const inTime = pad(dt1.getUTCHours()) + ":" + pad(dt1.getUTCMinutes());
  const attendanceUser = await Attendance.findOne({
    user: req.user._id,
  });
  if (!attendanceUser) {
    await Attendance.create({
      user: req.user.id,
      branch_id: req.user.branch_id,
      attendanceMember: branch.attendanceMember,
      myAttendance: [
        {
          inTime: inTime,
          dateIn: dt1,
          createdAt: dt1,
          inIpAddress:req.body.ipAddress
        },
      ],
    });
  }
  let newAttendance;
  if (attendanceUser) {
    if (req.body.type === "inTime") {
      const onedate = new Date();
     const alreadyin = await Attendance.find(
        {'myAttendance.dateIn':{
          "$gte": new Date(new Date(onedate).setHours(00, 00, 00)),
          "$lte": new Date(new Date(onedate).setHours(23, 58, 00))}
          ,
          user: req.user.id
        }
        );
    if(alreadyin.length===0){
      newAttendance = await Attendance.findOneAndUpdate(
        { user: req.user.id },
        {
          $set: { branch_id: req.user.branch_id,attendanceMember: branch.attendanceMember},
          $push: {
            myAttendance: {
              inTime: inTime,
              dateIn: dt1,
              createdAt: dt1,
              inIpAddress:req.body.ipAddress
            },
          },
        },
        { new: true }
      ).select({
        myAttendance:0
      });
    }
    }
    if (req.body.type === "outTime") {
      const dt2 = new Date(now.getTime() - (offset * 60000));
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const attendanceToday = await Attendance.findOne(
        {
          user: req.user._id,
          myAttendance: {
            $elemMatch: {
              dateIn: {
                $gte: dateFormat(today, "yyyy-mm-dd"),
                $lt: dateFormat(tomorrow, "yyyy-mm-dd"),
              },
            },
          },
        },
        { myAttendance: { $slice: -1 } }
      );
      const diffMs = dt2 - attendanceToday.myAttendance[0].dateIn;
      const outTime = pad(dt2.getUTCHours()) + ":" + pad(dt2.getUTCMinutes());
      const diffMins = Math.ceil(diffMs / 1000 / 60);
      var totalHours;
      var hours = diffMins / 60;
      var rhours = Math.floor(hours);
      var minutes = (hours - rhours) * 60;
      var rminutes = Math.ceil(minutes);
      totalHours = pad(rhours) + ":" + pad(rminutes);
      newAttendance = await Attendance.findOneAndUpdate(
        {
          user: req.user._id,
          myAttendance: {
            $elemMatch: {
              dateIn: {
                $gte: dateFormat(today, "yyyy-mm-dd"),
                $lt: dateFormat(tomorrow, "yyyy-mm-dd"),
              },
            },
          },
        },
        {
          $set: {
            "branch_id": req.user.branch_id,
            "attendanceMember": branch.attendanceMember,
            "myAttendance.$.outTime": outTime,
            "myAttendance.$.dateOut": dt2,
            "myAttendance.$.totalWorkingHours": totalHours,
            "myAttendance.$.outIpAddress":req.body.ipAddress,
          },
        } 
      ).select({
        myAttendance:0
      });
      // daily Working hours not completed..
      if(hours < 8) {
        await User.findOneAndUpdate(
          {_id:req.user._id},
          {
            $set : {dayFlag:true}
          },
          {new: true}
        )
      }
    }
  }

  return res.status(200).json({
    status: "success",
    data: newAttendance,
    message: "Attendace added successfully",
  });
});

exports.attendanceFiltered = catchAsync(async (req, res, next) => {
  let where = {};
  let myId;
  if (req.body.userId) {
    myId = mongoose.Types.ObjectId(req.body.userId);
  }
  let FromDate = new Date(req.body.fromDate);
  let ToDate = new Date(req.body.toDate);
  ToDate.setDate(ToDate.getDate() + 1);
  let leavePayload = {};
  let halfLeaveCount = 0;
  let halfWfhCount = 0;
  let wfhPayload = {};
  if (!req.body.hasOwnProperty("type")) {
    let attendaceData = await constant.attendanceUserPayload(FromDate,ToDate,myId);
      where = attendaceData;
    let leaveData = await constant.leaveUserPayload(FromDate,ToDate,myId);
      leavePayload =leaveData;
    let wfhData = await constant.wfhUserPayload(FromDate,ToDate,myId);
    wfhPayload = wfhData;
  } else {
    if (req.body.hasOwnProperty("userId") && req.body.hasOwnProperty("fromDate") && req.body.hasOwnProperty("toDate")) {
      let attendaceData = await constant.attendanceUserPayload(FromDate,ToDate,myId);
      where = attendaceData;
      let leaveData = await constant.leaveUserPayload(FromDate,ToDate,myId);
      leavePayload =leaveData;
      let wfhData = await constant.wfhUserPayload(FromDate,ToDate,myId);
      wfhPayload = wfhData;
    } else if(req.body.hasOwnProperty("fromDate") && req.body.hasOwnProperty("toDate")){
      let attendaceData = await constant.attendanceDatePayload(FromDate,ToDate);
      where = attendaceData;
      let leaveData = await constant.leaveDatePayload(FromDate,ToDate);
      leavePayload = leaveData;
      let wfhData = await constant.wfhDatePayload(FromDate,ToDate);
      wfhPayload = wfhData;
    } else if(req.body.hasOwnProperty("userId")) {
      where = {
        'user._id': mongoose.Types.ObjectId(myId)
      }
      leavePayload = {
        "user": mongoose.Types.ObjectId(myId),
        "myLeave.Subject": "Half Leave",
      }
      wfhPayload = {
        "user": mongoose.Types.ObjectId(myId),
        "myWfh.Subject": "Half Day",
      }
    }
    if(req.user.userRole === 'teamLeader') {
    if(req.user.user_leads.length >= 0 && !myId) {
      for(let teamUser of req.user.user_leads) {
        where = {"user._id":mongoose.Types.ObjectId(teamUser), ...where};
      }
    }
  }
  }

  // ----------- For Pagination -----------//
  let pageLimit = req.query.pageLimit
  ? Number(req.query.pageLimit)
  : DataLimit.PER_PAGE;
  const skip = (req.query.page - 1) * pageLimit ? Number((req.query.page - 1) * pageLimit) :0;

  let allAttendance = await Attendance.aggregate([
    { $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      as: 'user',
    }},
    { $unwind: "$myAttendance" },
    {
      $match: where,
    },
    {
      $project: {
        "myAttendance": 1,
         name:'$user.name',
         userId:'$user._id'
      },
    },
    {$sort: {"myAttendance.createdAt": -1}},
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: skip }, { $limit: pageLimit }],
      },
    },
  ]);
  let allLeaves = await Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: leavePayload,
    },
    {
      $project: {
        "myLeave": 1,
      },
    },
  ]);
  let days;
  if(allLeaves.length > 0 && myId) {  
    for(let leave of allLeaves){
      if(leave.myLeave.Status === "Approved" || leave.myLeave.Status === "Pending") {
        days = await constant.getBusinessDatesCount(leave.myLeave.FromDate,leave.myLeave.ToDate);
        halfLeaveCount += (days/2);
      }
    }
  }

  let allWfhs = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: wfhPayload,
    },
    {
      $project: {
        "myWfh": 1,
      },
    },
  ]);
  let day;
  if(allWfhs.length > 0  && myId){
    for(let wfh of allWfhs){
      if(wfh.myWfh.Status === "Approved" || wfh.myWfh.Status === "Pending") {
        day = await constant.getBusinessDatesCount(wfh.myWfh.FromDate,wfh.myWfh.ToDate);
        halfWfhCount += (day/2);
      }
    }
  }

 let totalDays = 0;
 if(allAttendance[0].metaData.length > 0) {
   totalDays = allAttendance[0].metaData[0].total - (halfWfhCount + halfLeaveCount);
 }
  return res.status(200).json({
    status: "success",
    total: allAttendance[0].metaData.length > 0?allAttendance[0].metaData[0].total :0,
    totaldays: totalDays,
    data: allAttendance[0].records,
  });
});

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

exports.previousDayAttendance = catchAsync(async (req, res, next) => {
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate() - 1);
  let allAttendance;
  let where = {          
        "myAttendance.createdAt": {
          $gte: end,
          $lt: start,
        },
      }
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    where = { ...where, "user": {$in : req.user.user_leads} };
  }
  // ----------- For Pagination -----------//
  let pageLimit = req.query.pageLimit
  ? Number(req.query.pageLimit)
  : DataLimit.PER_PAGE;
  const skip = (req.query.page - 1) * pageLimit ? Number((req.query.page - 1) * pageLimit) :0;

  allAttendance = await Attendance.aggregate([
    { $unwind: "$myAttendance" },
    { $match: where},
    {
      $lookup:{
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      }
    },
    {
      $project: {
        "myAttendance": 1,
         name:'$user.name',
         userId:'$user._id'
      },
    },
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: skip }, { $limit: pageLimit }],
      },
    },
  ]);
  
  return res.status(200).json({
    status: "success",
    total: allAttendance[0].metaData.length > 0?allAttendance[0].metaData[0].total :0,
    data: allAttendance[0].records.length > 0?allAttendance[0].records : [],
  });
});

exports.updateAttendance = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader')  {
      const userExist = req.user.user_leads.indexOf(req.body.userId);
      if(userExist === -1) {
        return next(new AppError("You do not have permission to update this userData.",403));
      }
  }
  var dateIn,dateOut;
  var inTime,outTime;
  let totalHours;
  if(req.body.dateIn){
    dateIn = new Date(req.body.dateIn);
    inTime = dateIn.getUTCHours() + ":"+ dateIn.getUTCMinutes();
  }
  if(req.body.dateOut){
    dateOut = new Date(req.body.dateOut);
    outTime = dateOut.getUTCHours() + ":"+ dateOut.getUTCMinutes();
  }
  if(req.body.dateIn && req.body.dateOut){
  const diffMs = dateOut - dateIn;
  const diffMins = Math.ceil(diffMs / 1000 / 60);
  let hours = diffMins / 60;
  let rhours = Math.floor(hours);
  let minutes = (hours - rhours) * 60;
  let rminutes = Math.ceil(minutes);
  totalHours = rhours + ":" + rminutes;
  }
  var actionstatus = "userAttendanceUpdate";
  let branch = await User.findOne({_id:mongoose.Types.ObjectId(req.body.userId)}).select({ branch_id: 1,_id:0});

  // ---- CODES FOR LOG  --- //

  let beforeAttendance = await Attendance.findOne(
    {
      user: mongoose.Types.ObjectId(req.body.userId),
      "myAttendance._id": mongoose.Types.ObjectId(req.params.id) 
    });

  var beforeAttenInTime,beforeAttenOutTime;
  var updatedAttenInTime,updatedAttenOutTime;

  beforeAttendance.myAttendance.forEach(function(element) {

    if(element._id == req.params.id){
      beforeAttenInTime = element.inTime;
      beforeAttenOutTime = element.outTime
    }
  });
  // ---- CODES FOR LOG END HERE --- //

  let updateAttendance = await Attendance.findOneAndUpdate(
    { 
      user: mongoose.Types.ObjectId(req.body.userId),
      "myAttendance._id": mongoose.Types.ObjectId(req.params.id) 
    },
    {
      $set: {
        "myAttendance.$.dateIn": dateIn?dateIn:"",
        "myAttendance.$.dateOut": dateOut?dateOut:"",
        "myAttendance.$.inTime": inTime?inTime:"",
        "myAttendance.$.outTime": outTime?outTime:"",
        "myAttendance.$.totalWorkingHours": totalHours?totalHours:"",
      },
    },
    { new: true }
  );
  if(!updateAttendance){
    return next(new AppError("Attendance data not found", 404));
  }

  // ---- CODES FOR LOG  --- //
  updateAttendance.myAttendance.forEach(function(element) {

    if(element._id == req.params.id){
      updatedAttenInTime = element.inTime;
      updatedAttenOutTime = element.outTime
    }
  });

  const payload = {
    attendanceId:req.params.id,
    employeeId:updateAttendance.user
  };
  
  if(beforeAttenInTime != updatedAttenInTime){
    payload.beforeInTime=beforeAttenInTime;
    payload.updatedInTime=updatedAttenInTime;
  }
  if(beforeAttenOutTime != updatedAttenOutTime){
    payload.beforeOutTime=beforeAttenOutTime;
    payload.updatedOutTime=updatedAttenOutTime;
  }

  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

  await offenceCount("attendanceUpdate",req.body.userId,branch.branch_id);
  
  const today = dateFormat(new Date(), "yyyy-mm-dd");
  const dateOutAfterUpdate = dateFormat(req.body.dateOut, "yyyy-mm-dd");

  if (today === dateOutAfterUpdate && req.body.dateOut) {

    const attendanceAfterUpdate = await Attendance.aggregate([
      {$unwind:"$myAttendance"},
      {$match:
        {
           user:mongoose.Types.ObjectId(req.body.userId),
          "myAttendance._id": mongoose.Types.ObjectId(req.params.id)
        },
      },
      {
        $project:{
          user:1,
          "myAttendance.totalWorkingHours":1
        }
      }
    ]);

    if(attendanceAfterUpdate.length>0){
    let afterUpdateTotalHours = attendanceAfterUpdate[0].myAttendance.totalWorkingHours;
    let totalWorkingHours = afterUpdateTotalHours.split(":");
    totalWorkingHours = parseInt(totalWorkingHours[0]);
    
    if (totalWorkingHours >=8) {
     await User.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(attendanceAfterUpdate[0].user) },
        {
          $set: { dayFlag: false }
        },
        { new: true }
      );
    }

    }
  }
  // ---- CODES FOR LOG END HERE   --- //

  return res.status(200).json({
    status: "success",
    message: "Attendance Update successfully",
  });
});

// ---- API RESTRICT TO ADMIN --- //

exports.getUserAttendance = catchAsync(async (req, res, next) => {
  let allAttendance;

  // ----------- For Pagination -----------//
  let pageLimit = req.query.pageLimit
  ? Number(req.query.pageLimit)
  : DataLimit.PER_PAGE;
  const skip = (req.query.page - 1) * pageLimit ? Number((req.query.page - 1) * pageLimit) :0;

  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date();
  end.setDate(end.getDate() - 30);
  allAttendance = await Attendance.aggregate([
    { $unwind: "$myAttendance" },
    {
      $match: {
        user: mongoose.Types.ObjectId(req.params.id),
        "myAttendance.createdAt": {
          $gte: new Date(end),
          $lt: new Date(start),
        },
      },
    },
    {$sort: {"myAttendance.createdAt": -1}},
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: skip }, { $limit: pageLimit }],
      },
    },
  ]);
  return res.status(200).json({
    status: "success",
    total: allAttendance[0].metaData[0].total,
    data: allAttendance[0].records,
  });
});

function pad(val) {
  return val > 9 ? val : "0" + val;
}