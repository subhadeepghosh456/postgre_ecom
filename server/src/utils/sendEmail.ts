import nodemailer, { Transporter } from 'nodemailer';

// Configure the transporter
const transporter: Transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // e.g., smtp.gmail.com
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  await transporter.sendMail({
    from: '"Your App Name" <no-reply@yourapp.com>',
    to,
    subject,
    html,
  });
};