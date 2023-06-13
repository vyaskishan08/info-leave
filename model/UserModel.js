const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AppError = require("../utils/appError");
const XLSX = require("xlsx");
const path = require("path");
const allUserSheetEmail = require("../utils/allUserSheetEmail");
const fs = require('fs');

const userSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  name: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    required: [true, "Please Provide Your email"],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  Date: {
    type: Date,
  },
  userRole: {
    type: String,
    enum: ["user", "admin", "teamLeader"],
    default: "user",
  },
  Designation: {
    type: String,
    default: "",
  },
  pass: {
    type: String,
  },
  userImage: {
    type: String,
    default: "",
  },
  birthDate: {
    type: Date,
    default: null,
  },
  leave_id: {
    type: mongoose.Schema.ObjectId,
    ref: "Leave",
  },
  attendance_id: {
    type: mongoose.Schema.ObjectId,
    ref: "Attendance",
  },
  wfh_id: {
    type: mongoose.Schema.ObjectId,
    ref: "WorkHome",
  },
  alloted_leave: {
    type: Number,
    default: 0,
  },
  used_leave: {
    type: Number,
    default: 0,
  },
  pending_leave: {
    type: Number,
    default: 0,
  },
  alloted_wfh: {
    type: Number,
    default: 0,
  },
  used_wfh: {
    type: Number,
    default: 0,
  },
  pending_wfh: {
    type: Number,
    default: 0,
  },
  joingDate: {
    type: Date,
    default: "",
  },
  isBlackListed: {
    type: Boolean,
    default: false,
  },
  branch_id: {
    type: mongoose.Schema.ObjectId,
    ref: "branch",
    default: null,
  },
  notificationToken: {
    type: String,
    default: "",
  },
  active: {
    type: Boolean,
    default: false,
  },
  bankName: {
    type: String,
    default: "",
  },
  bankAccount: {
    type: String,
    default: "",
  },
  IFSCCode: {
    type: String,
    default: "",
  },
  isBirthDay: {
    type: Boolean,
    default: false,
  },
  systemUniqueId: {
    type: String,
    default: "",
  },
  leader: {
    type: mongoose.Schema.ObjectId,
    default: null,
  },
  user_leads: [
    {
      type: mongoose.Schema.ObjectId,
    }
  ],
  leaveRecord: [
    {
      year: {
        type: Number,
        default: 0,
      },
      alloted_leave: {
        type: Number,
        default: 0,
      },
      used_leave: {
        type: Number,
        default: 0,
      },
    },
  ],
  contact_no: {
    type: Number,
    //required: [true, "Please Enter Your Personal Contact Number"],
    default: '',
  },
  alt_contact_no: {
    type: Number,
    //required: [true, "Please Enter Your Alternate Contact Number"],
    default: '',
  },
  address: {
    type: String,
    //required: [true, "Please Enter Your Address"],
    default: '',
  },
  dailyHoursFlag: {
    type: Number,
    default: 0,
  },
  weeklyHoursFlag: {
    type: Number,
    default: 0,
  },
  dayFlag: {
    type: Boolean,
    default: false,
  },
  googleId: {
    type: String,
    default: "",
  }
});

const User = mongoose.model("users", userSchema);

module.exports = User;

module.exports.checkBirthDayEvent = async function () {
  return new Promise(async (resolve, reject) => {
    const user = await User.find({active:true,isBlackListed:false});
    // user.forEach(async (element) => {
    for (let element of user) {
      if (element.birthDate !== null) {
        const today = new Date();
        const birthDay = new Date(element.birthDate);
        var diff = new Date(birthDay.getTime() - today.getTime());
        let d1 = diff.getUTCMonth();
        let d2 = diff.getUTCDate() - 1;
        if (d1 === 0 && d2 === 0) {
          await User.findOneAndUpdate(
            { _id: element._id },
            { $set: { isBirthDay: true } },
            { new: true, upsert: false }
          );
        }
      }
    };
    await User.updateMany(
      { active: true, isBlackListed: false, userRole:["user", "teamLeader"] },
      {
        $set: { dayFlag: false },
      },
      { new: true, multi: true }
    );
    return resolve("Updated");
  });
};

module.exports.userCreditMonthlyLeave = async function () {
  return new Promise(async (resolve, reject) => {
    const user = await User.find(
      { userRole:["user", "teamLeader"],active:true,isBlackListed:false },
      { alloted_leave: 1, userRole: 1 }
    );
      for(let element of user) {
      await User.findByIdAndUpdate(
        element._id,
        {
          $inc: { alloted_leave: 1 },
          $set: {dailyHoursFlag: 0,weeklyHoursFlag:0},
        },
        { new: true }
      );
    };
    return resolve("Updated");
  });
};

module.exports.cronJobEndOfTheYear = async function () {
  const user = await User.find({ userRole:["user", "teamLeader"],active:true,isBlackListed:false });
  let alloted_leave = 0;
  for (let element of user) {
    if (element.alloted_leave >= 3) {
      alloted_leave = 3;
    }
    if (element.alloted_leave < 3) {
      alloted_leave = element.alloted_leave;
    }
    let userData = await User.findOneAndUpdate(
      { _id: element._id },
      { alloted_leave: alloted_leave,alloted_wfh:element.alloted_wfh }
    );
  };
};

module.exports.userCreditMonthlyWfh = async function () {
  await User.updateMany(
    { active: true, isBlackListed: false, userRole:["user", "teamLeader"] },
    {
      $inc: { alloted_wfh: 0.5 },
    },
    { new: true, multi: true }
  );
};

function deleteExportUser(filePath) {
  setTimeout(() => {
    try {
      let fileexist= fs.existsSync(path.join(__dirname, "..",filePath));
      if(fileexist){
        const file= fs.unlinkSync(path.join(__dirname,"..",filePath));
      }
    } catch (err) {
      return err;
    }
  }, 5000);
}

module.exports.userExport = async function () {
  
    let branch;
    
    let where = {
      'isBlackListed': false,
      'active': true,
    }
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
  
    
   
 
   const workSheetColumnNames = [
     "name","email","userRole","Designation","branch_name","isBlackListed","active",
     "createdAt","joingDate","birthDate","address","contact_no","alt_contact_no","bankName",
     "bankAccount","IFSCCode","alloted_leave","used_leave","alloted_wfh","used_wfh","systemUniqueId",
   ];
   const workSheetName = 'UserListing';
   var filePath = './users.xlsx';
   let data =  branch.map((item)=>{
       return [
         item.name,item.email,item.userRole,item.Designation,item.branch[0],item.isBlackListed,item.active,
         item.createdAt,item.joingDate,item.birthDate,item.address,item.contact_no,item.alt_contact_no,item.bankName,
         item.bankAccount,item.IFSCCode,item.alloted_leave,item.used_leave,item.alloted_wfh,item.used_wfh,item.systemUniqueId,
       ]
     });
   
   
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
   const adminUser = await User.find({ userRole: "admin",active:true,isBlackListed:false }, { email: 1 });
   const adminEmails = adminUser.map((x) => x.email);

   const date = new Date();
   const subject = "Employee Summary"+" "+date.toLocaleString('default', { month: 'long' }).toString()+"-"
   + date.getFullYear().toString();

   await new allUserSheetEmail(adminEmails).sendAllUserSheet(filePath,
    subject,
  );
};
