const Term = require("../model/TermsModel");
const catchAsync = require("../utils/catchAsync");
const html_to_pdf = require("html-pdf-node");
var fs = require("fs");
let path = require("path");
const puppeteer = require("puppeteer");

// ---- API RESTRICT TO ADMIN --- //


exports.getTerm = catchAsync(async (req, res, next) => {
  let terms;
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  terms = await Term.findOne();

  return res.status(200).json({
    status: "success",
    data: terms,
  });
});

exports.updateTerm = catchAsync(async (req, res, next) => {
  if(req.user.userRole != 'admin') {
    return next(new AppError("You do not have permission to access this route.",403));
  }

  const terms = await Term.findOne();
  if (terms) {
    let fileexist=fs.existsSync(path.join(__dirname, "..", "/terms.pdf"));
    if(fileexist){
    const file=fs.unlinkSync(path.join(__dirname, "..", "/terms.pdf"));
    }
    await Term.updateOne(
      { _id: terms._id },
      {
        $set: { content: req.body.content, filename: "terms.pdf" },
      }
    );
  } else {
    await Term.create({ content: req.body.content, filename: "terms.pdf" });
  }

  const browser = await puppeteer.launch({
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox"],
  });

  // create a new page
  const page = await browser.newPage();
  await page.setContent(req.body.content, {
    waitUntil: "domcontentloaded",
  });

  // create a pdf buffer
  const pdfBuffer = await page.pdf({
    format: "A4",
  });

  // or a .pdf file
  await page
  .pdf({
    format: "A4",
    path: path.join(__dirname, "..", "/terms.pdf"),
  })
  .then(async (resp) => {
    return res.status(200).json({
      status: "success",
      data: {},
    });
  })
  .catch((err) => {
    return res.status(403).json({
      status: "fail",
      error: err,
    });
  });
});
