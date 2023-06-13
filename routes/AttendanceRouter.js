const express = require("express");
const router = express.Router();
const attendancecontroller = require("../controllers/AttendanceController");
const userController = require("../controllers/UserController");

router.get("/ipAddress", attendancecontroller.getIpAddress);
router.use(userController.verifyJWT);


router.post("/verifiedAttendance",attendancecontroller.verifiedAttendance);
router.get("/", attendancecontroller.getAttendance);

router.post("/filteredAttendance/", attendancecontroller.attendanceFiltered);

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

router.get("/previousDayAttendance/",attendancecontroller.previousDayAttendance);

router.patch("/updateAttendance/:id",attendancecontroller.updateAttendance);

// ---- API RESTRICT TO ADMIN --- //

router.get("/getUserWiseAttendance/:id",attendancecontroller.getUserAttendance);

module.exports = router;
