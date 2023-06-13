const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");
module.exports = class WfhEmail {
  constructor(user, wfh, type = null) {
    this.to = "No Reply<infoleave.softrefine@gmail.com>";
    this.from = "Softrefine <infoleave.softrefine@gmail.com>";
    if (type == "updateWfhByAdmin") {
      this.to = "No Reply<" + user.email + ">";
      this.status = wfh.Status;
      if(wfh.reasonToCancel) {
        this.reasonToCancel = wfh.reasonToCancel
      }
    }

    if (type == "applyWFH") {
      this.to = wfh.adminEmail.join(",");
      this.status = wfh.Status;
    }

    this.email = user.email.split("@")[0];
    this.name = user.name;
    this.toDate = wfh.ToDate;
    this.fromDate = wfh.FromDate;
    this.purpose = wfh.Purpose;
    this.subjectTitle = wfh.Subject;
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

  async sendWFH(template, subject) {
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

  async sendApproveWFH(template, subject) {
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
};
