const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");

module.exports = class Email {
  constructor(user, leave, type = null) {
    this.to = "No Reply<infoleave.softrefine@gmail.com>";
    this.from = "Softrefine <infoleave.softrefine@gmail.com>";
    if (type == "updateLeaveByAdmin") {
      this.to = "No Reply<" + user.email + ">";
      this.status = leave.Status;
      if(leave.reasonToCancel) {
        this.reasonToCancel = leave.reasonToCancel
      }
    }

    if(type == "deleteLeaveWfhbyUser"){
      this.to = leave.adminEmail.join(",");
      this.status = leave.Status;
    }

    if (type == "applyLeave") {
      this.to = leave.adminEmail.join(",");
      this.status = leave.Status;
    }

    if (type == "warningForDailyHours") {
      this.to = "No Reply<" + user.email + ">";
      this.cc = leave.adminEmail.join(",");
    }

    if(type == "warningForWeeklyHours") {
      this.to = "No Reply<" + user.email + ">";
      this.cc = leave.adminEmail.join(",");
    }

    this.email = user.email.split("@")[0];
    this.name = user.name;
    this.toDate = leave.ToDate;
    this.fromDate = leave.FromDate;
    this.purpose = leave.Purpose;
    this.subjectTitle = leave.Subject;
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

  async send(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      name: this.name,
      email: this.email,
      Subject: this.subjectTitle,
      fromDate: this.fromDate,
      toDate: this.toDate,
      purpose: this.purpose,
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
      // console.log("Message %s sent: %s", info.messageId, info.response);
    });
  }

  async sendApprove(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      name: this.name,
      email: this.email,
      fromDate: this.fromDate,
      toDate: this.toDate,
      purpose: this.purpose,
      status: this.status,
      Subject: this.subjectTitle,
      reasonToCancel:this.reasonToCancel
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

  async sendDelete(template, subject,actiontype) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      actionType:actiontype,
      name: this.name,
      email: this.email,
      fromDate: this.fromDate,
      toDate: this.toDate,
      purpose: this.purpose,
      status: this.status,
      Subject: this.subjectTitle,
      reasonToCancel:this.reasonToCancel
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
    });
  }

  async sendWarning(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      name: this.name,
      email: this.email,
    });
    const mailOptions = {
      from: this.from,
      to: this.to,
      cc: this.cc,
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

  async sendWeeklyWarning(template, subject) {
    const html = pug.renderFile(`${__dirname}/../templates/${template}.pug`, {
      name: this.name,
      email: this.email,
    });

    const mailOptions = {
      from: this.from,
      to: this.to,
      cc: this.cc,
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
