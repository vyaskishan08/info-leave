const User = require("../model/UserModel");
const WorkHome = require("../model/WorkHomeModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const WfhEmail = require("../utils/WfhEmail");
const Email = require("../utils/email");
const { filterObj, requiredFields } = require("../utils/utiltites");
var mongoose = require("mongoose");
var dateFormat = require("dateformat");
const moment = require("moment");
const Constant = require("../utils/constant");
const {helpers,logupdate} = require("../utils/helper");


exports.applyWfh = catchAsync(async (req, res, next) => {
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
  const wfh = await WorkHome.findOne({ user: { $eq: req.user.id } });
  let id = mongoose.Types.ObjectId(req.user._id);
  const appliedhalfday= await helpers(id,req.body.FromDate,req.body.ToDate);

  if(appliedhalfday>=2){
    return next(new AppError("Can't Apply more than 2(Wfh or Leave) On Same Day", 400));
  }
  try {
    let newWfh;
    if (wfh) {
      newWfh = await WorkHome.findOneAndUpdate(
        { user: req.user.id },
        {
          $push: {
            myWfh: {
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
      let wfhs = await WorkHome.create({
        user: req.user.id,
        myWfh: [
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
      newWfh = await wfhs.populate("user").execPopulate();
      await User.findOneAndUpdate(
        { _id: myUser._id },
        {
          $addToSet: {
            wfh_id: newWfh._id,
          },
        },
        { new: true }
      );
    }

    await new WfhEmail(myUser, obj, "applyWFH").sendWFH(
      "wfh",
      myUser.name + " Wfh Request (" + obj.FromDate + " To " + obj.ToDate + ")"
    );

    return res.status(200).json({
      status: "success",
      data: {
        newWfh,
      },
    });
  } catch (error) {}
});

exports.getWfh = catchAsync(async (req, res, next) => {
  try {
    const myWfh = await WorkHome.find({ user: req.user.id }).populate("user", [
      "name",
      "email",
    ]);

    if (!myWfh) {
      return next(new AppError("Wfh does not exists", 404));
    }
    if(myWfh.length>0){
      myWfh[0].myWfh.sort((a, b) => (a.FromDate > b.FromDate) ? -1 : 1);
    }
    return res.status(200).json({
      status: "success",
      data: myWfh,
    });
  } catch (error) {
    res.status(400).send(error);
  }
});

exports.singleWfh = catchAsync(async (req, res, next) => {
  const singleWfh = await WorkHome.findOne(
    {
      "myWfh._id": req.params.id,
    },
    { "myWfh.$": 1 }
  );

  if (!singleWfh) {
    return next(new AppError("Data for W/H does not exists", 404));
  }

  return res.status(200).json({
    status: "success",
    data: singleWfh,
  });
});

exports.updateWfh = catchAsync(async (req, res, next) => {
  let findWfh = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        "myWfh._id": mongoose.Types.ObjectId(req.params.id),
        "myWfh.Status": "Approved",
      },
    },
    {
      $project: {
        "myWfh._id": 1,
        "myWfh.Status": 1,
      },
    },
  ]);

  if (findWfh.length > 0) {
    return next(new AppError("This W/H is already approved", 404));
  }

  newUser = await WorkHome.findOneAndUpdate(
    { "myWfh._id": req.params.id },
    {
      $set: {
        "myWfh.$.Subject": req.body.Subject,
        "myWfh.$.Purpose": req.body.Purpose,
        "myWfh.$.FromDate": req.body.FromDate,
        "myWfh.$.ToDate": req.body.ToDate,
        "myWfh.$.adminEmail": req.body.adminEmail,
      },
    },
    { upsert: true, new: true }
  );
  return res.status(200).json({
    status: "success",
    message: "Update successfully",
  });
});

exports.deleteWfh = catchAsync(async (req, res, next) => {
  let findWfh = await WorkHome.findOne(
    { "myWfh._id": req.params.id },
    { "myWfh.$": 1, user: 1, Status: 1 }
  ).populate("user", ["used_wfh", "alloted_wfh", "name", "email"]);

  const leave = await WorkHome.findOneAndUpdate(
    {
      user: req.user.id,
      "myWfh._id": req.params.id,
    },
    {
      $pull: { myWfh: { _id: req.params.id } },
    },
    { "myWfh.$": 1 }
  );

  let myUser = { name: findWfh.user.name, email: findWfh.user.email };
  
  let obj = {
    Subject: findWfh.myWfh[0]["Subject"],
    Purpose: findWfh.myWfh[0]["Purpose"],
    Status: findWfh.myWfh[0]["Status"],
    FromDate: dateFormat(findWfh.myWfh[0]["FromDate"], "dd-mm-yyyy"),
    ToDate: dateFormat(findWfh.myWfh[0]["ToDate"], "dd-mm-yyyy"),
    adminEmail: findWfh.myWfh[0]["adminEmail"],
    createdAt: dateFormat(findWfh.myWfh[0]["createdAt"], "dd-mm-yyyy"),
  };

  await new Email(myUser, obj, "deleteLeaveWfhbyUser").sendDelete(
    "leave" + "Delete",
    `${myUser.name} Deleted The Applied ${obj.Subject} Wfh (${obj.FromDate} To ${obj.ToDate})`,
    "Wfh"
  );

  res.status(200).json({
    status: "success",
    message: "deleted successfully...!",
  });
});

exports.getWfhMonthwise = catchAsync(async (req, res, next) => {
  var dateObj = new Date(req.query.year, req.query.month);
  var month = dateObj.getUTCMonth();
  var year = dateObj.getUTCFullYear();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month, 31));
  let id = mongoose.Types.ObjectId(req.user._id);

  const userWfh = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        user: id,
        $or: [
          {
            "myWfh.FromDate": {
              $gte: new Date(from),
              $lte: new Date(to),
            },
          },
          {
            "myWfh.ToDate": {
              $lte: new Date(to),
              $gte: new Date(from),
            },
          },
        ]
      },
    },
  ]);
  const data = await WorkHome.populate(userWfh, { path: "user" });
  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
    alloted_wfh: req.user.alloted_wfh,
    used_wfh: req.user.used_wfh,

  });
});

exports.getApprovedWfh = catchAsync(async (req, res, next) => {
  let id = mongoose.Types.ObjectId(req.user._id);
  const allWfh = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        user: id,
        "myWfh.Status": "Approved",
      },
    },
  ]);
  const data = await WorkHome.populate(allWfh, {
    path: "user",
    select: { name: 1, email: 1 },
  });
  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
  });
});

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

exports.wfhUpdate = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader' ) {
    const userExist = req.user.user_leads.indexOf(req.body.userId);
    if(userExist === -1) {
      return next(new AppError("You do not have permission to update this userData.",403));
    }
  }
  let findWfh = await WorkHome.findOne(
    { "myWfh._id": req.params.id },
    { "myWfh.$": 1, user: 1, Status: 1 }
  ).populate("user", ["used_wfh", "alloted_wfh", "name", "email"]);

  const date1 = new Date(findWfh.myWfh[0].FromDate);
  const date2 = new Date(findWfh.myWfh[0].ToDate);
  const days = await Constant.getBusinessDatesCount(date1,date2);
  
  // ---- CODES FOR LOG  --- //
  const beforeStatus = findWfh.myWfh[0].Status;
  const afterStatus = req.body.Status;
  var actionstatus = "";
  // ---- CODES FOR LOG END HERE   --- //

  if (req.body.Status === "Approved") {
    actionstatus = "wfhApprove"; // FOR LOG STATUS
    await WorkHome.updateOne(
      { "myWfh._id": req.params.id },
      {
        $set: {
          "myWfh.$.Status": req.body.Status,
        },
      }
    );

    if (findWfh.myWfh[0].Subject === "Half Day") {
      await User.findOneAndUpdate(
        { _id: findWfh.user._id },
        {
          used_wfh: (findWfh.user.used_wfh + (days/2)),
          alloted_wfh: (findWfh.user.alloted_wfh - (days/2)),
        }
      );
    } else {
      await User.findOneAndUpdate(
        { _id: findWfh.user._id },
        {
          used_wfh: findWfh.user.used_wfh + days,
          alloted_wfh: findWfh.user.alloted_wfh - days,
        }
      );
    }
  } else if (req.body.Status === "Canceled") {
    actionstatus = "wfhCancel"; // FOR LOG STATUS
    await WorkHome.updateOne(
      { "myWfh._id": req.params.id },
      {
        $set: {
          "myWfh.$.Status": req.body.Status,
          "myWfh.$.reasonToCancel":req.body.reasonToCancel
        },
      }
    );

    if (findWfh.myWfh[0].Subject === "Half Day") {
      await User.findOneAndUpdate(
        { _id: findWfh.user._id },
        {
          used_wfh: (findWfh.user.used_wfh - (days/2)),
          alloted_wfh: (findWfh.user.alloted_wfh + (days/2)),
        }
      );
    } else {
      await User.findOneAndUpdate(
        { _id: findWfh.user._id },
        {
          used_wfh: findWfh.user.used_wfh - days,
          alloted_wfh: findWfh.user.alloted_wfh + days,
        }
      );
    }
  }else if (req.body.Status === "Rejected") {
    actionstatus = "wfhReject"; // FOR LOG STATUS
    await WorkHome.updateOne(
      { "myWfh._id":  mongoose.Types.ObjectId(req.params.id) },
      {
        $set: {
          "myWfh.$.Status": req.body.Status,
        },
      }
    );
  }
  let myUser = { name: findWfh.user.name, email: findWfh.user.email };
  let obj = {
    Subject: findWfh.myWfh[0]["Subject"],
    Purpose: findWfh.myWfh[0]["Purpose"],
    Status: req.body.Status,
    reasonToCancel:req.body.reasonToCancel,
    FromDate: dateFormat(findWfh.myWfh[0]["FromDate"], "dd-mm-yyyy"),
    ToDate: dateFormat(findWfh.myWfh[0]["ToDate"], "dd-mm-yyyy"),
    createdAt: dateFormat(findWfh.myWfh[0]["createdAt"], "dd-mm-yyyy"),
  };
  await new WfhEmail(myUser, obj, "updateWfhByAdmin").sendApproveWFH(
    "wfhApproved",
    obj.Status + " Wfh"
  );

  // ---- CODES FOR LOG  --- //

  const payload = {
    wfhId:req.params.id,
    employeeId:findWfh.user._id,
    subject:findWfh.myWfh[0].Subject,
    purpose:findWfh.myWfh[0].Purpose,
    fromDate:findWfh.myWfh[0].FromDate,
    toDate:findWfh.myWfh[0].ToDate,
    beforeStatus,
    afterStatus
  };

  if(actionstatus==="wfhCancel"){
    payload.reasonToCancel = req.body.reasonToCancel;
  }

  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

  // ---- CODES FOR LOG END HERE   --- //
  
  return res.status(200).json({
    status: "Update successfully",
  });
});

exports.getPendingWfh = catchAsync(async (req, res, next) => {
  let where  = {
        "myWfh.Status": "Pending" 
      }

  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if( req.user.userRole === 'teamLeader') {
    where = { ...where, "user": {$in : req.user.user_leads}};
  }

  let allWfh = await WorkHome.aggregate([
      { $unwind: "$myWfh" },
      { $match: where },
    ]);
  
  const data = await WorkHome.populate(allWfh, { path: "user" });
  if (data.length == 0) {
    return res.status(200).json({
      status: "All W/H Have been Approved.",
    });
  }
  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
  });
});

exports.getWfhDateWise = catchAsync(async (req, res, next) => {
  let myId;
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
  if (req.body.userId) {
    myId = mongoose.Types.ObjectId(req.body.userId);
  }
  const fromDate = req.body.FromDate;
  const toDate = req.body.ToDate;
  const status = req.body.status;

  let where;
  if (myId && fromDate && toDate) {
    where = {
      user: myId,
      $or: [
        {
          "myWfh.FromDate": {
            $gte: new Date(fromDate),
            $lte: new Date(toDate),
          },
        },
        {
          "myWfh.ToDate": {
            $lte: new Date (toDate),
            $gte: new Date (fromDate),
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
          "myWfh.FromDate": {
            $gte: new Date(fromDate) ,
            $lte: new Date(toDate)
          },
        },
        {
          "myWfh.ToDate": {
            $lte: new Date(fromDate),
            $gte: new Date(toDate),
          },
        },
      ],
    };
  }
  if (status == "all") {
    if (where !== undefined) {
      delete where["myWfh.Status"];
    } else {
      where = {};
    }
  }

  if (status !== "all" && status !== undefined) {
    where = { ...where, "myWfh.Status": status };
  }

  if(req.user.userRole === 'teamLeader') {
    if(req.user.user_leads.length >= 0 && !myId) {
      where = { ...where, "user": {$in : req.user.user_leads} };
    }
  }
  const wfhDateWise = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    { $match: where },
  ]);


  const data = await WorkHome.populate(wfhDateWise, {
    path: "user",
    select: { name: 1 },
  });

  return res.status(200).json({
    status: "success",
    total: data.length,
    data: data,
  });
});

///////==== API RESTRICT TO  ADMIN ====////

exports.getAllWfhMonthWise = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
  var dateObj = new Date(req.body.year, req.body.month);

  var month = dateObj.getUTCMonth();
  var year = dateObj.getUTCFullYear();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month, 31));

  const data = await WorkHome.find().populate("user");
  
  let userIds = [];
  data.forEach((element) => {
    req.body.branchId.forEach((branchId,index)=>{
      if (element.user !== null && element.user.branch_id == req.body.branchId[index]) {
        userIds.push(element.user._id);
      }
    })
  });
 
 const allWfhs = await WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        user: { $in: userIds },
        $or: [
          {
            "myWfh.FromDate": {
              $gte: new Date(from),
              $lte: new Date(to),
            },
          },
          {
            "myWfh.ToDate": {
              $lte: new Date(to),
              $gte: new Date(from),
            },
          },
        ]
      },
    },
  ]);
 
  const allWfh = await WorkHome.populate(allWfhs, {
    path: "user",
    select: { name: 1 },
  });
  return res.status(200).json({
    status: "success",
    total: allWfh.length,
    data: allWfh,
  });
});