const mongoose = require("mongoose");
const User = require("../model/UserModel");
const Leave = require("../model/LeaveModel");
const WorkHome = require("../model/WorkHomeModel");
const Email = require("../utils/email");
var dateFormat = require("dateformat");
const Constant = require("../utils/constant");
const moment = require("moment");
const constant = require("../utils/constant");
const LeaveEmail = require("../utils/leaveEmail");
const XLSX = require("xlsx");
const path = require("path");
const {offenceCount} = require("../utils/helper");
const allUserWorkingHours = require("../utils/allUserWorkingHours");
const fs = require('fs');

const attendanceschema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },
  branch_id: {
    type: mongoose.Schema.ObjectId,
    ref: "branch",
    default: null,
  },
  attendanceMember: {
    type: Number,
    default: 0,
  },
  myAttendance: [
    {
      type: {
        type: String,
        enum: ["inTime", "outTime"],
      },
      inTime: {
        type: String,
      },
      outTime: {
        type: String,
      },
      dateIn: {
        type: Date,
        default: Date.now(),
      },
      dateOut: {
        type: Date,
        default: "",
      },
      createdAt: {
        type: Date,
        default: Date.now(),
      },
      totalWorkingHours: {
        type: String,
      },
      isIpUnique: {
        type: Boolean,
        default: true,
      },
      outIpUnique: {
        type: Boolean,
        default: true,
      },
      inIpAddress: {
        type: String,
        default: "",
      },
      outIpAddress: {
        type: String,
        default: "",
      },
    },
  ],
});

const Attendance = mongoose.model("attendance", attendanceschema);

module.exports = Attendance;

module.exports.AttendanceLeave = async function () {

  let today = moment().format("YYYY-MM-DD");
  let tomorrow  = moment().add(1,'days').format("YYYY-MM-DD");
  

  return new Promise(async (resolve, reject) => {
    //------ SEARCHING FOR ALL USESR ----- //
    const allUser = await User.find({
      userRole: ["user", "teamLeader"],
      active: true,
      isBlackListed: false,
    });

    //------ ON HOLIDAYS/WEEKAND ---------- //
    const attendanceUser = await attendaceData(today, tomorrow);
    if (attendanceUser.length > 10) {
      
    //------ TODAY'S USER ATTENDANCE ----- //
    for (let userId of allUser) {
      const userList = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        {
          $match: {
            user: userId._id,
            $and: [
              {
                "myAttendance.dateOut": {
                  $gte: new Date(today),
                  $lt: new Date(tomorrow),
                },
              },
            ],
          },
        },
        {
          $project: {
            user: 1,
          },
        },
      ]);
                //If Today User has not filled Attendance.
      if (userList.length == 0) {
          console.log("UserList--->",userList);
        //------ CHECK IN TODAY'S USER LEAVE ----- //
        const leave = await leaveData(today, userId._id);
        console.log("leave cron attend--->",leave);
        //------ CHECK IN TODAY'S USER WORKHOME ----- //
        const wfh = await wfhData(today, userId._id);
        console.log("wfh attend--->",wfh);
        let leaderEmail = [];
        const leader = await User.find(
          { _id: userId.leader },
          { email: 1, _id: 0 }
        );
        if (leader) {
          leaderEmail = leader.map((x) => x.email);
        }
        leaderEmail.push("hr@softrefine.com");
        let obj = {
          Subject: "Full Leave",
          Status: "Approved",
          Purpose: "Attendance Not Fill",
          FromDate: dateFormat(today, "yyyy-mm-dd"),
          ToDate: dateFormat(today, "yyyy-mm-dd"),
          createdAt: dateFormat(today, "yyyy-mm-dd"),
          adminEmail: leaderEmail,
        };
        let myUser;
        let half=false;
        if (wfh.length == 0 && leave.length == 0) { 
            myUser = await Leave.find({ user: mongoose.Types.ObjectId(userId._id) });
        } else if (wfh.length > 0) {
          if((wfh[0].myWfh.Subject === "Half Day") && leave.length == 0) {
            myUser = await Leave.find({ user: mongoose.Types.ObjectId(userId._id) });
            half=true;
          }
        } else if (leave.length > 0) {
          if((leave[0].myLeave.Subject === "Half Leave") && wfh.length == 0) {
            myUser = await Leave.find({ user: mongoose.Types.ObjectId(userId._id) });
            half=true;
          }
        }
        if(myUser) {
             if(half){
              obj.Subject= "Half Leave";
             }
          if (myUser && myUser.length > 0) {
            newLeave = await Leave.findOneAndUpdate(
              { user: userId._id },
              {
                $push: {
                  myLeave: obj,
                },
              },
              { new: true }
            ).populate("user");
          } else {
            let leaves = await Leave.create({
              user: userId._id,
              myLeave: [obj],
            });
          }
          const deductleave = half ? 0.5 :1;
          const userxyz = await User.findOneAndUpdate(
            { _id: userId._id },
            {
              used_leave: userId.used_leave + deductleave,
              alloted_leave: userId.alloted_leave - deductleave,
            }
          );
          //------ SENDING E-MAIL ----- //
          await new Email(userId, obj, "applyLeave").send(
            "leave",
            userId.name +
              " Leave Request (" +
              obj.FromDate +
              " To " +
              obj.ToDate +
              ")"
          );
          await new Email(userId, obj, "updateLeaveByAdmin").sendApprove(
            "leaveApproved",
            "Approved Leave"
          );
   
          await offenceCount("attendanceNotFill",userId._id,userId.branch_id);
        }
      }
    }
    }
  });
  
  
};

module.exports.isIpUnique = async function () {
  const today = new Date();
  console.log("today-tomorrow-->",new Date(new Date(today).setHours(00, 00, 00)));
  console.log("tomorrow-->",new Date(new Date(today).setHours(23, 58, 00)));

  return new Promise(async (resolve, reject) => {
    const todayAttendance = await Attendance.aggregate([
      { $unwind: "$myAttendance" },
      {
        $match: {
          "myAttendance.createdAt": {
            $gte: new Date(new Date(today).setHours(00, 00, 00)),
            $lt: new Date(new Date(today).setHours(23, 58, 00)),
          },
        },
      },
      {
        $project: {
          branch_id: 1,
          "myAttendance.inIpAddress": 1,
          "myAttendance.outIpAddress": 1,
          "myAttendance._id": 1,
          attendanceMember: 1,
        },
      },
    ]);

    const results = todayAttendance.reduce(function (results, org) {
      (results[org.branch_id] = results[org.branch_id] || []).push(org);
      return results;
    }, {});

    // Object.keys(results).forEach(async (attend) => {
    for (let attend of Object.keys(results)) {
      let ipArr = [];
      let outIpArr = [];
      let findMaxIp;
      let findMaxOutIp;
      results[attend].forEach(async (attendance) => {
        ipArr.push(attendance.myAttendance.inIpAddress);
        if(
          attendance.myAttendance.outIpAddress != "" ||
          attendance.myAttendance.outIpAddress != null
        ){
          outIpArr.push(attendance.myAttendance.outIpAddress);
        }
      });
      findMaxIp = await Constant.findMaxIpAddress(ipArr);
      if (outIpArr.length > 0) {
        findMaxOutIp = await Constant.findMaxIpAddress(outIpArr);
      }
      results[attend].forEach(async (attendance1) => {
        //--- Out IpAddress check ---//
        if (outIpArr.length > 0) {
          if (findMaxOutIp.maxCount >= attendance1.attendanceMember) {
            if (
              attendance1.myAttendance.outIpAddress !== findMaxOutIp[0]["ip"]
            ) {
              await Attendance.updateOne(
                { "myAttendance._id": attendance1.myAttendance._id },
                {
                  $set: { "myAttendance.$.outIpUnique": false },
                }
              );
            }
          } else {
            await Attendance.updateOne(
              { "myAttendance._id": attendance1.myAttendance._id },
              {
                $set: { "myAttendance.$.outIpUnique": false },
              }
            );
          }
        }

        //--- In IpAddress check ---//
        if (ipArr.length > 0) {
          if (findMaxIp.maxCount >= attendance1.attendanceMember) {
            if (attendance1.myAttendance.inIpAddress !== findMaxIp[0]["ip"]) {
              await Attendance.updateOne(
                { "myAttendance._id": attendance1.myAttendance._id },
                {
                  $set: { "myAttendance.$.isIpUnique": false },
                }
              );
            }
          } else {
            await Attendance.updateOne(
              { "myAttendance._id": attendance1.myAttendance._id },
              {
                $set: { "myAttendance.$.isIpUnique": false },
              }
            );
          }
        }
        const userAttend = await Attendance.aggregate([
          {$unwind:"$myAttendance"},
          {$match:
            {
              _id:mongoose.Types.ObjectId(attendance1._id),
              "myAttendance.dateOut": {
                $gte: new Date(new Date(today).setHours(00, 00, 00)),
                $lt: new Date(new Date(today).setHours(23, 58, 00)),
              },
            },
          }
        ])
        // console.log("userAtte",userAttend);
        if(userAttend.length > 0 && userAttend[0].myAttendance.isIpUnique === false && userAttend[0].myAttendance.outIpUnique === false) {
          //---------create Half Leave to User Leave Document-----//
          let obj = {
            Subject: "Half Leave",
            Status: "Approved",
            Purpose: "You have fill Attendance From a Different Network.",
            FromDate: dateFormat(today, "yyyy-mm-dd"),
            ToDate: dateFormat(today, "yyyy-mm-dd"),
            createdAt: dateFormat(today, "yyyy-mm-dd"),
            adminEmail: "hr@softrefine.com",
          };
          await createUserLeave(obj,userAttend[0].user);
        
          await offenceCount("outofNetworkIp",userAttend[0].user,userAttend[0].branch_id);
        }
      });
    }
  });
};

module.exports.dailyWorkingHours = async function () {
  let today = moment().format("YYYY-MM-DD");
  let tomorrow  = moment().add(1,'days').format("YYYY-MM-DD");

  // console.log("Today Daily Working Hour--->",today);
  let userAttend = await User.find({isBlackListed: false, active: true, userRole: ["user", "teamLeader"], dayFlag:true})
  let userListArr = [];
  //  console.log("userAttend--->",userAttend);
  for(let user of userAttend) {
    //------ CHECK IN TODAY'S USER LEAVE ----- //
    const leaveList = await constant.leaveUserPayloadActive(today,tomorrow, user._id);
    let leave = await Leave.aggregate([
      { $unwind: "$myLeave" },
      {
        $match: leaveList,
      },
      {
        $project: {
          myLeave: 1,
        },
      },
    ]);
    // console.log("leave--->",leave);
    //------ CHECK IN TODAY'S USER WORKHOME ----- //
    const wfhList = await constant.wfhUserPayloadActive(today,tomorrow, user._id);
    let wfh = await WorkHome.aggregate([
      { $unwind: "$myWfh" },
      {
        $match: wfhList,
      },
      {
        $project: {
          myWfh: 1,
        },
      },
    ]);
    // console.log("wfh--->",wfh);
    if (leave.length == 0 && wfh.length == 0) {
      let userAttendance = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        {
          $match: {
            user: mongoose.Types.ObjectId(user._id),
            "myAttendance.dateOut": {
              $gte: new Date(today),
              $lt: new Date(tomorrow)
            },
          },
        },
      ]);
      // console.log("userAttendance--->",userAttendance);
      const userData = await Attendance.populate(userAttendance, {
        path: "user",
        select: { name: 1 },
      });
      userListArr = userListArr.concat(userData);
      for (let element of userAttendance){
        element.myAttendance.createdAt = dateFormat(element.myAttendance.createdAt, "dd-mm-yyyy");
      }

      //---------create Half Leave to User Leave Document-----//
      let obj = {
        Subject: "Half Leave",
        Status: "Approved",
        Purpose: "Daily Working Hours Is Not Completed.",
        FromDate: dateFormat(today, "yyyy-mm-dd"),
        ToDate: dateFormat(today, "yyyy-mm-dd"),
        createdAt: dateFormat(today, "yyyy-mm-dd"),
        adminEmail: "hr@softrefine.com",
      };
      await createUserLeave(obj,user._id);
      await offenceCount("dailyworkingHours",user._id,user.branch_id);
    }
  }
  // console.log("userListArr--->",userListArr);
  // --- Email Obj and Email Multiple recipient ---//
  const adminUser = await User.find({ userRole: "admin",active:true,isBlackListed:false }, { email: 1 });
  const adminEmails = adminUser.map((x) => x.email);

  if (userListArr.length > 0) {
   //------ SENDING E-MAIL ----- //
   await new LeaveEmail(
     adminEmails,
     userListArr,
     "dailyWorkingHours"
   ).sendDailyHours(
     "dailyHours",
     "Daily Working Hours Details"
   );
  }
};

function deleteExportUser(filePath) {
  setTimeout(() => {
    try {
      let fileexist= fs.existsSync(path.join(__dirname, "..",filePath));
      if(fileexist){
        const file= fs.unlinkSync(path.join(__dirname,"..",filePath));
      }
    } catch (err) {
      return err;
    }
  }, 5000);
}

module.exports.weeklyWorkingHoursSheet = async function () {
  const today = new Date();
    let halfLeaveCount = 0;
    let halfWfhCount = 0;
    const start = new Date(today);
    start.setDate(start.getDate() - 5);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    let   userListArr = [];

    const users = await User.find(
      { isBlackListed: false, active: true, userRole: ["user", "teamLeader"] },
      {
        dailyHoursFlag: 1,
        name: 1,
        email: 1,
        used_leave: 1,
        alloted_leave: 1,
        leader: 1,
        weeklyHoursFlag: 1,
      }
    );
    // --- Email Obj and Email Multiple recipient ---//
    const adminUser = await User.find({ userRole: "admin",active:true,isBlackListed:false }, { email: 1 });
    const adminEmails = adminUser.map((x) => x.email);
    var data = [];
    for (let userData of users) {
      let userAttendance = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        {
          $match: {
            user: mongoose.Types.ObjectId(userData._id),
            "myAttendance.dateOut": {
              $gte: new Date(new Date(start).setHours(00, 00, 00)),
              $lt: new Date(new Date(end).setHours(23, 58, 00)),
            },
          },
        },
      ]);
      let userWeek = await Attendance.populate(userAttendance, {
        path: "user",
        select: { name: 1 },
      });
      const WorkingDays = userAttendance.map(
        (x) => x.myAttendance.totalWorkingHours
      );
      const sum = WorkingDays.reduce(
        (acc, time) => acc.add(moment.duration(time)),
        moment.duration()
      );
      let totalWorkingHoursinString = [
        pad(Math.floor(sum.asHours())),
        pad(sum.minutes()),
      ].join(":");
     let totalWorkingHours = minuteConverter(totalWorkingHoursinString);
      //------ CHECK IN USER LEAVE ----- //
      let leavePayload = await constant.leaveUserPayload(
        start,
        end,
        userData._id
      );
      let allLeaves = await Leave.aggregate([
        { $unwind: "$myLeave" },
        {
          $match: leavePayload,
        },
        {
          $project: {
            myLeave: 1,
          },
        },
      ]);

      if (allLeaves.length > 0) {
        for (let leave of allLeaves) {
          if (
            leave.myLeave.Status === "Approved" ||
            leave.myLeave.Status === "Pending"
          ) {
            const days = await constant.getBusinessDatesCount(
              leave.myLeave.FromDate,
              leave.myLeave.ToDate
            );
            halfLeaveCount += days / 2;
          }
        }
      }

      //------ CHECK IN USER WORKHOME ----- //
      let wfhData = await constant.wfhUserPayload(start, end, userData._id);
      wfhPayload = wfhData;
      let allWfhs = await WorkHome.aggregate([
        { $unwind: "$myWfh" },
        {
          $match: wfhPayload,
        },
        {
          $project: {
            myWfh: 1,
          },
        },
      ]);

      if (allWfhs.length > 0) {
        for (let wfh of allWfhs) {
          if (
            wfh.myWfh.Status === "Approved" ||
            wfh.myWfh.Status === "Pending"
          ) {
            const day = await constant.getBusinessDatesCount(
              wfh.myWfh.FromDate,
              wfh.myWfh.ToDate
            );
            halfWfhCount += day / 2;
          }
        }
      }
      const totalDays = WorkingDays.length - (halfLeaveCount + halfWfhCount);
      let totalHour = totalDays * 9;
      if(userWeek.length > 0) {
      userListArr.push({totalHour:totalHour,totalWorkingHours:totalWorkingHoursinString,userWeek})
        await User.findByIdAndUpdate(
          { _id: userData._id },
          { $inc: { weeklyHoursFlag: 1 } },
          { new: true}
        );
      }
      data.push([userWeek[0].user.name,totalHour,totalWorkingHours]);
    }
    
    if(userListArr.length > 0) { 
      const workSheetColumnNames = ["name","TotalHours","TotalWorkingHours"];
      const workSheetName = 'UserListing';
      var filePath = './usersworkinghours.xlsx';
      const workBook = new XLSX.utils.book_new();
      const workSheetData = [ 
          workSheetColumnNames,
          ...data
      ]; 
      await deleteExportUser(filePath); 
      const workSheet = XLSX.utils.json_to_sheet(workSheetData,{skipHeader: true});
      workSheet["!cols"] = [{wch:20},{wch:10},{wch:15}];
      XLSX.utils.book_append_sheet(workBook,workSheet);
      XLSX.writeFile(workBook, path.resolve(filePath));
      const weekofMonth = (moment().week() - (moment().month()*4));
      const monthYear = moment().format('MMMM YYYY');
      var weekofMonthSuffix = getNumberSuffix(weekofMonth);
      const Mailtitle = weekofMonthSuffix+" "+'week'+","+monthYear;
        /* Sending Sheet Of All Users Working Hours*/
        await new allUserWorkingHours(adminEmails).sendAllUserWorkingHoursSheet(filePath,
          `${Mailtitle} All Users Working Hours`,
        );
    }
};

function getNumberSuffix(temp){
  const th = 'th'
  const rd = 'rd'
  const nd = 'nd'
  const st = 'st'

    switch (temp) {
      case '1': return temp+st
      case '2': return temp+nd
      case '3': return temp+rd
      default:  return temp+th
    }
}            

module.exports.weeklyWorkingHours = async function () {
  const today = new Date();
    let halfLeaveCount = 0;
    let halfWfhCount = 0;
    const start = new Date(today);
    start.setDate(start.getDate() - 5);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    let userListArr = [];

    const users = await User.find(
      { isBlackListed: false, active: true, userRole: ["user", "teamLeader"] },
      {
        dailyHoursFlag: 1,
        name: 1,
        email: 1,
        used_leave: 1,
        alloted_leave: 1,
        leader: 1,
        weeklyHoursFlag: 1,
        branch_id:1
      }
    );

    // --- Email Obj and Email Multiple recipient ---//
    const adminUser = await User.find({ userRole: "admin",active:true,isBlackListed:false }, { email: 1 });
    const adminEmails = adminUser.map((x) => x.email);

    for (let userData of users) {
      let userAttendance = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        {
          $match: {
            user: mongoose.Types.ObjectId(userData._id),
            "myAttendance.dateOut": {
              $gte: new Date(new Date(start).setHours(00, 00, 00)),
              $lt: new Date(new Date(end).setHours(23, 58, 00)),
            },
          },
        },
      ]);
      let userWeek = await Attendance.populate(userAttendance, {
        path: "user",
        select: { name: 1 },
      });
      const WorkingDays = userAttendance.map(
        (x) => x.myAttendance.totalWorkingHours
      );
      const sum = WorkingDays.reduce(
        (acc, time) => acc.add(moment.duration(time)),
        moment.duration()
      );
      let totalWorkingHoursinString = [
        pad(Math.floor(sum.asHours())),
        pad(sum.minutes()),
      ].join(":");
     let totalWorkingHours = minuteConverter(totalWorkingHoursinString);
      //------ CHECK IN USER LEAVE ----- //
      let leavePayload = await constant.leaveUserPayload(
        start,
        end,
        userData._id
      );
      let allLeaves = await Leave.aggregate([
        { $unwind: "$myLeave" },
        {
          $match: leavePayload,
        },
        {
          $project: {
            myLeave: 1,
          },
        },
      ]);

      if (allLeaves.length > 0) {
        for (let leave of allLeaves) {
          if (
            leave.myLeave.Status === "Approved" ||
            leave.myLeave.Status === "Pending"
          ) {
            const days = await constant.getBusinessDatesCount(
              leave.myLeave.FromDate,
              leave.myLeave.ToDate
            );
            halfLeaveCount += days / 2;
          }
        }
      }

      //------ CHECK IN USER WORKHOME ----- //
      let wfhData = await constant.wfhUserPayload(start, end, userData._id);
      wfhPayload = wfhData;
      let allWfhs = await WorkHome.aggregate([
        { $unwind: "$myWfh" },
        {
          $match: wfhPayload,
        },
        {
          $project: {
            myWfh: 1,
          },
        },
      ]);

      if (allWfhs.length > 0) {
        for (let wfh of allWfhs) {
          if (
            wfh.myWfh.Status === "Approved" ||
            wfh.myWfh.Status === "Pending"
          ) {
            const day = await constant.getBusinessDatesCount(
              wfh.myWfh.FromDate,
              wfh.myWfh.ToDate
            );
            halfWfhCount += day / 2;
          }
        }
      }
      const totalDays = WorkingDays.length - (halfLeaveCount + halfWfhCount);
      let totalHour = totalDays * 9;
      
      if(userWeek.length > 0 && totalHour > totalWorkingHours) {
      await offenceCount("weeklyWorkingHours",userData._id,userData.branch_id);
      userListArr.push({totalHour:totalHour,totalWorkingHours:totalWorkingHoursinString,userWeek})
        await User.findByIdAndUpdate(
          { _id: userData._id },
          { $inc: { weeklyHoursFlag: 1 } },
          { new: true}
        );
      }
    }
    if(userListArr.length > 0) {
        //------ SENDING E-MAIL ----- //
        await new LeaveEmail(
          adminEmails,
          userListArr,
          "weeklyHours"
        ).sendWeeklyHours(
          "weekly_hours",
          "Weekly Hours Details."
        );
    }
};

function minuteConverter(time) {
  const [h, m] = time.split(":");
  const value = +h + +m / 60;
  return value.toFixed(2);
}
function pad(val) {
  return val > 9 ? val : "0" + val;
}

function attendaceData(startDate, endDate) {
  const attendanceUser = Attendance.aggregate([
    { $unwind: "$myAttendance" },
    {
      $match: {
        "myAttendance.createdAt": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
    },
    {
      $project: {
        user: 1,
        myAttendance: 1,
      },
    },
  ]);
  return attendanceUser;
}

function leaveData(date, userId) {
  const leaveUser = Leave.aggregate([
    { $unwind: "$myLeave" },
    {
      $match: {
        user: userId,
        $and: [
          {
            "myLeave.FromDate": {
              $lte: new Date(date),
            },
            "myLeave.ToDate": {
              $gte: new Date(date),
            },
          },
          {
            $or: [
              { "myLeave.Status": "Pending" },
              { "myLeave.Status": "Approved" },
            ],
          },
        ],
      },
    },
  ]);
  return leaveUser;
}

function wfhData(date, userId) {
  const wfhUser = WorkHome.aggregate([
    { $unwind: "$myWfh" },
    {
      $match: {
        user: userId,
        $and: [
          {
            "myWfh.FromDate": {
              $lte: new Date(date),
            },
            "myWfh.ToDate": {
              $gte: new Date(date),
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
  return wfhUser;
}

async function createUserLeave(object, userId) {

  const userLeave = await Leave.findOneAndUpdate(
    { user: mongoose.Types.ObjectId(userId) },
    {
      $push: {
        myLeave: object,
      },
    },
    { new: true,upsert:true }
  ).populate("user");

  await User.findByIdAndUpdate(
    { _id: userLeave.user._id },
    { 
      $inc: { dailyHoursFlag: 1 },
      used_leave: userLeave.user.used_leave + 0.5,
      alloted_leave: userLeave.user.alloted_leave - 0.5,
      dayFlag: false
    },
    { new: true }
  );   
  //------ SENDING E-MAIL To User ----- //
  await new Email(userLeave.user, object, "updateLeaveByAdmin").sendApprove(
    "leaveApproved",
    "Approved Leave"
  );   
}
//
/*
  old cron 
  module.exports.dailyWorkingHours = async function () {
    const today = new Date();
    let userAttend = await User.find({isBlackListed: false, active: true, userRole: ["user", "teamLeader"], dayFlag:true})
  
    for(let user of userAttend) {
      //------ CHECK IN TODAY'S USER LEAVE ----- //
      const leaveList = await constant.leaveUserPayload(today,today, user._id);
      let leave = await Leave.aggregate([
        { $unwind: "$myLeave" },
        {
          $match: leaveList,
        },
        {
          $project: {
            myLeave: 1,
          },
        },
      ]);
      //------ CHECK IN TODAY'S USER WORKHOME ----- //
      const wfhList = await constant.wfhUserPayload(today,today, user._id);
      let wfh = await WorkHome.aggregate([
        { $unwind: "$myWfh" },
        {
          $match: wfhList,
        },
        {
          $project: {
            myWfh: 1,
          },
        },
      ]);

    // --- Email Obj and Email Multiple recipient ---//
    let leaderEmail = [];
    let obj = {};
    const leader = await User.find(
      {
        $or: [
          {userRole:"admin"},
          {_id:user.leader},
        ]
      },
      { email: 1, _id: 0 }
    );
    if (leader) {
      leaderEmail = leader.map((x) => x.email);
    }
    leaderEmail.push("hr@softrefine.com");

    if (leave.length == 0 && wfh.length == 0) {
      // if (user.dailyHoursFlag == 0) {
        await User.findByIdAndUpdate(
          { _id: user._id },
          { $inc: { dailyHoursFlag: 1 } },
          { new: true }
        );
        //------ SENDING E-MAIL ----- //
        await new Email(
          user,
          obj = { adminEmail: leaderEmail},
          "warningForDailyHours"
        ).sendWarning(
          "warning",
          "Daily Working Hours Warning"
        );
      // } 
      else if(user.dailyHoursFlag > 0) {
        obj = {
          Subject: "Half Leave",
          Status: "Approved",
          Purpose: "Daily Working Hours Is Not Completed.",
          FromDate: dateFormat(today, "yyyy-mm-dd"),
          ToDate: dateFormat(today, "yyyy-mm-dd"),
          createdAt: dateFormat(today, "yyyy-mm-dd"),
          adminEmail: leaderEmail,
        };
        await Leave.findOneAndUpdate(
          { user: user._id },
          {
            $push: {
              myLeave: obj,
            },
          },
          { new: true }
        ).populate("user");

        await User.findByIdAndUpdate(
          { _id: user._id },
          {
            dailyHoursFlag: user.dailyHoursFlag + 1,
            used_leave: user.used_leave + 0.5,
            alloted_leave: user.alloted_leave - 0.5,
          },
          { new: true }
        );
        //------ SENDING E-MAIL ----- //
        await new Email(user, obj, "applyLeave").send(
          "leave",
          user.name +
            " Leave Request (" +
            obj.FromDate +
            " To " +
            obj.ToDate +
            ")"
        );
        await new Email(user, obj, "updateLeaveByAdmin").sendApprove(
          "leaveApproved",
          "Approved Leave"
        );
      }
    
    }
  }
}
//----------------/////
module.exports.weeklyWorkingHours = async function () {
  const today = new Date();
    let halfLeaveCount = 0;
    let halfWfhCount = 0;
    const start = new Date(today);
    start.setDate(start.getDate() - 5);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    
    const users = await User.find(
      { isBlackListed: false, active: true, userRole: ["user", "teamLeader"] },
      {
        dailyHoursFlag: 1,
        name: 1,
        email: 1,
        used_leave: 1,
        alloted_leave: 1,
        leader: 1,
        weeklyHoursFlag: 1,
      }
    );

    for (let userData of users) {
      let allAttendance = await Attendance.aggregate([
        { $unwind: "$myAttendance" },
        {
          $match: {
            user: mongoose.Types.ObjectId(userData._id),
            "myAttendance.dateOut": {
              $gte: new Date(start),
              $lt: new Date(end),
            },
          },
        },
      ]);
      const WorkingDays = allAttendance.map(
        (x) => x.myAttendance.totalWorkingHours
      );
      const sum = WorkingDays.reduce(
        (acc, time) => acc.add(moment.duration(time)),
        moment.duration()
      );
      let totalWorkingHours = [
        pad(Math.floor(sum.asHours())),
        pad(sum.minutes()),
      ].join(":");
      totalWorkingHours = minuteConverter(totalWorkingHours);

      //------ CHECK IN USER LEAVE ----- //
      let leavePayload = await constant.leaveUserPayload(
        start,
        end,
        userData._id
      );
      let allLeaves = await Leave.aggregate([
        { $unwind: "$myLeave" },
        {
          $match: leavePayload,
        },
        {
          $project: {
            myLeave: 1,
          },
        },
      ]);

      if (allLeaves.length > 0) {
        for (let leave of allLeaves) {
          if (
            leave.myLeave.Status === "Approved" ||
            leave.myLeave.Status === "Pending"
          ) {
            const days = await constant.getBusinessDatesCount(
              leave.myLeave.FromDate,
              leave.myLeave.ToDate
            );
            halfLeaveCount += days / 2;
          }
        }
      }

      //------ CHECK IN USER WORKHOME ----- //
      let wfhData = await constant.wfhUserPayload(start, end, userData._id);
      wfhPayload = wfhData;
      let allWfhs = await WorkHome.aggregate([
        { $unwind: "$myWfh" },
        {
          $match: wfhPayload,
        },
        {
          $project: {
            myWfh: 1,
          },
        },
      ]);

      if (allWfhs.length > 0) {
        for (let wfh of allWfhs) {
          if (
            wfh.myWfh.Status === "Approved" ||
            wfh.myWfh.Status === "Pending"
          ) {
            const day = await constant.getBusinessDatesCount(
              wfh.myWfh.FromDate,
              wfh.myWfh.ToDate
            );
            halfWfhCount += day / 2;
          }
        }
      }
      const totalDays = WorkingDays.length - (halfLeaveCount + halfWfhCount);
      let totalHour = totalDays * 9;
      // --- Email Obj and Email Multiple recipient ---//
      let leaderEmail = [];
      let obj = {};
      const leader = await User.find(
        {
          $or: [
            {userRole: "admin"},
            {_id:userData.leader}
          ]
        },
        { email: 1, _id: 0 }
      );
      if (leader) {
        leaderEmail = leader.map((x) => x.email);
      }
      leaderEmail.push("hr@softrefine.com");
      
      if (totalHour > totalWorkingHours && userData.weeklyHoursFlag == 0) {
        await User.findByIdAndUpdate(
          { _id: userData._id },
          { $inc: { weeklyHoursFlag: 1 } },
          { new: true}
        );
        //------ SENDING E-MAIL ----- //
        obj = {adminEmail:leaderEmail}
        await new Email(
          userData,
          obj,
          "warningForWeeklyHours"
        ).sendWeeklyWarning(
          "weekly_warning",
          "Weekly Working Hours Warning."
        );
      }
       else if (totalHour > totalWorkingHours && userData.weeklyHoursFlag > 0) {
        obj = {
          Subject: "Full Leave",
          Status: "Approved",
          Purpose: "Weekly Working Hours Is Not Completed.",
          FromDate: dateFormat(today, "yyyy-mm-dd hh:mm:ss"),
          ToDate: dateFormat(today, "yyyy-mm-dd hh:mm:ss"),
          createdAt: dateFormat(today, "yyyy-mm-dd hh:mm:ss"),
          adminEmail: leaderEmail,
        };
        await Leave.findOneAndUpdate(
          { user: userData._id },
          {
            $push: {
              myLeave: obj,
            },
          },
          { new: true }
        ).populate("user");

        await User.findByIdAndUpdate(
          { _id: userData._id },
          {
            weeklyHoursFlag: userData.weeklyHoursFlag + 1,
            used_leave: userData.used_leave + 1,
            alloted_leave: userData.alloted_leave - 1,
          },
          { new: true }
        );
        //------ SENDING E-MAIL ----- //

        await new Email(userData, obj, "applyLeave").send(
          "leave",
          userData.name + " Leave Request (" + obj.FromDate + " To " + obj.ToDate + ")"
        );

        await new Email(userData, obj, "updateLeaveByAdmin").sendApprove(
          "leaveApproved",
          "Approved Leave"
        );
      }
    }
};

*/
//----------///