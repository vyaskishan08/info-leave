const IP = '117.99.97.240';
const path = require('path');
const spawn = require('child_process').spawn;
const DB = process.env.DATABASE;
const fs = require('fs');
const uri = `${(DB.substring(0,83))}`;
const MongoClient = require('mongodb').MongoClient;
const dbName = 'myFirstDatabase';
const client = new MongoClient(uri, {useUnifiedTopology:true,useNewUrlParser: true, });
const ARCHIVE_PATH = path.join(__dirname,"..",`${dbName}.json`);
var mongoose = require("mongoose");
module.exports = {
  IP
}

const DataLimit = {
  PER_PAGE: 10,
};
module.exports = DataLimit;

module.exports.getBusinessDatesCount = async function(startDate, endDate) { 
 let count = 0;
  const curDate = new Date(startDate);
  const end = new Date(endDate);
  while (curDate <= end) {
      const dayOfWeek = curDate.getDay();
      if(dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
  }
 
  return count;
}

module.exports.findMaxIpAddress = async function(array){
  if (array.length == 0) return null;
  var modeMap = {},
    maxCount = 1,
    modes = [];

  for (var i = 0; i < array.length; i++) {
    var el = array[i];

    if (modeMap[el] == null) modeMap[el] = 1;
    else modeMap[el]++;

    if (modeMap[el] > maxCount) {
      modes = [{ip:el}];
      maxCount = modeMap[el];
    } else if (modeMap[el] == maxCount) {
      modes.push({ip:el});
      maxCount = modeMap[el];
    }
  }
  modes.maxCount = maxCount;
  return modes;
}

module.exports.databaseBackup = async function () {

  client.connect(function(err) {
    console.log('Connected successfully to server');
    const db = client.db(dbName);
    const now = new Date();
    const month = now.getMonth()+1;
    const collections = [ 'users', 'attendances','leaves','terms','excels','email_templates','workhomes','branches','userperformances','systeminfos','logs','salaryslips' ];
    collections.forEach(async collection => {
      const documents =  await getDocuments(db, collection);
      const folderName = `../databaseBackup/LatestBackup`;

      try {
        if (!fs.existsSync(folderName)) {
          fs.mkdirSync(folderName,{ recursive: true });
        }
      } catch (err) {
        console.error(err);
      }
      try {
        // Write files outside of server directory
        // prevents app restarts on nodemon
        fs.writeFile(`../databaseBackup/${folderName}/`+collection+'.json', JSON.stringify(documents), err => {
        });
        console.log('Done writing to file.');
      } catch (err) { 
        console.log('Error writing to file', err);
      }
    })
  });
  
  async function getDocuments(db, collection) {
    return await db.collection(collection).find({}).toArray();
  };
}

module.exports.leaveDatePayload = async function (startDate,endDate) {
  let data = {
    "myLeave.Subject": "Half Leave",
    $or: [
      {
        "myLeave.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myLeave.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
  }
  return data;
}

module.exports.leaveUserPayload = async function (startDate,endDate,userId) {
  let data = {
    "user":mongoose.Types.ObjectId(userId),
    "myLeave.Subject": "Half Leave",
    $or: [
      {
        "myLeave.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myLeave.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
  }
  return data;
}

module.exports.leaveUserPayloadActive = async function (startDate,endDate,userId) {
  let data = {
    "user":mongoose.Types.ObjectId(userId),
    "myLeave.Subject": "Half Leave",
    "myLeave.Status":{
      $ne:"Canceled"
    },
    $or: [
      {
        "myLeave.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myLeave.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
    
  }
  return data;
}

module.exports.attendanceDatePayload = async function (startDate,endDate) {
  let data = {
    "myAttendance.createdAt":{
      $gte: new Date(startDate),
      $lt: new Date(endDate),
    }
  }
  return data;
}

module.exports.attendanceUserPayload = async function (startDate,endDate,userId) {
  let data = {
    "user._id":mongoose.Types.ObjectId(userId),
    "myAttendance.createdAt":{
      $gte: new Date(startDate),
      $lt: new Date(endDate),
    }
  }
  return data;
}

module.exports.wfhDatePayload = async function (startDate,endDate) {
  let data = {
    "myWfh.Subject": "Half Day",
    $or: [
      {
        "myWfh.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myWfh.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
  }
  return data;
}

module.exports.wfhUserPayload = async function (startDate,endDate,userId) {
  let data = {
    "user":mongoose.Types.ObjectId(userId),
    "myWfh.Subject": "Half Day",
    $or: [
      {
        "myWfh.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myWfh.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
  }
  return data;
}

module.exports.wfhUserPayloadActive = async function (startDate,endDate,userId) {
  let data = {
    "user":mongoose.Types.ObjectId(userId),
    "myWfh.Subject": "Half Day",
    "myWfh.Status":{
      $ne:"Canceled"
    },
    $or: [
      {
        "myWfh.FromDate": {
          $gte: new Date(startDate),
          $lt: new Date(endDate),
        },
      },
      {
        "myWfh.ToDate": {
          $lt: new Date(endDate),
          $gte: new Date(startDate),
        },
      },
    ],
  }
  return data;
}