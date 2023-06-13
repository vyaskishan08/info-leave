const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

exports.errorvalidator = (req,res,next) => {
    const error= validationResult(req);
    if(error.array().length>0){
        return next(new AppError(error.array()[0].msg,400));
    }
    next()
}