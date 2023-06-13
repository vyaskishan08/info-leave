const User = require("../model/UserModel");
const Excel = require("../model/ExcelModel");
const catchAsync = require("../utils/catchAsync");
const XLSX = require("xlsx");
var request = require("request");
const AppError = require("../utils/appError");
const html_to_pdf = require("html-pdf-node");
let path = require("path");
var fs = require("fs");
const SalarySlip = require("../model/SalarySlipModel");
const puppeteer = require("puppeteer");
var dateFormat = require("dateformat");
const moment = require("moment");

// ---- API RESTRICT TO ADMIN --- //

//------ Import Excel  Api----//

exports.importExcel = catchAsync(async (req, res, next) => {
  var filePath = req.body.url;
  
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const slipData = await request(
    { url: filePath, encoding: null },
    function (err, resp, file) {
      var workbook = XLSX.read(file);
      const data = workbook.Sheets[workbook.SheetNames[0]];
      const sheetData = XLSX.utils.sheet_to_json(data);
      var userEmail;
      let excelData;
      sheetData.forEach(async (userData) => {
        userEmail = userData.email;
        const oldUser = await User.findOne({ email: userData.email });
        if (oldUser) {
          // return next(new AppError("User not found", 404));
          const excelUser = await Excel.findOne({ user: oldUser._id });
          if (excelUser) {
            excelData = await Excel.findOneAndUpdate(
              { user: oldUser._id },
              {
                $push: {
                  SalarySlipBunch: [userData],
                },
              },
              { new: true }
            );
          } else {
            excelData = Excel.create({
              user: oldUser._id,
              SalarySlipBunch: [userData],
            });
          }
        }
      });
      const slip = SalarySlip.create({
        url: filePath,
        fileName: req.body.fileName,
      });
      return res.status(200).json({
        status: "Data insert successfully.",
      });
    }
  );
});

//------ Download Excel  Api----//

exports.downloadExcel = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const excelUser = await Excel.findOne({ user: { $eq: req.body.user } });
  if (!excelUser) {
    return next(new AppError("Slip Not Found For This Selected User", 404));
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox"],
  });

  // create a new page
  const page = await browser.newPage();

  const excelSlip = await Excel.findOne(
    {
      user: excelUser.user,
      "SalarySlipBunch.salaryMonth": req.body.salaryMonth,
    },
    { "SalarySlipBunch.$": 1 }
  );
  if (!excelSlip) {
    return next(new AppError("Slip Not Found For This Selected Month.", 404));
  }
  let salaryMonthFormat;
  if(excelSlip.SalarySlipBunch[0].salaryMonth) {
    let salaryMSplit = excelSlip.SalarySlipBunch[0].salaryMonth.split('-');
    salaryMonthFormat = moment(new Date(salaryMSplit[1] + '-' + salaryMSplit[0] + "-01")).format("MMM yyyy");
  }

  let joiningDateFormat;
  if(excelSlip.SalarySlipBunch[0].joiningDate) {
    let joiningDateSplit = excelSlip.SalarySlipBunch[0].joiningDate.split('.');
    joiningDateFormat = moment(new Date(joiningDateSplit[2] + '-' + joiningDateSplit[1] + '-' + joiningDateSplit[0])).format("Do MMM yyyy");
  }

  let salaryPaidOn;
  if(excelSlip.SalarySlipBunch[0].salaryPaidOn) {
    let salaryPaidOnSplit = excelSlip.SalarySlipBunch[0].salaryPaidOn.split('.');
    salaryPaidOn = moment(new Date(salaryPaidOnSplit[2] + '-' + salaryPaidOnSplit[1] + '-' + salaryPaidOnSplit[0])).format("Do MMM yyyy");
  }
 

  var html = fs.readFileSync("salary-slip.html", "utf8");
 
  html = html
    .split("[SALARYMONTH]")
    .join(salaryMonthFormat);
  html = html.split("[NAME]").join(excelSlip.SalarySlipBunch[0].name);
  html = html
    .split("[BANKACCOUNTNO]")
    .join(excelSlip.SalarySlipBunch[0].bankAccNo);
  html = html
    .split("[DESIGNATION]")
    .join(excelSlip.SalarySlipBunch[0].designation);
  html = html.split("[BANKNAME]").join(excelSlip.SalarySlipBunch[0].bankName);
  html = html
    .split("[JOININGDATE]")
    .join(joiningDateFormat);
  html = html
    .split("[SALARYPAIDON]")
    .join(salaryPaidOn);
  html = html.split("[BASICPAY]").join(excelSlip.SalarySlipBunch[0].basicPay);
  html = html 
    .split("[HOUSERENTALLOWANCE]")
    .join(excelSlip.SalarySlipBunch[0].houseRentAllowance);
  html = html
    .split("[CONVEYANCEALLOWANCE]")
    .join(excelSlip.SalarySlipBunch[0].conveyanceAllowance);
  html = html
    .split("[MEDICALALLOWANCE]")
    .join(excelSlip.SalarySlipBunch[0].medicalAllowance);
  html = html
    .split("[SPECIALALLOWANCE]")
    .join(excelSlip.SalarySlipBunch[0].specialAllowance);  
  html = html
    .split("[TAXDEDUCTED]")
    .join(excelSlip.SalarySlipBunch[0].taxDeducted);
  html = html
    .split("[PROFESSIONALTAX]")
    .join(excelSlip.SalarySlipBunch[0].professionalTax);
  html = html
    .split("[PROVIDENTFUND]")
    .join(excelSlip.SalarySlipBunch[0].providentFund);
  html = html
    .split("[ADVANCEADJUSTMENT]")
    .join(excelSlip.SalarySlipBunch[0].advanceAdjustment);
  html = html
    .split("[OTHERDEDUCTIONS]")
    .join(excelSlip.SalarySlipBunch[0].otherDeductions);

  html = html
    .split("[GROSSSALARY]")
    .join(excelSlip.SalarySlipBunch[0].grossSalary);
  html = html
    .split("[TOTALDEDUCTIONS]")
    .join(excelSlip.SalarySlipBunch[0].totalDeductions);
  html = html.split("[NETSALARY]").join(excelSlip.SalarySlipBunch[0].netSalary);
  html = html
    .split("[ARREARSPAID]")
    .join(excelSlip.SalarySlipBunch[0].arrearsPaid);
  html = html
    .split("[TOTALSALARY]")
    .join(excelSlip.SalarySlipBunch[0].totalSalary);
    html = html
    .split("[WORKDAY]")
    .join(excelSlip.SalarySlipBunch[0].workDays);
    html = html
    .split("[ABSENTDAY]")
    .join(excelSlip.SalarySlipBunch[0].absentDays);
    html = html
    .split("[LEAVEDEDUCTION]")
    .join(excelSlip.SalarySlipBunch[0].leaveDeduction);
    html = html
    .split("[ESIC_DEDUCTION]")
    .join(excelSlip.SalarySlipBunch[0].esicDeduction);

  await page.setContent(html, {
    waitUntil: "domcontentloaded",
  });

  // create a pdf buffer
  const pdfBuffer = await page.pdf({
    format: "A4",
  });

  // or a .pdf file
  await page
    .pdf({
      format: "A4",
      path: path.join(__dirname, "..", "/salary.pdf"),
    })
    .then(async (resp) => {
      var filePath = "./salary.pdf";
      await deletePdf(filePath);
      res.sendFile(path.join(__dirname, "..", "/salary.pdf"));
    })
    .catch((err) => {
      return res.status(403).json({
        status: "fail",
        error: err,
      });
    });
});

function deletePdf(filePath) {
  setTimeout(() => {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      return err;
    }
  }, 5000);
}

// ---- List SalarySlip for Admin ---- //

exports.listSalarySlip = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const slip = await SalarySlip.find();

  if (!slip) {
    return next(new AppError("Slip not found", 404));
  }
  return res.status(200).json({
    status: "success",
    data: slip,
  });
});

// ---- Edit SalarySlip for Admin ---- //

exports.editExcel = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const excelUser = await Excel.aggregate([
    { $unwind: "$SalarySlipBunch" },
    { $group: { "SalarySlipBunch.salaryMonth": "req.body.fileName" } },
  ]);

});
