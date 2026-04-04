// // const express = require('express');
// // const nodemailer = require('nodemailer');
// // const cors = require('cors');
// // const multer = require('multer');
// // require('dotenv').config();

// // const app = express();

// // // Middlewares
// // app.use(cors());
// // app.use(express.json()); // JSON data ko read karne ke liye (Contact form)

// // // Multer Setup - Career form me Resume handle karne ke liye
// // const storage = multer.memoryStorage(); // File ko memory mein rakhenge
// // const upload = multer({ storage: storage });

// // // Nodemailer Setup
// // // const transporter = nodemailer.createTransport({
// // //     service: 'gmail',
// // //     auth: {
// // //         user: process.env.EMAIL_USER,
// // //         pass: process.env.EMAIL_PASS
// // //     }
// // // });

// // const transporter = nodemailer.createTransport({
// //     host: 'smtp.gmail.com',
// //     port: 465,
// //     secure: true, // SSL ka use karega
// //     auth: {
// //         user: process.env.EMAIL_USER,
// //         pass: process.env.EMAIL_PASS
// //     },
// //     tls: {
// //         // Render server se connection fail na ho isliye ye add karna zaruri hai
// //         rejectUnauthorized: false
// //     }
// // });


// // // ----------------------------------------------------
// // // 1. CONTACT FORM ROUTE
// // // ----------------------------------------------------
// // app.post('/api/contact', async (req, res) => {
// //     const { name, phone, email, subject, message } = req.body;

// //     const mailOptions = {
// //         from: process.env.EMAIL_USER,
// //         to: process.env.EMAIL_USER, // Jisko mail receive karni hai (aap khud)
// //         subject: `New Contact Enquiry: ${subject || 'No Subject'}`,
// //         html: `
// //             <h3>New Contact Detail</h3>
// //             <p><strong>Name:</strong> ${name}</p>
// //             <p><strong>Phone:</strong> ${phone}</p>
// //             <p><strong>Email:</strong> ${email}</p>
// //             <p><strong>Subject:</strong> ${subject}</p>
// //             <p><strong>Message:</strong><br>${message}</p>
// //         `
// //     };

// //     try {
// //         await transporter.sendMail(mailOptions);
// //         res.status(200).json({ success: true, message: 'Message sent successfully!' });
// //     } catch (error) {
// //         console.error("Error sending contact email: ", error);
// //         res.status(500).json({ success: false, message: 'Failed to send message.' });
// //     }
// // });

// // // ----------------------------------------------------
// // // 2. CAREER FORM ROUTE (With file upload)
// // // ----------------------------------------------------
// // // Frontend se "resume" key ke under file aayegi
// // app.post('/api/career', upload.single('resume'), async (req, res) => {
// //     const { name, email, phone, category, portfolio, message } = req.body;
// //     const file = req.file;

// //     const mailOptions = {
// //         from: process.env.EMAIL_USER,
// //         to: process.env.EMAIL_USER,
// //         subject: `New Job Application: ${name} for ${category}`,
// //         html: `
// //             <h3>Job Application Info</h3>
// //             <p><strong>Role Applied For:</strong> ${category}</p>
// //             <p><strong>Name:</strong> ${name}</p>
// //             <p><strong>Email:</strong> ${email}</p>
// //             <p><strong>Phone:</strong> ${phone}</p>
// //             <p><strong>Portfolio:</strong> <a href="${portfolio}">${portfolio}</a></p>
// //             <p><strong>Message:</strong><br>${message}</p>
// //         `,
// //         attachments: file ? [
// //             {
// //                 filename: file.originalname,
// //                 content: file.buffer // File directly memory se bhejenge
// //             }
// //         ] : []
// //     };

// //     try {
// //         await transporter.sendMail(mailOptions);
// //         res.status(200).json({ success: true, message: 'Application submitted successfully!' });
// //     } catch (error) {
// //         console.error("Error sending career email: ", error);
// //         res.status(500).json({ success: false, message: 'Failed to submit application.' });
// //     }
// // });

// // // Server Start
// // const PORT = process.env.PORT || 5000;
// // app.listen(PORT, () => {
// //     console.log(`Server is running on port ${PORT}`);
// // });





// const express = require('express');
// const cors = require('cors');
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// // Ye line miss ho gayi thi pehle!
// const app = express();

// // Middleware (Frontend se data receive karne ke liye)
// app.use(cors());
// app.use(express.json());

// // 1. Contact Page ke liye Transporter (info@essentia.in)
// const contactTransporter = nodemailer.createTransport({
//     host: 'smtp.office365.com',
//     port: 587,
//     secure: false, // STARTTLS
//     auth: {
//         user: process.env.CONTACT_EMAIL,
//         pass: process.env.CONTACT_PASS
//     },
//     tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
// });

// // 2. Career Page ke liye Transporter (hr@essentia.in)
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

// // Contact API
// app.post('/api/contact', async (req, res) => {
//     const { name, email, subject, message } = req.body;
//     try {
//         await contactTransporter.sendMail({
//             from: process.env.CONTACT_EMAIL,
//             to: process.env.CONTACT_EMAIL, // Aapko isi par mail aayegi
//             subject: `New Contact Inquiry: ${subject}`,
//             text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
//         });
//         res.status(200).json({ message: 'Enquiry sent to info@essentia.in' });
//     } catch (error) {
//         console.error("Contact Mail Error:", error);
//         res.status(500).json({ error: 'Failed to send' });
//     }
// });

// // Career API
// app.post('/api/career', async (req, res) => {
//     // Agar form mein aur fields hain toh yahan add kar lena (jaise phone, resume link etc)
//     const { name, email, message } = req.body;
//     try {
//         await careerTransporter.sendMail({
//             from: process.env.CAREER_EMAIL,
//             to: process.env.CAREER_EMAIL, // HR ko is par mail aayegi
//             subject: `New Job Application from ${name}`,
//             text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
//         });
//         res.status(200).json({ message: 'Application sent to hr@essentia.in' });
//     } catch (error) {
//         console.error("Career Mail Error:", error);
//         res.status(500).json({ error: 'Failed to send' });
//     }
// });

// // Vercel ke liye export
// module.exports = app;

// // Local terminal check ke liye
// const PORT = process.env.PORT || 10000;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });




const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1. Transporter for info@essentia.in
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

// 2. Transporter for hr@essentia.in
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

// CONTACT API (Sends only to info@)
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

// CAREER API (Sends to BOTH info@ and hr@)
app.post('/api/career', async (req, res) => {
    const { name, email, message, phone } = req.body;
    try {
        // First Email: Sending to info@essentia.in
        await contactTransporter.sendMail({
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL,
            subject: `New Career Inquiry Alert: ${name}`,
            text: `A new application has been received.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}`
        });

        // Second Email: Sending to hr@essentia.in
        await careerTransporter.sendMail({
            from: process.env.CAREER_EMAIL,
            to: process.env.CAREER_EMAIL,
            subject: `New Job Application: ${name}`,
            text: `Detailed Application Info:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}`
        });

        res.status(200).json({ message: 'Application sent to both info and hr' });
    } catch (error) {
        console.error("Career Mail Error:", error);
        res.status(500).json({ error: 'Failed to send career email' });
    }
});

// Vercel ke liye export
module.exports = app;

// Local terminal check
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
