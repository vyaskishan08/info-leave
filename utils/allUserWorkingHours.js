const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");
const xlsx = require("xlsx");
const fs = require('fs');

module.exports = class allUserWorkingHours{
    constructor(adminEmails) {
    this.from = "Softrefine <infoleave.softrefine@gmail.com>";
    this.adminEmails = adminEmails.join(",");
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

    async sendAllUserWorkingHoursSheet(filePath,subject) {
        const data = fs.readFileSync(filePath);
        const html = "<h3>Please Check The Attachemnt file</h3>";
        const mailOptions = {
          from: this.from,
          to: this.adminEmails,
          subject,
          html,
          text: htmlToText(html),
          attachments: [
            {
                filename:'UsersWorkingHours.xlsx',
                content:data,
                contentType:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        ],
        };

        await this.newTransport().sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
        });
      }
}