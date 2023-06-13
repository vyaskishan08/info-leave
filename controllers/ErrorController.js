const AppError = require("./../utils/appError");

const handelCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handelDuplicateFieldsDB = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value} Please use another Value`;
  return new AppError(message, 400);
};
const handelValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Invalid input data. ${errors.join(". ")} `;
  return new AppError(message, 400);
};

const handelJWTError = (err) =>
  new AppError("Invalid Token please login again", 401);

const handelJWTExpiredError = (err) =>
  new AppError("Your token has expired please log in again", 401);

const sendErrorProd = (err, req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Something went very wrong",
      error: err,
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).render("error", {
      title: "Something Went wrong",
      msg: err.message,
    });
  }
  return res.status(err.statusCode).render("error", {
    title: "Something Went wrong",
    msg: "Please try again later",
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = { ...err };

  error.message = err.message;

  if (error.name === "CastError") error = handelCastErrorDB(error);
  if (error.code === 11000) error = handelDuplicateFieldsDB(error);
  if (error.name === "ValidationError") error = handelValidationErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handelJWTError(error);
  if (error.name === "TokenExpiredError") error = handelJWTExpiredError(error);
  sendErrorProd(error, req, res, next);
};
