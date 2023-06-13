const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/LeaveController");
const userController = require("../controllers/UserController");

router.use(userController.verifyJWT);

router.post("/", leaveController.Leave);

router.get("/fetchLeave/:id", leaveController.getLeave);

router.get("/getLeave/:id", leaveController.singleLeave);

router.get("/getLeaveMonth", leaveController.getLeaveMonthwise);

router.patch("/updateLeave/:id", leaveController.updateLeave);

router.delete("/:id", leaveController.deleteLeave);

router.get("/getApprovedLeave", leaveController.getAllApprovedLeave);

router.patch("/pendingLeave/:id", leaveController.pendingLeave);

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //
router.patch("/leaveApprove/:id", leaveController.leaveApprove);

router.patch("/leaveCancel/:id", leaveController.leaveCancel);

router.get("/getAllLeaves", leaveController.getPendingLeave);

router.post("/leaveDateWise", leaveController.getLeaveDateWise);

router.post("/attendanceLeaveCancel",leaveController.attendanceLeaveCancel);

// ---- API RESTRICT TO ADMIN --- //

router.post("/getAllLeavesMonth", leaveController.getAllLeaveMonthWise);

router.post("/leaveRecord",leaveController.leaveRecord);

module.exports = router;
