const mongoose = require("mongoose");
const Leave = require("../model/LeaveModel");
const Wfh = require("../model/WorkHomeModel");
const Log = require("../model/LogModel");
const OffenceModel = require("../model/OffenceModel");

async function helpers(id,FromDate,ToDate){
    const userLeave = await Leave.aggregate([
      { $unwind: "$myLeave" },
      {
        $match: {
          user: id,
          $or: [
            {
              "myLeave.FromDate": {
                $gte:new Date( FromDate),
                $lte:new Date( ToDate),
              },
            },
            {
              "myLeave.ToDate": {
                $lte:new Date( ToDate),
                $gte: new Date(FromDate),
              }
            },
          ],
          $and:[
            {
              "myLeave.Subject":{
                $eq:"Half Leave"
              }
            }
          ]
        } 
      },
      {
        $count:"totalLeave"
      }
    ]);
    const wfhLeave = await Wfh.aggregate([
      { $unwind: "$myWfh" },
      {
        $match: {
          user: id,
          $or: [
            {
              "myWfh.FromDate": {
                $gte:new Date( FromDate),
                $lte:new Date( ToDate),
              },
            },
            {
              "myWfh.ToDate": {
                $lte:new Date( ToDate),
                $gte: new Date(FromDate),
              }
            },
          ],
          $and:[
            {
              "myWfh.Subject":{
                $eq:"Half Day"
              }
            }
          ]
        } 
      },
      {
        $count:"totalWfh"
      }
    ]);
    let totalCount = 0;
    if(userLeave.length > 0) {
      totalCount += userLeave[0].totalLeave;
    }
    if(wfhLeave.length > 0) {
      totalCount += wfhLeave[0].totalWfh;
    }
    return totalCount;
  };

  /* Helper function for logupdate*/

async function logupdate(adminName,adminId,adminEmail,logType,payLoad){

  const employeeId = payLoad.employeeId;

  delete payLoad.employeeId;

  const log = new Log({
      admin_id:adminId,
      adminName:adminName,
      adminEmail:adminEmail,
      employeeId:employeeId,
      logType:logType,
      payLoad:payLoad
  
  });

  const logresponse = await log.save();
  return logresponse;
};

async function offenceCount(offenceType,userId,BranchId){
  const year = new Date().getFullYear();
  const offenceExist = await OffenceModel.findOne({user_id:userId,branch_id:BranchId});
  console.log("offenceexist-->",offenceExist);

  if(offenceExist){

    if(!offenceExist.content.hasOwnProperty(year)){
      let offencedata = getMonthWiseData();
      Object.assign(offenceExist.content,offencedata);
      offenceExist.markModified('content');
      await offenceExist.save();
      console.log("offenceupdate-->",offenceExist);  
    }

  }else{
    console.log("in else part--$$");
  let content = getMonthWiseData();

    const offence = new OffenceModel({
      user_id:userId,
      branch_id:BranchId,
      content
    });
  
    const offenseres = await offence.save();
  
  }
  const month = new Date().toLocaleString('en-us',{month:'short'});

  let offenceincremnet = {
    [`content.${year}.$[month].${offenceType}`]: 1 
  }

    await OffenceModel.findOneAndUpdate(
    {
      user_id:mongoose.Types.ObjectId(userId),
      branch_id:mongoose.Types.ObjectId(BranchId),   
      [`content.${year}`]: { $exists: true } 
    },
    { $inc: offenceincremnet
    },
    { 
      arrayFilters: [
        { "month.month": month }
      ],
    });

    console.log("Operation Successfully in point Updation");

}

function getMonthWiseData(){
    return  offencedata = {
      [new Date().getFullYear()]: [{
        dailyworkingHours:0,
        outofNetworkIp:0,
        weeklyWorkingHours:0,
        attendanceNotFill:0,
        attendanceUpdate:0,
        month:'Jan', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Feb', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Mar', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Apr', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'May', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Jun', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Jul', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Aug', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Sep', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Oct', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Nov', 
        },
        {
          dailyworkingHours:0,
          outofNetworkIp:0,
          weeklyWorkingHours:0,
          attendanceNotFill:0,
          attendanceUpdate:0,
          month:'Dec', 
        }
     ] }
}

module.exports ={
  helpers,logupdate,offenceCount
}