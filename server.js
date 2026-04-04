const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer'); // File handling ke liye
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Multer Setup: File ko memory mein store karne ke liye
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 1. Transporter for info@essentia.in (CONTACT_EMAIL)
const contactTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.CONTACT_EMAIL,
        pass: process.env.CONTACT_PASS
    },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// 2. Transporter for hr@essentia.in (CAREER_EMAIL)
const careerTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.CAREER_EMAIL,
        pass: process.env.CAREER_PASS
    },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// --- ROUTES ---

// CONTACT API: Sends ONLY to info@essentia.in
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    try {
        await contactTransporter.sendMail({
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL,
            subject: `New Contact Inquiry: ${subject}`,
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
        });
        res.status(200).json({ message: 'Enquiry sent to info@essentia.in' });
    } catch (error) {
        console.error("Contact Mail Error:", error);
        res.status(500).json({ error: 'Failed to send' });
    }
});

// CAREER API: Sends to BOTH info@essentia.in AND hr@essentia.in
// 'resume' wahi naam hona chahiye jo frontend FormData mein append kiya hai
app.post('/api/career', upload.single('resume'), async (req, res) => {
    const { name, email, phone, category, portfolio, message } = req.body;
    const file = req.file;

    try {
        // Mail options with attachment
        const mailOptions = {
            subject: `New Job Application: ${category} - ${name}`,
            text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nCategory: ${category}\nPortfolio Link: ${portfolio}\nMessage: ${message}`,
            attachments: file ? [
                {
                    filename: file.originalname,
                    content: file.buffer
                }
            ] : []
        };

        // 1. info@essentia.in par bhej rahe hain (Using contactTransporter)
        await contactTransporter.sendMail({
            ...mailOptions,
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL
        });

        // 2. hr@essentia.in par bhej rahe hain (Using careerTransporter)
        await careerTransporter.sendMail({
            ...mailOptions,
            from: process.env.CAREER_EMAIL,
            to: process.env.CAREER_EMAIL
        });

        res.status(200).json({ message: 'Application sent to both info and hr' });
    } catch (error) {
        console.error("Career Mail Error:", error);
        res.status(500).json({ error: 'Failed to send career email' });
    }
});

// Vercel export
module.exports = app;

// Local check
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
