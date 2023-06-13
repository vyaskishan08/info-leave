const { text } = require("body-parser");
const mongoose = require("mongoose");


const logSchema = new mongoose.Schema({
    admin_id: {
            type: mongoose.Schema.ObjectId,
            ref: "users",
            required:true
        },
    adminName:{
        type:String,
    },
    adminEmail:{
        type:String,
    },
    employeeId: {
        type: mongoose.Schema.ObjectId,
        ref: "users",
    },
    logType: {
            type: String,
            enum: ["userUpdate", "userLeaveApprove", 
            "userLeaveReject","userLeaveCancel",
            ,"wfhApprove","wfhReject","wfhCancel",
            "userAttendanceUpdate","branchUpdate",
            "branchCreate","systemInfoCreate",
            "systemInfoUpdate",
            "systemInfoDelete"],
            required:true
    },
    payLoad:{
        type:Object,
    },
    
    }, { timestamps: true }
);

const log = mongoose.model("log",logSchema);

module.exports = log;