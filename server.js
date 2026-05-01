// const express = require('express');
// const cors = require('cors');
// const nodemailer = require('nodemailer');
// const multer = require('multer'); // File handling ke liye
// require('dotenv').config();

// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Multer Setup: File ko memory mein store karne ke liye
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // 1. Transporter for info@essentia.in (CONTACT_EMAIL)
// const contactTransporter = nodemailer.createTransport({
//     host: 'smtp.office365.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: process.env.CONTACT_EMAIL,
//         pass: process.env.CONTACT_PASS
//     },
//     tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
// });

// // 2. Transporter for hr@essentia.in (CAREER_EMAIL)
// const careerTransporter = nodemailer.createTransport({
//     host: 'smtp.office365.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: process.env.CAREER_EMAIL,
//         pass: process.env.CAREER_PASS
//     },
//     tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
// });

// // --- ROUTES ---

// // CONTACT API: Sends ONLY to info@essentia.in
// app.post('/api/contact', async (req, res) => {
//     const { name, email, subject, message } = req.body;
//     try {
//         await contactTransporter.sendMail({
//             from: process.env.CONTACT_EMAIL,
//             to: process.env.CONTACT_EMAIL,
//             subject: `New Contact Inquiry: ${subject}`,
//             text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
//         });
//         res.status(200).json({ message: 'Enquiry sent to info@essentia.in' });
//     } catch (error) {
//         console.error("Contact Mail Error:", error);
//         res.status(500).json({ error: 'Failed to send' });
//     }
// });

// // CAREER API: Sends to BOTH info@essentia.in AND hr@essentia.in
// // 'resume' wahi naam hona chahiye jo frontend FormData mein append kiya hai
// app.post('/api/career', upload.single('resume'), async (req, res) => {
//     const { name, email, phone, category, portfolio, message } = req.body;
//     const file = req.file;

//     try {
//         // Mail options with attachment
//         const mailOptions = {
//             subject: `New Job Application: ${category} - ${name}`,
//             text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nCategory: ${category}\nPortfolio Link: ${portfolio}\nMessage: ${message}`,
//             attachments: file ? [
//                 {
//                     filename: file.originalname,
//                     content: file.buffer
//                 }
//             ] : []
//         };

//         // 1. info@essentia.in par bhej rahe hain (Using contactTransporter)
//         await contactTransporter.sendMail({
//             ...mailOptions,
//             from: process.env.CONTACT_EMAIL,
//             to: process.env.CONTACT_EMAIL
//         });

//         // 2. hr@essentia.in par bhej rahe hain (Using careerTransporter)
//         await careerTransporter.sendMail({
//             ...mailOptions,
//             from: process.env.CAREER_EMAIL,
//             to: process.env.CAREER_EMAIL
//         });

//         res.status(200).json({ message: 'Application sent to both info and hr' });
//     } catch (error) {
//         console.error("Career Mail Error:", error);
//         res.status(500).json({ error: 'Failed to send career email' });
//     }
// });

// // Vercel export
// module.exports = app;

// // Local check
// const PORT = process.env.PORT || 10000;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });




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

// CONTACT API: Sends Email AND pushes lead to CRM
app.post('/api/contact', async (req, res) => {
    // Frontend se phone bhi receive kar rahe hain ab
    const { name, email, phone, subject, message } = req.body; 
    
    try {
        // 1. Pehle Email Send Karo
        await contactTransporter.sendMail({
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL,
            subject: `New Contact Inquiry: ${subject}`,
            text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\nMessage: ${message}`
        });

        // 2. Ab CRM me Lead Push Karo
        const crmPayload = {
            "firstName": name || "",
            "lastName": "",
            "email": email || "",
            "mobile": phone || "",
            "phoneCountryCode": "91",
            "countryCode": "91",
            "description": `Subject: ${subject} | Message: ${message}`,
            "leadPriority": "1"
        };

        const crmResponse = await fetch('https://haryana.my-co.app/essentia/crm/api/v1/lead/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authToken': 'VFeg9wTQFoo5/XViGgq0fA==.8qzwzCDcwryveXway6TJIA==',
                'timeZone': 'Asia/Calcutta'
            },
            body: JSON.stringify(crmPayload)
        });

        if (!crmResponse.ok) {
    const errorText = await crmResponse.text(); // JSON ki jagah TEXT read karo
    console.error("CRM Error Status:", crmResponse.status);
    console.error("CRM HTML Error Page:", errorText); // Yahan pata chalega ki server kya error de raha hai
} else {
    const responseData = await crmResponse.json();
    console.log("Lead pushed to CRM successfully!", responseData);
}

        res.status(200).json({ message: 'Enquiry sent to email and CRM successfully' });
    } catch (error) {
        console.error("Contact API Error:", error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// CAREER API: Sends to BOTH info@essentia.in AND hr@essentia.in
app.post('/api/career', upload.single('resume'), async (req, res) => {
    const { name, email, phone, category, portfolio, message } = req.body;
    const file = req.file;

    try {
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

        await contactTransporter.sendMail({
            ...mailOptions,
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL
        });

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
