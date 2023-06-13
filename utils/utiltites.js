const { json } = require("body-parser");
const e = require("express");
const AppError = require("./appError");

exports.filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};

exports.requiredFields = (obj, ...requiredFields) => {
  let flag = true;
  requiredFields.forEach((el) => {
    if (obj[el] === undefined) {
      flag = false;
    }
  });

  return flag;
};

exports.filterData = (obj,allowedFields) => {
  const newObj = {};
  Object.keys(obj.toJSON()).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};
                 
exports.branchUpdate = (previousData,filteredBody) => {
  const payload ={};
  const previousObj = {};
  const updatedObj ={};

  Object.keys(filteredBody).forEach((key)=>{
    if(previousData[key]!=filteredBody[key]){
      previousObj[key]=previousData[key];
      updatedObj[key]=filteredBody[key];
    }
  })

  payload.previousData = previousObj;
  payload.updatedData = updatedObj;
  return payload;
  
};