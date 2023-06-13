const express = require("express");
const router = express.Router();
const branchcontroller = require("../controllers/BranchController");
const userController = require("../controllers/UserController");

router.use(userController.verifyJWT);

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

router.post("/createBranch", branchcontroller.createbranch);

router.get("/getbranch/:id", branchcontroller.getsinglebranch);

router.get("/getallbranch", branchcontroller.allbranch);

router.put("/updatebranch/:id", branchcontroller.updatebranch);

/// -----  EXTRA API ----- ////
// router.delete("/deletebranch/:id", branchcontroller.deletebranch);

module.exports = router;
