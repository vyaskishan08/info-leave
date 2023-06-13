const OffenceModel = require("../model/OffenceModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("./../utils/appError");
const mongoose = require("mongoose");

exports.getAllUserOffence = catchAsync(async (req, res, next) => {

    if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
        return next(new AppError("You do not have permission to access this route.",403));
      }

    var pageSize = parseInt(req.query.pagesize) || 5;
    var page = parseInt(req.query.page) || 1;

    const allUserOffence = await OffenceModel.aggregate( [
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
    
      console.log("AllUseroffence-->", allUserOffence);

      return res.status(200).json({
        status: "success",
        data: allUserOffence.length>0?allUserOffence[0].records:allUserOffence,
        total: allUserOffence.length>0?allUserOffence[0].metaData.length>0?allUserOffence[0].metaData[0].total:'':'',
      });

});

exports.filteredOffence = catchAsync(async (req, res, next) => {
  if(req.user.userRole === 'user' || req.user.userRole === 'teamLeader') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

const allUserOffence = await OffenceModel.aggregate( [
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
  $replaceRoot: { newRoot: { $mergeObjects: [ { $arrayElemAt: [ "$branch" , 0 ] },{ $arrayElemAt: [ "$user" , 0 ] }, "$$ROOT" ] }}
},
{
  $match:{
    user_id: mongoose.Types.ObjectId(req.params.userid),
  }
},
{ $project: { 
  user: 0,
  branch:0 
} }]);

  return res.status(200).json({
    status: "success",
    data: allUserOffence,
  });

});