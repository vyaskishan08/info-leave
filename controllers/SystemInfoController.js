const catchAsync = require("../utils/catchAsync");
const SystemInfo = require("../model/SystemInfoModel");
const AppError = require("./../utils/appError");
const mongoose = require("mongoose");
const User = require("../model/UserModel");
const{logupdate} = require("../utils/helper");


exports.getSystemInfo = catchAsync(async (req, res, next) => {
  let systeminfos,currentuser=false;
  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;
  var isVerify = req.query.isVerify === 'true'?true:false;

  if (req.user.userRole != "admin" ) {
    if(req.params.id){
      currentuser=true
    }else{
    return next(
      new AppError("You do not have permission to access this route.", 403)
    );}
  }
  if (req.params.id) {
    if (req.params.id.length !== 24) {
      return next(new AppError("Please Select Valid User", 404));
    }
    systeminfos = await SystemInfo.findOne({
      _id: req.params.id,
    }).populate({path:'user',select:'name email'});
    if (!systeminfos) {
      return next(new AppError("Record Not Found", 404));
    }
    if(currentuser){
      if(req.user.id!==systeminfos.user._id.toString()){
         return next(
          new AppError("You do not have permission to access this route", 403)
          );
        }
      }     
  } else {
    systeminfos = await SystemInfo.aggregate( [
      {$lookup:{
               from: 'users',
               localField: 'user',
               foreignField: '_id',
               as: 'user',
               pipeline: [
               { $project:{
                    _id:1,
                    name:1,
                    email:1,
                 } 
              } 
            ]
           },     
      },
      {
        $unwind: "$user"
      },
      {
        $match:{
          "isVerify":isVerify
        }
      },
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
  }
  return res.status(200).json({
    status: "success",
    data: systeminfos.length>0?systeminfos[0].records:systeminfos,
    total: systeminfos.length>0?systeminfos[0].metaData.length>0?systeminfos[0].metaData[0].total:'':'',
  });
});

exports.filteredSystemInfo = catchAsync(async (req, res, next) => {
  let filteredSystemInfos=[],systeminfos;
  
  if (req.user.userRole != "admin" ) {
    return next(
      new AppError("You do not have permission to access this route.", 403)
    );
  }
    if (req.params.id.length !== 24) {
      return next(new AppError("Please Select Valid User", 404));
    }
    systeminfos = await SystemInfo.findOne({
      user: req.params.id,
    }).populate({path:'user',select:'name email'});

    filteredSystemInfos.push(systeminfos);

    if (!filteredSystemInfos.length) {
      return next(new AppError("Record Not Found", 404));
    }   
  return res.status(200).json({
    status: "success",
    data: filteredSystemInfos.length>0?filteredSystemInfos:[],
  });
});

exports.getUserSystemInfo = catchAsync(async (req, res, next) => {
  let systeminfos;
  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;

  if (!req.params.userid) {
    return next(new AppError("Please Provide UserId.",404));
  }
  if (req.params.userid.length !== 24) {
    return next(new AppError("Please Select Valid User", 404));
  }
  systeminfos = await SystemInfo.findOne({
    user: req.params.userid,
  }).populate({path:'user',select:'name email'});
  
  return res.status(200).json({
    status: "success",
    data: systeminfos
  });
});

exports.updateSystemInfo = catchAsync(async (req, res, next) => {
  var actionstatus = "systemInfoUpdate";
  const operation = "update";

  const { user, systeminfo, error } = await commonfunctionalities(
    req.user.userRole,
    req.params.id,
    operation
  );


  if (error || !user || !systeminfo) {
    if (!systeminfo) {
      return next(new AppError("Record Does not Exist", 404));
    }
    return next(new AppError(error, 403));
  }

    const previousSysteminfo = await SystemInfo.find({_id:req.params.id});
    systeminfo.description = req.body.description;
    systeminfo.user = req.body.id;
    await systeminfo.save();
    let systeminfos;
    if (systeminfo) {
      systeminfos = {
        description: systeminfo.description,
        _id: systeminfo._id,
        name: systeminfo.user.name,
        email: systeminfo.user.email,
        user: systeminfo.user._id,
      };
    }

    var payload = {
      employeeId:systeminfos.user,
      previousData:previousSysteminfo[0],
      updatedData:systeminfo
    };
   
    const logres = await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

    return await res.status(200).json({
      status: "success",
      data: systeminfos,
    });
  
});

exports.updateUserSystemInfo = catchAsync(async (req, res, next) => {
  let systeminfo;

  if (!req.params.id || req.params.id.length !== 24) {
    return next(new AppError("Please Provide Valid Id",404));
  }
  const isSystemVerify = await SystemInfo.findOne({user:req.params.id});
  if(isSystemVerify && isSystemVerify.isVerify == true){
    return next(new AppError("Something went wrong, please contact your Administrator",404));
  }
  const systemInfoBody = {
    description:req.body.description,
    user:req.body.id,
    branch_id:req.user.branch_id,
    isVerify:req.body.isVerify?req.body.isVerify:false
  }
  systeminfo = await SystemInfo.findOneAndUpdate(
    {user:req.params.id},
    { $set:systemInfoBody},
    { new: true,upsert:true });
    
    return await res.status(200).json({
      status: "success"
    });
});

exports.createSystemInfo = catchAsync(async (req, res, next) => {
const operation = "create";
var actionstatus = "systemInfoCreate";
const { user, systeminfo, error } = await commonfunctionalities(
  req.user.userRole,
  req.body.id,
  operation
);
 
  if(error || !user || systeminfo ){
    if(systeminfo){
       return next(new AppError("Record Already Exist", 404));
      }
    return next(new AppError(error, 403));
  }
  const [curruser] =await User.find({_id:user}).select({name:1,email:1,userRole:1,branch_id:1});
//  console.log(curruser);
  if(curruser.userRole == "admin"){
     return next(new AppError("You do not have permission to access this route.", 403));
  }
  if(!(req.body.description) || (Object.keys(req.body.description).length===0)){
    return next(new AppError("Please Enter Something", 404));
  }

  let newsysteminfo= await SystemInfo.create({
    description: req.body.description,
    user,
    branch_id:curruser.branch_id
  })

    newsysteminfo = {
      description: newsysteminfo.description,
      _id: newsysteminfo._id,
      name: curruser.name,
      email: curruser.email,
      user: curruser._id,
    };

    var payload = newsysteminfo;
    payload.employeeId = newsysteminfo.user

    await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);
    
    return res.status(201).json({
      status: "success",
      data: newsysteminfo,
    });
});

async function commonfunctionalities(userRole,id,operation){
  let error,user,systeminfo;

  if (userRole != "admin") {
    error = "You do not have permission to access this route.";
    return {user,systeminfo,error};
  }

  if (!id || id.length !== 24) {
    error = "Somthing Went Wrong.";
    return { user, systeminfo, error };
  }
   
  user = mongoose.Types.ObjectId(id);
  if(operation ==="create"){
     systeminfo = await SystemInfo.findOne({
       user,
     }).populate("user");
  }else{
      systeminfo = await SystemInfo.findOne({ 
        _id:user, 
       }).populate("user");
        
  }

  return { user, systeminfo, error };
}

exports.deleteSystemInfo = catchAsync(async (req, res, next) => {
 const  operation="delete";
 var actionstatus = "systemInfoDelete";
  const { user, systeminfo, error } = await commonfunctionalities(
    req.user.userRole,
    req.params.id,
    operation
  );

    if (error || !user || !systeminfo) {
      if (!systeminfo) {
        return next(new AppError("Record Does not Exist", 404));
      }
      return next(new AppError(error, 403));
    }
    await systeminfo.remove();
    var payload = systeminfo;
    payload.employeeId = systeminfo.user._id
    await logupdate(req.user.name,req.user._id,req.user.email,actionstatus,payload);

    return res.status(200).json({
      status: "success",
      data: "Deleted SuccessFully",
    });
});

exports.isVerify = catchAsync(async (req, res, next) => {

  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }
  if(!req.body.hasOwnProperty('isVerify')){
    return next(new AppError("Please Provide Active or Inactive Status",404));
  }
  await SystemInfo.findOneAndUpdate({user:req.params.userid},{$set: {isVerify:req.body.isVerify}},{new: true});
     return res.status(200).json({
       status: "success",
       data: "Success"
     });
});

exports.filterBranchWise = catchAsync(async (req, res, next) => {
  let systeminfos,currentuser=false;
  var pageSize = parseInt(req.query.pagesize) || 5;
  var page = parseInt(req.query.page) || 1;
  var isVerify = req.query.isVerify === 'true'?true:false;
  
  systeminfos = await SystemInfo.aggregate( [
    {$lookup:{
             from: 'users',
             localField: 'user',
             foreignField: '_id',
             as: 'user',
             pipeline: [
             { $project:{
                  _id:1,
                  name:1,
                  email:1,
               } 
            } 
          ]
         },     
    },
    {
      $unwind: "$user"
    },
    {
      $match:{
        "branch_id":mongoose.Types.ObjectId(req.params.branch_id),
        "isVerify":isVerify
      }
    },
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
    data: systeminfos.length>0?systeminfos[0].records:systeminfos,
    total: systeminfos.length>0?systeminfos[0].metaData.length>0?systeminfos[0].metaData[0].total:'':'',
  });

});
