const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const excelController = require("../controllers/ExcelController");
let path = require("path");

router.use(userController.verifyJWT);

// ---- API RESTRICT TO  ADMIN --- //

router.post("/downloadExcel", excelController.downloadExcel);

router.post("/import", excelController.importExcel);

router.patch("/slipEdit", excelController.editExcel);

router.get("/uploadList", excelController.listSalarySlip);

module.exports = router;
