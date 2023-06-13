const mongoose = require("mongoose");
const validator = require("validator");
const AppError = require("../utils/appError");

const termsSchema = new mongoose.Schema({
    createdAt: {
        type: Date,
        default: Date.now(),
      },
      content: {
        type: String,
        default: "",
      },
      filename: {
        type: String,
        default: "",
      },
});

const Terms = mongoose.model("Terms", termsSchema);

module.exports = Terms;



