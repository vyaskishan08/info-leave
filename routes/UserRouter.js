const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const multer = require("multer");

const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./images");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.post("/login", userController.login);

router.use(userController.verifyJWT);

router.patch("/loginUpdate", userController.loginUpdate);

router.get("/getAdminUser", userController.getAdminUser);

router.post("/upload", upload.single("imageupload"), userController.fileUpload);

router.get("/getAdmin", userController.getAdmin);

router.post("/getAllUserBirthday", userController.getAllUserBirthday);

router.post("/performanceAdd", userController.performanceAdd);

router.get("/getPerformanceUser",userController.getPerformanceUser);

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

router.get("/getAllUser", userController.getAllUser);

router.get("/getAllUserPerformance", userController.getAllUserPerformance);

router.get("/filteredUserPerformance/:userid", userController.filteredUserPerformance);

router.post("/isVerify",userController.isVerify);

// ---- API RESTRICT TO ADMIN --- //

router.patch("/manageUserRole/:id", userController.manageUserRole);

router.patch("/multiSelect", userController.multiSelect);


router.post("/userExport", userController.userExport);

router.get("/getAllLeader", userController.getAllLeader);

router.post("/assignUserToLeader", userController.assignUserToLeader);

/// -----  EXTRA API ----- ////
// router.delete("/deleteUser/:id", userController.deleteUser);

module.exports = router;
