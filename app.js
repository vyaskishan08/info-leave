const path = require("path");
const express = require("express");
var bodyParser = require("body-parser");
const morgan = require("morgan");
const app = express();
var cors = require("cors");
var cron = require("node-cron");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/ErrorController");
const termRouter = require("./routes/TermsRouter");
const userRouter = require("./routes/UserRouter");
const leaveRouter = require("./routes/LeaveRouter");
const branchRouter = require("./routes/BranchRouter");
const excelRouter = require("./routes/ExcelRouter");
const workHomeRouter = require("./routes/WorkHomeRouter");
const attendanceRouter = require("./routes/AttendanceRouter");
const systeminfoRouter  = require('./routes/SysteminfoRouter');
const loginfoRouter = require('./routes/LogInfoRouter');
const offenceRouter = require('./routes/OffenceCountRouter');

const fs = require("fs");
// const multer = require("multer");
// const XLSX = require("xlsx");

const user = require("./model/UserModel");
const leave = require("./model/LeaveModel");
const workHome = require("./model/WorkHomeModel");
const attendance = require("./model/AttendanceModel");
const constant = require("./utils/constant");

app.use(morgan("dev"));

app.use(express.static('public')); 
app.use('/images', express.static('images'));

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "templates"));

// app.set("view engine", "ejs");
 // app.use(express.static(path.resolve(__dirname, "public")));

app.use(express.json({ limit: "50mb" }));
app.get("/", (req, res) => {
  res.send("Dev App running");
});

//--- get FromData -----//
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({ origin: "*" }));
app.use("/api/v1/user", userRouter);
app.use("/api/v1/leave", leaveRouter);
app.use("/api/v1/branch", branchRouter);
app.use("/api/v1/term", termRouter);
app.use("/api/v1/document", excelRouter);
app.use("/api/v1/workHome", workHomeRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/systeminfo", systeminfoRouter);
app.use("/api/v1/loginfo",loginfoRouter);
app.use("/api/v1/offenceCount",offenceRouter); 

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// --- cronJob Scheduler --- //
cron.schedule("50 23 31 12 *", () => {
  console.log("cronJobEndOfTheYear------");
  user.cronJobEndOfTheYear();
});

cron.schedule("00 00 01 * *", () => {
  console.log("userCreditMonthlyWfh------");
  user.userCreditMonthlyWfh();
});
/*
cron.schedule("59 23 * * *", () => {
  console.log("wfhApproved------");
  workHome.wfhApproved();
});
cron.schedule("40 23 * * *", () => {
  console.log("AttendanceLeave------");
  attendance.AttendanceLeave();
});
*/

cron.schedule("00 00 01 * *", () => {
  console.log("userCreditMonthlyLeave------");
  user.userCreditMonthlyLeave();
});

// cron.schedule("50 23 * * *", () => {
//    attendance.isIpUnique();
//  });

cron.schedule("59 23 * * *", () => {
  console.log("checkBirthDayEvent------");
  user.checkBirthDayEvent();
});

/*
cron.schedule("16 15 * * *", () => {
  console.log("weeklyWorkingHours------");
  attendance.weeklyWorkingHoursSheet();
});


cron.schedule("59 23 * * *", () => {
  console.log("leaveApprove------");
  leave.leaveApprove();
});

cron.schedule("30 23 * * *", () => {
  console.log("dailyWorkingHours------");
  attendance.dailyWorkingHours();
});

cron.schedule("01 12 * * 6", () => {
  console.log("weeklyWorkingHours------");
  attendance.weeklyWorkingHours();
});

cron.schedule("59 23 * * *", () => {
  console.log("onLeaveUsers------");
  leave.onLeaveUsers();
});

cron.schedule('59 23 * * *', () => {
  console.log("DbBackup----");
  constant.databaseBackup();
}); 
*/

// cron.schedule('59 23 28-31 * *', () => {
//   console.log("Employee Summary Mail----");
//   user.userExport();
// });

app.use(globalErrorHandler);
module.exports = app;
