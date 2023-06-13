const catchAsync = require("../utils/catchAsync");
const Log = require("../model/LogModel");
const AppError = require("../utils/appError");
const mongoose = require("mongoose");
const moment = require("moment");

exports.allLogs = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;
  
  let allLogs = await Log.aggregate( [

    {$lookup:{
             from: 'users',
             localField: 'employeeId',
             foreignField: '_id',
             as: 'info',
             pipeline: [
                { $project:{
                    _id:0,
                    "employeeName": "$name",
                    "employeeEmail": "$email",
                } } 
            ]
         },    
    },   
    {
      $replaceRoot: { newRoot: { $mergeObjects: [ { $arrayElemAt: [ "$info", 0 ] }, "$$ROOT" ] } }
    },
    { $sort:{createdAt:-1}},
    { $project: { info: 0 } },
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: pageSize * (page-1) }, { $limit: pageSize }],
      },
    },
 ] )

 /*  let allLogs = await Log.find({}).limit(pageSize).skip(pageSize * (page-1)); */

  if (!allLogs) {
    return next(new AppError("Records Not Avialable", 404));
  }

  return res.status(200).json({
        status: "success",
        message: "Data Fetched Successfully",
        total: allLogs[0].metaData[0].total,
        data:allLogs[0].records
        
  });

});

exports.logDetails = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  let logDetails = await Log.find({
    employeeId:req.params.id,
    createdAt: {
      $gte: req.body.fromDate,
      $lte: req.body.toDate
    }
  });
  
  if (!logDetails.length) {
    return next(new AppError("requested log does not exists", 404));
  }

  return res.status(200).json({
      status: "success",
      message: "Data Fetched Successfully",
      data:logDetails
  });

});

exports.filterLogInfo = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  if(req.body.hasOwnProperty("fromDate")) {
    if(!req.body.hasOwnProperty("toDate"))
    {
    return next(new AppError("Please Select To Date ",404));
   }
  }

  if(req.body.hasOwnProperty("toDate")) {
    if(!req.body.hasOwnProperty("fromDate"))
    {
    return next(new AppError("Please Select From Date",404));
   }
  }

  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;

  var where = parametercondition(req.body);

  let allLogs = await Log.aggregate( [

    {$lookup:{
             from: 'users',
             localField: 'employeeId',
             foreignField: '_id',
             as: 'info',
             pipeline: [
                { $project:{
                    _id:0,
                    "employeeName": "$name",
                    "employeeEmail": "$email",
                } } 
            ]
         },    
    },
    {
      $replaceRoot: { newRoot: { $mergeObjects: [ { $arrayElemAt: [ "$info", 0 ] }, "$$ROOT" ] } }
    },
    {
      $match:where
    },
    { $sort:{createdAt:-1}},
    { $project: { info: 0} },
    {
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: pageSize * (page-1) }, { $limit: pageSize }],
      },
    },
 ] )

 if (!allLogs) {
  return next(new AppError("Records Not Avialable", 404));
}

return res.status(200).json({
      status: "success",
      message: "Data Fetched Successfully",
      total: allLogs.length>0?allLogs[0].metaData.length>0?allLogs[0].metaData[0].total:'':'',
      data:allLogs.length>0?allLogs[0].records:allLogs
      
});

});

function parametercondition(body) {
  const {admin_id,user_id,fromDate,toDate} = body;
  let where;
  if(admin_id && user_id && fromDate && toDate){
    where = {
      "admin_id":mongoose.Types.ObjectId(admin_id),
      "employeeId":mongoose.Types.ObjectId(user_id),
      "createdAt": {
        $gte: new Date(new Date(fromDate).setHours(00, 00, 00)),
        $lte: new Date(new Date(toDate).setHours(23, 58, 00))
      }
    }
  }else if(admin_id && user_id){
    where = {
      "admin_id":mongoose.Types.ObjectId(admin_id),
      "employeeId":mongoose.Types.ObjectId(user_id)
    }
  }else if(user_id && fromDate && toDate){
    where = {
      "employeeId":mongoose.Types.ObjectId(user_id),
      "createdAt": {
        $gte: new Date(new Date(fromDate).setHours(00, 00, 00)),
        $lte: new Date(new Date(toDate).setHours(23, 58, 00))
      }
    }
  }else if(admin_id && fromDate && toDate){
    where = {
      "admin_id":mongoose.Types.ObjectId(admin_id),
      "createdAt": {
        $gte: new Date(new Date(fromDate).setHours(00, 00, 00)),
        $lte: new Date(new Date(toDate).setHours(23, 58, 00))
      }
    }

  }else if(fromDate && toDate){
    where = {
      "createdAt": {
        $gte: new Date(new Date(fromDate).setHours(00, 00, 00)),
        $lte: new Date(new Date(toDate).setHours(23, 58, 00))
      }
    }
  }else if(admin_id){
    where = {
      "admin_id":mongoose.Types.ObjectId(admin_id)
    }
  }else if(user_id){
    where = {
      "employeeId":mongoose.Types.ObjectId(user_id)
    }
  }else{
    where = {}
  }

  return where;
}