const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");

module.exports = class LeaveEmail {
  constructor(adminEmails, userListArr, type = null) {
    this.to = "No Reply<infoleave.softrefine@gmail.com>";
    this.from = "Softrefine <infoleave.softrefine@gmail.com>";
    this.leaveList = userListArr[0];
    this.wfhList = userListArr[1];

    if (type == "onLeaveUser") {
        this.to = adminEmails.join(",");
    }
    if (type == "dailyWorkingHours" || type == "weeklyHours") {
      this.to = adminEmails.join(",");
      this.attendanceList = userListArr;
    }
  }

  newTransport() {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      service: "gmail",
      auth: {
        // should be replaced with real sender's account
        user: "infoleave.softrefine@gmail.com",
        pass: "teagzavneplqhjjt",
      },
    });
  }

  async sendOnUserLeave(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      leaveList :this.leaveList,
      wfhList :this.wfhList

    });
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    };

    await this.newTransport().sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      //console.log("Message %s sent: %s", info.messageId, info.response);
    });
  }

  async sendDailyHours(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      attendanceList :this.attendanceList,

    });
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    };

    await this.newTransport().sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      //console.log("Message %s sent: %s", info.messageId, info.response);
    });
  }

  async sendWeeklyHours(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      attendanceList :this.attendanceList,
    });
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    };

    await this.newTransport().sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      //console.log("Message %s sent: %s", info.messageId, info.response);
    });
  }
};