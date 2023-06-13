const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const systeminfoController = require("../controllers/SystemInfoController");
const {systeminfovalidator} = require("../validators/systeminfo");
const { errorvalidator } = require("../validators/errorvalidator");
router.use(userController.verifyJWT);

router.post("/",systeminfovalidator, errorvalidator,systeminfoController.createSystemInfo);
router.get("/", systeminfoController.getSystemInfo);
router.get("/:id", systeminfoController.getSystemInfo);
router.get("/filterdSystemInfos/:id", systeminfoController.filteredSystemInfo);
router.get("/filter/:branch_id", systeminfoController.filterBranchWise);
router.get("/user/:userid", systeminfoController.getUserSystemInfo);
router.patch("/:id", systeminfoController.updateSystemInfo);
router.patch("/user/:id", systeminfoController.updateUserSystemInfo);
router.delete("/:id", systeminfoController.deleteSystemInfo);
router.post("/isVerify/:userid",systeminfoController.isVerify);
module.exports = router;
