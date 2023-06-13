const express = require("express");
const router = express.Router();
const workHomeController = require("../controllers/WorkHomeController");
const userController = require("../controllers/UserController");

router.use(userController.verifyJWT);

router.post("/", workHomeController.applyWfh);

router.get("/fetchWfh", workHomeController.getWfh);

router.get("/getWfh/:id", workHomeController.singleWfh);

router.patch("/updateWfh/:id", workHomeController.updateWfh);

router.delete("/:id", workHomeController.deleteWfh);

router.get("/getWfhMonth", workHomeController.getWfhMonthwise);

router.get("/getApprovedWfh", workHomeController.getApprovedWfh);

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

router.patch("/wfhUpdate/:id", workHomeController.wfhUpdate);

router.get("/getPendingWfh", workHomeController.getPendingWfh);

router.post("/wfhDateWise", workHomeController.getWfhDateWise);

///////==== API RESTRICT TO  ADMIN ====////

router.post("/getAllWfhMonth", workHomeController.getAllWfhMonthWise);

module.exports = router;
