const mongoose = require("mongoose");
const offenceSchema = new mongoose.Schema({
    user_id: {
            type: mongoose.Schema.ObjectId,
            ref: "users",
            required:true
        },
    branch_id: {
            type: mongoose.Schema.ObjectId,
            ref: "branch",
            default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    },
    content: {
        type: Object,
        required:true
    }
    
});

const Offence = mongoose.model("offenceCount",offenceSchema);

module.exports = Offence;