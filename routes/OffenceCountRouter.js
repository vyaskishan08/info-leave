const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const offenceController = require("../controllers/OffenceController");

router.use(userController.verifyJWT);
router.get("/getAllUserOffence",offenceController.getAllUserOffence);
router.get("/filteredOffence/:userid",offenceController.filteredOffence);

module.exports = router;