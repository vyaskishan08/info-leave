const Branch = require("../model/BranchModel");
const User = require("../model/UserModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { filterObj, requiredFields,filterData,branchUpdate} = require("../utils/utiltites");
const{logupdate} = require("../utils/helper");

// ---- API RESTRICT TO TEAMlEADER OR ADMIN --- //

exports.createbranch = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  const branch = await Branch.create({
    branchname: req.body.branchname,
    isActive: req.body.isActive,
    description: req.body.description,
    ipAddress:req.body.ipAddress,
    attendanceMember:req.body.attendanceMember
  });

  await branch.save();

  // ---- CODES FOR LOG  --- //

  var actionstatus = "branchCreate";
  payload = branch;
  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

  // ---- CODES FOR LOG END HERE   --- //

  return res.status(200).json({
    status: "success",
    message: "branch created successfully...!",
  });
});

exports.getsinglebranch = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const branch = await Branch.findOne({
    _id: req.params.id,
    isActive: true,
  }).populate("user");
  if (!branch) {
    return next(new AppError("Branch does not exists or does not Active", 404));
  }
  return res.status(200).json({
    status: "success",
    data: branch,
  });
});

exports.allbranch = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }
  const branch = await Branch.find().populate("user", ["email", "name"]);
  return res.status(200).json({
    status: "success",
    total: branch.length,
    data: branch,
  });
});

exports.updatebranch = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin'){
    return next(new AppError("You do not have permission to access this route.",403));
  }

  commonFields = ["branchname", "isActive", "description","ipAddress","attendanceMember"];
  filteredBody = filterObj(req.body, ...commonFields);

  // ---- CODES FOR LOG  --- //

  let branchBeforeUpdate = await Branch.findById(req.params.id);
  let previousData = filterData(branchBeforeUpdate,commonFields);
  var payload = branchUpdate(previousData,filteredBody);

  // ---- CODES FOR LOG END HERE   --- //

  const branch = await Branch.findByIdAndUpdate(
    { _id: req.params.id },
    { ...filteredBody }
  );
  if (!branch) {
    return next(new AppError("Branch does not exists", 404));
  }

  // ---- CODES FOR LOG  --- //

  var actionstatus = "branchUpdate";
  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);
  
  // ---- CODES FOR LOG END HERE   --- //

  return res.status(200).json({
    status: "success",
    data: branch,
  });
});

// ---- Extra Api ----//

/*
exports.deletebranch = catchAsync(async (req, res, next) => {
  const branch = await Branch.findOneAndDelete({ _id: req.params.id });
  if (!branch) {
    return next(new AppError("Branch does not exists", 404));
  }
  return res.status(200).json({
    status: "success",
    message: "branch deleted successfully...!",
  });
}); 
*/
