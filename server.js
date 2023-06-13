const mongoose = require("mongoose");
var express = require("express");
require("dotenv").config();
var app = express();

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! Shutting Down");
  console.log(err.name, err.message);
  process.exit(1);
});

app = require("./app");
// app.use(cors());

const DB = process.env.DATABASE;

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connection Successful"));

const port = process.env.PORT || 5001;

server = app.listen(port, () => console.log(`app running on port ${port}`));

process.on("unhandledRejection", (err) => {
  console.log("UNHANDELED REJECTION! shutting down");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
