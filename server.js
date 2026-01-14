const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    const {
        name, email, countryCode, phone, subject, areaOfInterest,
        companyName, role, yearStarted, interestedArea,
        yearsOfExperience, previousCompany, message
    } = req.body;

    console.log('Received form data:', JSON.stringify(req.body, null, 2));

    // Create transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Construct email body based on subject
    let details = '';
    if (subject === 'Start a Project') {
        details += `Area of Interest: ${areaOfInterest}\n`;
    } else if (subject === 'Partnership') {
        details += `Company: ${companyName}\n`;
        details += `Role: ${role}\n`;
        details += `Year Started: ${yearStarted}\n`;
    } else if (subject === 'Careers') {
        details += `Interested Area: ${interestedArea}\n`;
        details += `Experience: ${yearsOfExperience}\n`;
        if (previousCompany) details += `Previous Company: ${previousCompany}\n`;
    }

    // Email content
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'innoaivation@gmail.com',
        subject: `Innoaivators Contact: ${subject || 'General Inquiry'}`,
        text: `
Name: ${name}
Email: ${email}
Phone: ${countryCode} ${phone}
Subject: ${subject || 'General Inquiry'}

${details}

Message:
${message}
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send email', error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
