const mongoose = require("mongoose");
const userPerformanceSchema = new mongoose.Schema({
    user_id: {
            type: mongoose.Schema.ObjectId,
            ref: "users",
            required:true
        },
    branch_id: {
            type: mongoose.Schema.ObjectId,
            ref: "branch",
    },
    performance:{
        type: Object,
        required:true
    }
    
    
});

const userPerformance = mongoose.model("userPerformance",userPerformanceSchema);

module.exports = userPerformance;