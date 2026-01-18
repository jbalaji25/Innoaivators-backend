const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
// Middleware
app.use(cors({
    origin: '*', // Allow all origins for debugging
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// Root endpoint for basic connectivity check
app.get('/', (req, res) => {
    console.log('Root endpoint hit');
    res.status(200).send('Backend is running!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('Health check endpoint hit');
    res.status(200).json({
        status: 'ok',
        message: 'Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Create transporter with connection pooling
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true, // Enable connection pooling
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.log('Transporter verification error:', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    const {
        name, email, countryCode, phone, subject, areaOfInterest,
        companyName, role, yearStarted, interestedArea,
        yearsOfExperience, previousCompany, message
    } = req.body;

    console.log('Received form data:', JSON.stringify(req.body, null, 2));

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
        // Verify email credentials are configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Email credentials not configured!');
            return res.status(500).json({
                message: 'Email service not configured. Please check server environment variables.'
            });
        }

        // FIRE-AND-FORGET: Send success response immediately
        res.status(200).json({ message: 'Email request received. Sending in background.' });

        // Send email in background
        console.log('Attempting to send email (background)...');
        transporter.sendMail(mailOptions)
            .then(info => {
                console.log('Email sent successfully:', info.messageId);
            })
            .catch(error => {
                console.error('Error sending email (background):');
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
            });

    } catch (error) {
        console.error('Synchronous error:', error);
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Failed to process request',
                error: error.message
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
