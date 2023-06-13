const express = require("express");
const router = express.Router();
const logininfocontroller = require("../controllers/LoginfoController");
const userController = require("../controllers/UserController");

router.use(userController.verifyJWT);
router.post("/filter",logininfocontroller.filterLogInfo);
router.get("/", logininfocontroller.allLogs);
router.post("/:id", logininfocontroller.logDetails);
module.exports = router;