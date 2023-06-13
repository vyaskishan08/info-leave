const User = require("../model/UserModel");
const Leave = require("../model/LeaveModel");
const Branch = require("../model/BranchModel");
const SystemInfo = require("../model/SystemInfoModel");
const UserPerformance = require("../model/UserPerformanceModel");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const AppError = require("../utils/appError");
const { filterObj, requiredFields,filterData} = require("../utils/utiltites");
var dateFormat = require("dateformat");
var mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");
const{logupdate} = require("../utils/helper");

const fs = require("fs");
const userPerformance = require("../model/UserPerformanceModel");

exports.login = catchAsync(async (req, res, next) => {
  const myUser = await User.findOne({ email: req.body.email });
  
  let newUser;
  if (myUser) {
    if (myUser.isBlackListed === false) {
      newUser = myUser;
    }else{
      return next(new AppError("Please contact to your administrator", 400));
    }
    let where;
    if (req.body.hasOwnProperty("googleId")) {
      if(myUser.googleId == '' || myUser.googleId == null){
        where = { "googleId" : req.body.googleId,...where};
      }
     }
    if (req.body.hasOwnProperty("systemUniqueId")) {
     if(myUser.systemUniqueId == '' || myUser.systemUniqueId == null){
      where = { "systemUniqueId" : req.body.systemUniqueId,...where};
     }
    }
     if(where){
      await User.updateOne(
        { "_id": myUser._id },
        {
          $set: where
        });
     }
    if (myUser.googleId !== req.body.googleId) {
      return next(new AppError("Invalid Credential", 404));
    }
  } else {
    newUser = await User.create({
      email: req.body.email,
      name: req.body.name,
      pass: req.body.pass,
      systemUniqueId: req.body.systemUniqueId,
      googleId:req.body.googleId
    });
    await newUser.save();
  }

  createJWTToken(newUser, 201, res);
});

const createJWTToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.verifyJWT = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new AppError("You are not logged in! Please login again", 401));
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError("User Doesn't exist", 401));
  }

  req.user = currentUser;
  res.locals.user = currentUser;

  next();
});

exports.restrictTo = (...roles) => {
  return async (req, res, next) => {
    if (!roles.includes(req.user.userRole)) {
      return res.status(403).json({
        status: "fail",
        error: "You do not have permission to access this route",
      });
    }
    next();
  };
};

exports.loginUpdate = catchAsync(async (req, res, next) => {
  const user = await User.findById({
    _id: req.user._id,
  });

  commonFields = [
    "name",
    "Designation",
    "birthDate",
    "joingDate",
    "isBirthDay",
    "bankName",
    "bankAccount",
    "IFSCCode",
    "contact_no",
    "alt_contact_no",
    "address"
  ];

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (req.body.hasOwnProperty("notificationToken")) {
    commonFields.push("notificationToken");
  }

  if (req.body.hasOwnProperty("userImage")) {
    commonFields.push("userImage");
  }

  if (req.body.hasOwnProperty("birthDate")) {
    const birthdate = new Date(req.body.birthDate).setHours(0, 0, 0, 0);
    commonFields.push(birthdate);
  }

  if (req.body.hasOwnProperty("joingDate")) {
    const joingDate = new Date(req.body.joingDate).setHours(0, 0, 0, 0);
    commonFields.push(joingDate);
  }

  filteredBody = filterObj(req.body, ...commonFields);

  newUser = await User.updateOne({ _id: req.user._id }, { ...filteredBody });

  return res.status(200).json({
    status: "success To Update",
  });
});

exports.getAdmin = catchAsync(async (req, res, next) => {
  const admin = await User.find(
    { userRole: "admin" },
    { email: 1, name: 1, userRole: 1 }
  );

  res.status(200).json({
    status: "success",
    data: admin,
  });
});

exports.getAdminUser = catchAsync(async (req, res, next) => {
  const user = await User.find({ userRole: "admin" });
  return res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.fileUpload = catchAsync(async (req, res, next) => {
  const oldImage = await User.findById({
    _id: req.user._id,
  });

  const newPath = `./images/${oldImage.userImage}`;
  fs.unlink(newPath, (err) => {
    if (err) {
      return;
    }
  });

  const user = await User.updateOne(
    {
      _id: req.user._id,
    },
    { userImage: req.file.filename }
  );

  return res.status(200).json({
    messsage: "image upload successfuly",
  });
});

exports.getAllUserBirthday = catchAsync(async (req, res, next) => {
  var month = req.body.month;
  var formattedMonth = ("0" + month).slice(-2);
  let fullDate = new Date().getFullYear() +'-'+ formattedMonth + '-01';
  let branchId= req.body.branchId;
  let userList;
  if (req.body.hasOwnProperty("branchId")) {
    userList = await User.aggregate([
      { 
        $match: {
          isBlackListed:false,
          active:true,
          branch_id:mongoose.Types.ObjectId(branchId),
          $expr: {
            $eq: [{ $month: '$birthDate' }, { $month:  new Date(fullDate) }],
          },
        }
      },
      {
        $project: {
          _id: 0, name: 1, email: 1, birthDate:1,
        },
      }
    ]);
  }else{
    userList = await User.aggregate([
      {
        $match: {
          isBlackListed:false,
          active:true,
          $expr: {
            $eq: [{ $month: '$birthDate' }, { $month:  new Date(fullDate) }],
          },
        }
      },
      {
        $project: {
          _id: 0, name: 1, email: 1, birthDate:1,branch_id:1
        },
      }
    ])
  }


  return res.status(200).json({
    status: "success",
    total:userList.length,
    data:userList
  });
});

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

exports.getAllUser = catchAsync(async (req, res, next) => {
  let user;
  if(req.user.userRole === 'user') {
    return next(new AppError("You do not have permission to access this route.",403));
  }else if(req.user.userRole === 'teamLeader') {
    user = await User.find({_id: {$in: req.user.user_leads},isBlackListed:false, active:true}).populate("branch_id", ["branchname"]);
  }else if (req.user.userRole === 'admin') {
    user = await User.find().populate("branch_id", ["branchname"]);
  }
  return res.status(200).json({
    status: "success",
    total:user.length,
    data: user,
  });
});

// ---- API RESTRICT TO ADMIN --- //

exports.manageUserRole = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'admin') {
    let commonFields = [];

    if (req.body.userRole) {

      const user =  await User.findById(req.params.id);
      if(user.userRole == 'teamLeader') {
        if(user.user_leads.length > 0 ) {
        const assignUser = user.user_leads;
          await User.updateMany(
            {_id:assignUser},
            {$unset : {leader : 1 }},
            {new:true, upsert:true}
          )
        }
        await User.findOneAndUpdate(
          {_id:user._id},
          {$unset : {user_leads : 1 }},
          {new:true, upsert:true}
        )
      }
      commonFields.push("userRole");
    }
    if (req.body.alloted_leave) {
      commonFields.push("alloted_leave");
    }
    if (req.body.dailyHoursFlag) {
      commonFields.push("dailyHoursFlag");
    }
    if (req.body.weeklyHoursFlag) {
      commonFields.push("weeklyHoursFlag");
    }
    if (req.body.alloted_wfh) {
      commonFields.push("alloted_wfh");
    }
    if (req.body.branch_id) {
      commonFields.push("branch_id");
  
      await Branch.findOneAndUpdate(
        { user: req.params.id },
        { $pull: { user: req.params.id } }
      );
      const user1 = await Branch.findOne({ user: req.params.id }, { "user.$": 1 });
      if (user1) {
        const branch = await Branch.findOneAndUpdate(
          { _id: user1._id },
          { $pull: { user: req.params.id } },
          { "user.$": 1 }
        );
      }
     const branchDetails = await Branch.findOneAndUpdate(
        { _id: req.body.branch_id },
        {
          $push: {
            user: req.params.id,
          },
        }
      );
      var updatedBranchName = branchDetails.branchname; // LOG CODE HERE
      // Update Branch Id in System Info Model 
      await SystemInfo.findOneAndUpdate(
        {user:mongoose.Types.ObjectId(req.params.id)},
        {branch_id:mongoose.Types.ObjectId(req.body.branch_id)}
      );
    }
    if (req.body.hasOwnProperty("isBlackListed")) {
      commonFields.push("isBlackListed");
    }
    if (req.body.hasOwnProperty("active")) {
      commonFields.push("active");
    }

    if (req.body.systemUniqueId) {
      commonFields.push("systemUniqueId");
    }
    
    // ---- CODES FOR LOG  --- //

    let userbeforeupdate = await User.findById(req.params.id);
    let previousData = filterData(userbeforeupdate,commonFields);
    const previousBranchdetails = await Branch.findById(userbeforeupdate.branch_id);
    if(commonFields.indexOf('branch_id')>-1){
      previousData.branchName = previousBranchdetails?.branchname?previousBranchdetails.branchName:'';
    } 

    // ---- CODES FOR LOG END HERE   --- //

    let filteredBody = filterObj(req.body, ...commonFields);

    await User.findByIdAndUpdate(
      { _id: req.params.id },
      {
        $set: filteredBody,
      },
      { upsert: true }
    );
    // ---- CODES FOR LOG  --- //

    if(commonFields.indexOf('branch_id')>-1){
      filteredBody.branchName = updatedBranchName;
    } 
    var payload = {
      employeeId:req.params.id,
      previousData:previousData,
      updatedData:filteredBody
    };

    // ---- CODES FOR LOG END HERE   --- //
    
    var currentTime = new Date();
    var Year = currentTime.getFullYear();
    // var Year = 2022;

    const user = await User.findOne({
      $or: [{ "leaveRecord.year": 0 }, { "leaveRecord.year": Year }],
    });

    if (user) {
      await User.findOneAndUpdate(
        {
          _id: req.params.id,
          "leaveRecord.year": Year,
        },
        {
          "leaveRecord.$.alloted_leave": req.body.alloted_leave,
          "leaveRecord.$.year": Year,
        }
      );
    } else {
      await User.findByIdAndUpdate(
        { _id: req.params.id },
        {
          $push: {
            leaveRecord: {
              year: Year,
              alloted_leave: req.body.alloted_leave,
            },
          },
        }
      );
    }
  }else {
    return next(new AppError("You do not have permission to access this route.",403));
  }
  // ---- CODES FOR LOG  --- //
  var actionstatus = "userUpdate";
  await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);
  // ---- END HERE  --- //

  return res.status(200).json({
    status: "success To Update",
  });
});

exports.multiSelect = catchAsync(async (req, res, next) => {
  let commonFields = [];
if(req.user.userRole === 'admin') {
  if (req.body.hasOwnProperty("isBlackListed")) {
    commonFields.push("isBlackListed");
  }

  if (req.body.hasOwnProperty("branch_id")) {
    commonFields.push("branch_id");
    const branch = await Branch.updateMany(
      { user: { $in: req.body._id } },
      { $pull: { user: { $in: req.body._id } } },
      { multi: true, new: true }
    );
    const branch2 = await Branch.updateMany(
      { _id: req.body.branch_id },
      { $push: { user: req.body._id } },
      { multi: true, upsert: true }
    );
  }

  let filteredBody = filterObj(req.body, ...commonFields);

  const multiSelect = await User.updateMany(
    { _id: { $in: req.body._id } },
    { $set: filteredBody },
    { upsert: true, multi: true }
  );
}else {
  return next(new AppError("You do not have permission to access this route.",403));
}
  return res.status(200).json({
    status: "success To Update",
  });
});

exports.getAllLeader = catchAsync(async (req, res, next) => {
  let teamLeader;

  teamLeader = await User.find(
    { userRole: "teamLeader",active:true,isBlackListed:false },
    { email: 1, name: 1, userRole: 1, user_leads:1}
  );
    
  let allTeamlead = [];

  for (let user of teamLeader) {
    let teamLeaderUser = await User.find(
      { _id: {$in: user.user_leads} },
      { email: 1, name: 1, userRole: 1}
    );
    let leads = {
      name : user.name,
      email : user.email,
      lead_user_id : user._id,
      user_leads : teamLeaderUser
    }
    allTeamlead.push(leads);
  }

  res.status(200).json({
  status: "success",
  data: allTeamlead,
});
});

exports.assignUserToLeader = catchAsync(async (req,res,next) => {
  let leader;
  if(req.user.userRole === 'admin') {
    let assignUsers = req.body.userId;
    const leaderId = req.body.leaderId;
    const teamLeader = await User.findById(leaderId);
    const oldAssignUsers = teamLeader.user_leads;
      if(oldAssignUsers.length > 0) {
        await User.updateMany(
          {_id:oldAssignUsers},
          {$unset : {leader : 1 }},
          {new:true, upsert:true}
        )
      }
        await User.updateMany(
          {_id: assignUsers},
          {$set:{leader:leaderId}},
          {new:true}
        )
    leader = await User.findOneAndUpdate(
      { _id: req.body.leaderId },
      { $set: { user_leads: assignUsers },
        },
      { new: true, upsert: true }
    );
  }else {
    return next(new AppError("You do not have permission to access this route.",403));
  }
    return res.status(200).json({
      status: "User Assign To Leader Sucessfully.",
      data: leader
    });
});

exports.userExport = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'admin') {
    let branch;
    if(!req.body.hasOwnProperty("isActive")){
      return next(new AppError("user Activation Type not defined", 404));
    }
    let where = {
      'isBlackListed': false,
      'active': req.body.isActive,
    }
    if(!req.body.hasOwnProperty("id")){
     branch = await User.aggregate([
       {
         $lookup: {
           from: "branches",
           localField: "branch_id",
           foreignField: "_id",
           as: "branch",
         },
       },
       {
         $match: where
       },
       {
         $project: {
           name:1,
           email:1,
           userRole:1,Designation:1,isBlackListed:1,active:1,
           createdAt:1,joingDate:1,birthDate:1,address:1,contact_no:1,alt_contact_no:1,bankName:1,
           bankAccount:1,IFSCCode:1,alloted_leave:1,used_leave:1,alloted_wfh:1,used_wfh:1,systemUniqueId:1,
           'branch': '$branch.branchname'
         },
       },
     ]);
   } else {
     branch = await Branch.findOne({
       _id: req.body.id,
       isActive: true,
     }).populate({path: "user",match:{active:req.body.isActive}});
   }
 
   const workSheetColumnNames = [
     "name","email","userRole","Designation","branch_name","isBlackListed","active",
     "createdAt","joingDate","birthDate","address","contact_no","alt_contact_no","bankName",
     "bankAccount","IFSCCode","alloted_leave","used_leave","alloted_wfh","used_wfh","systemUniqueId",
   ];
   const workSheetName = 'UserListing';
   var filePath = './users.xlsx';
   let data;
   if (!req.body.hasOwnProperty("id")){
     data =  branch.map((item)=>{
       return [
         item.name,item.email,item.userRole,item.Designation,item.branch[0],item.isBlackListed,item.active,
         item.createdAt,item.joingDate,item.birthDate,item.address,item.contact_no,item.alt_contact_no,item.bankName,
         item.bankAccount,item.IFSCCode,item.alloted_leave,item.used_leave,item.alloted_wfh,item.used_wfh,item.systemUniqueId,
       ]
     });
   }
   else{
     data = branch.user.map((item)=>{
       return [
         item.name,item.email,item.userRole,item.Designation,branch.branchname,item.isBlackListed,item.active,
         item.createdAt,item.joingDate,item.birthDate,item.address,item.contact_no,item.alt_contact_no,item.bankName,
         item.bankAccount,item.IFSCCode,item.alloted_leave,item.used_leave,item.alloted_wfh,item.used_wfh,item.systemUniqueId,
       ]
     });
   }
   const workBook = new XLSX.utils.book_new();
   const workSheetData = [ 
     workSheetColumnNames,
     ... data
   ];
  
   const workSheet = XLSX.utils.json_to_sheet(workSheetData,{skipHeader: true});
   workSheet["!cols"] = [{wch:20},{wch:30},{wch:15},{wch:15},{wch:15},{wch:15},{wch:10},
                         {wch:15},{wch:15},{wch:15},{wch:20},{wch:20},{wch:20},{wch:15},
                         {wch:20},{wch:20},{wch:12},{wch:12},{wch:12},{wch:12},{wch:35}];
     XLSX.utils.book_append_sheet(workBook,workSheet);
     XLSX.writeFile(workBook, path.resolve(filePath));
 
   await deleteExportUser(filePath);
   res.sendFile(path.join(__dirname, "..", "/users.xlsx"));
  }else {
    return next(new AppError("You do not have permission to access this route.",403));
  }
});

exports.performanceAdd = catchAsync(async (req, res, next) => {

  if(!req.body.hasOwnProperty("year") || !req.body.hasOwnProperty("description") || !req.body.hasOwnProperty("ratings")){
    return next(new AppError("please fill all required fields",404));
  }
  
  var year = req.body.year;
  var perfomance = [];
  const{description,ratings} = req.body;
  const userPerformexist = await UserPerformance.find({user_id:req.user._id,branch_id:req.user.branch_id});
  console.log("userPerformexist-->",userPerformexist);
  if(userPerformexist.length!=0){
    let isYearPresent = userPerformexist[0].performance.findIndex(performance => performance.year === year);
    console.log("isyearpresent-->",isYearPresent);

    if(isYearPresent == -1){
        const userperformupdate = await UserPerformance.findOneAndUpdate(
        {user_id:req.user._id,branch_id:req.user.branch_id},
        {
          $push: {
            performance:{
              description:req.body.description,
              ratings:req.body.ratings,
              year:year,
              isVerify:false
            }}
        });

      res.status(200).json({
        status: "success",
        data:userperformupdate
        })

    }else{

      let userperformupdate = await UserPerformance.findOneAndUpdate(
        {
          user_id:mongoose.Types.ObjectId(req.user._id),
          branch_id:mongoose.Types.ObjectId(req.user.branch_id), 
          performance: {
            $elemMatch: {
              year:year
            }
         }
        },
        {
          $set: {
            "performance.$.description":description,
            "performance.$.ratings":ratings,
            "performance.$.year":year,
            "performance.$.isVerify":false
                
          },
        },{ upsert: true }  );

        res.status(200).json({
        status: "success",
        data:userperformupdate
        });
    }
  
  }else{

  perfomance = [{
        description:req.body.description,
        ratings:req.body.ratings,
        year:year,
        isVerify:false
      }];

  const userPerformance = new UserPerformance({
    user_id:req.user._id,
    branch_id:req.user.branch_id,
    performance:perfomance
  });

  const userPerformanceres = await userPerformance.save();

  res.status(200).json({
  status: "success",
  data:userPerformanceres
  });

}
});

exports.getPerformanceUser = catchAsync(async (req, res, next) => {
  
  const getperformuser = await UserPerformance.find({user_id:req.user._id});

  res.status(200).json({
    status: "success",
    data:getperformuser
    });

});

exports.getAllUserPerformance = catchAsync(async (req, res, next) => {
  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;
  var isVerify = req.query.isVerify === 'true'?true:false;


  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  const allUserPerformance = await UserPerformance.aggregate( [
    {$lookup:{
             from: 'users',
             localField: 'user_id',
             foreignField: '_id',
             as: 'user',
             pipeline: [
             { $project:{
                  _id:0,
                  name:1,
                  email:1,
               } 
            } 
          ]
         },     
    },
    {$lookup:{
      from: 'branches',
      localField: 'branch_id',
      foreignField: '_id',
      as: 'branch',
      pipeline: [
                 { $project:{
                      _id:0,
                      branchname:1
                   } 
        } 
      ]
  }, 
      
},
{
  $project:{
    user_id:1,
    branch_id:1,

    performance:{
      $filter: {
        input: '$performance',
        as: 'performance',
        cond: { $eq: ['$$performance.isVerify', isVerify] }
      }
    },
    user: 1,
    branch:1 
  }
},
{
  $replaceRoot: { newRoot: { $mergeObjects: [ { $arrayElemAt: [ "$branch" , 0 ] },{ $arrayElemAt: [ "$user" , 0 ] }, "$$ROOT" ] }}
},
{ $project: { 
  user: 0,
  branch:0 
} },
{
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: pageSize * (page-1) }, { $limit: pageSize }],
      },
    },
  ])

  return res.status(200).json({
    status: "success",
    data: allUserPerformance.length>0?allUserPerformance[0].records:allUserPerformance,
    total: allUserPerformance.length>0?allUserPerformance[0].metaData.length>0?allUserPerformance[0].metaData[0].total:'':'',
  });

});

exports.isVerify = catchAsync(async (req, res, next) => {

  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  if(!req.body.hasOwnProperty('isVerify')){
    return next(new AppError("Please Provide Active or Inactive Status",404));
  }

  const{userid,branchid,isVerify,year} = req.body;

  await UserPerformance.findOneAndUpdate(
    {
      user_id:mongoose.Types.ObjectId(userid),
      branch_id:mongoose.Types.ObjectId(branchid),
      performance: {
        $elemMatch: {
          year:year
        }
     }
    },
    {
      $set: {
        "performance.$.isVerify":isVerify
            
      },
    });

    return res.status(200).json({
           status: "success",
           data: "success"
    });
});

exports.filteredUserPerformance = catchAsync(async (req, res, next) => {
  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;

  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  const allUserPerformance = await UserPerformance.aggregate( [
    {$lookup:{
             from: 'users',
             localField: 'user_id',
             foreignField: '_id',
             as: 'user',
             pipeline: [
             { $project:{
                  _id:0,
                  name:1,
                  email:1,
               } 
            } 
          ]
         },     
    },
    {$lookup:{
      from: 'branches',
      localField: 'branch_id',
      foreignField: '_id',
      as: 'branch',
      pipeline: [
                 { $project:{
                      _id:0,
                      branchname:1
                   } 
        } 
      ]
  }, 
      
},{
  $match:{
    user_id: mongoose.Types.ObjectId(req.params.userid),
  }
},
{
  $replaceRoot: { newRoot: { $mergeObjects: [ { $arrayElemAt: [ "$branch" , 0 ] },{ $arrayElemAt: [ "$user" , 0 ] }, "$$ROOT" ] }}
},
{ $project: { user: 0,branch:0 } },
{
      $facet: {
        metaData: [
          {
            $count: 'total',
          },
        ],
        records: [{ $skip: pageSize * (page-1) }, { $limit: pageSize }],
      },
    },
  ])

  return res.status(200).json({
    status: "success",
    data: allUserPerformance.length>0?allUserPerformance[0].records:allUserPerformance,
    total: allUserPerformance.length>0?allUserPerformance[0].metaData.length>0?allUserPerformance[0].metaData[0].total:'':'',
  });
});


function deleteExportUser(filePath) {
  setTimeout(() => {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      return err;
    }
  }, 5000);
}

/* 
exports.deleteUser = catchAsync(async (req, res, next) => {
  if (req.user.userRole === "superAdmin") {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError("User does not exists"));
    }
    Promise.all([
      Leave.deleteOne({ user: { $eq: req.params.id } }),
      Branch.findOneAndUpdate(
        { user: req.params.id },
        { $pull: { user: req.params.id } },
        { "user.$": 1 }
      ),
      User.findByIdAndDelete({ _id: req.params.id }),
    ]).then(() => {
      res.status(200).json({
        status: "success",
        message: "deleted successfully...!!!",
      });
    });
  }
});
*/