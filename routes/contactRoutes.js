const express = require('express');
const router = express.Router();
// لا حاجة لاستيراد nodemailer هنا مباشرة، سيتم تمرير transporter
// const nodemailer = require('nodemailer'); // NEW: Import nodemailer here

// يجب أن يتم تمرير transporter من server.js
module.exports = ({ nodemailerTransporter, ADMIN_EMAIL }) => {
    // التأكد من أن البريد الإلكتروني للمسؤول موجود
    if (!ADMIN_EMAIL || ADMIN_EMAIL.length < 5) {
        console.warn('ContactRoutes: ADMIN_EMAIL is missing or too short. Contact form submissions will not be sent to an admin.');
    }

    // 1. POST /api/contact - إرسال رسالة من نموذج الاتصال
    router.post('/', async (req, res) => {
        const { name, email, subject, message } = req.body;

        // تحقق بسيط من البيانات
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (!ADMIN_EMAIL) {
            console.error('ContactRoutes: ADMIN_EMAIL is not configured. Cannot send contact form email.');
            return res.status(500).json({ message: 'Server email configuration error. Please try again later.' });
        }

        try {
            // إعداد خيارات البريد الإلكتروني
            let mailOptions = {
                from: process.env.SENDER_EMAIL, // البريد الإلكتروني المرسل منه (يجب أن يكون في .env)
                to: ADMIN_EMAIL, // البريد الإلكتروني الذي ستصل إليه الرسالة (للمسؤول)
                replyTo: email, // لتمكين الرد على بريد المستخدم مباشرة
                subject: `Contact Form Message: ${subject} from ${name}`,
                html: `
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <p><strong>Message:</strong></p>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    <br>
                    <p>---</p>
                    <p>This message was sent via the contact form on your Negroo Store website.</p>
                `
            };

            // إرسال البريد الإلكتروني
            await nodemailerTransporter.sendMail(mailOptions);

            console.log('Contact form email sent successfully from:', email);
            res.status(200).json({ message: 'Your message has been sent successfully!' });

        } catch (error) {
            console.error('Error sending contact form email:', error);
            res.status(500).json({ message: 'Failed to send your message due to a server error. Please try again later.' });
        }
    });

    return router;
};