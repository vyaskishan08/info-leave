const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const termController = require("../controllers/TermsController");
const fs = require('fs');
let path = require('path');

router.use(userController.verifyJWT);

router.post("/pdf", (req, res) => {
    var filePath = "../terms.pdf";
    res.sendFile(path.join(__dirname, '..', '/terms.pdf'));
  });

// ---- API RESTRICT TO TEAMLEADER OR ADMIN --- //

router.get("/", termController.getTerm);

router.post("/",termController.updateTerm);
module.exports = router;
