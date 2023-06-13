var mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");

var excelSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  fileName: {
    type: String,
  },
  url: {
    type: String,
  },
});

const SalarySlip = mongoose.model("SalarySlip", excelSchema);

module.exports = SalarySlip;
