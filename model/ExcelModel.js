var mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");

var excelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "users",
  },

  SalarySlipBunch: [
    {
      createdAt: {
        type: Date,
        default: Date.now(),
      },
      name: {
        type: String,
      },
      email: {
        type: String,
      },
      designation: {
        type: String,
      },
      bankAccNo: {
        type: Number,
        default: 0,
      },
      bankName: {
        type: String,
      },
      salaryMonth: {
        type: String,
      },
      joiningDate: {
        type: String,
      },
      salaryPaidOn: {
        type: String,
      },
      basicPay: {
        type: Number,
      },
      houseRentAllowance: {
        type: Number,
      },
      conveyanceAllowance: {
        type: Number,
      },
      medicalAllowance: {
        type: Number,
      },
      specialAllowance: {
        type: Number,
      },
      taxDeducted: {
        type: Number,
      },
      professionalTax: {
        type: Number,
      },
      providentFund: {
        type: Number,
      },
      advanceAdjustment: {
        type: Number,
      },
      otherDeductions: {
        type: Number,
      },
      grossSalary: {
        type: Number,
      },
      totalDeductions: {
        type: Number,
      },
      netSalary: {
        type: Number,
      },
      arrearsPaid: {
        type: Number,
      },
      totalSalary: {
        type: Number,
      },
      workDays: {
        type: Number,
        default: 0,
      },
      absentDays: {
        type: Number,
        default: 0,
      },
      leaveDeduction: {
        type: Number,
        default: 0,
      },
      esicDeduction: {
        type: Number,
        default: 0,
      },
    },
  ],
});

const Excel = mongoose.model("Excel", excelSchema);

module.exports = Excel;
