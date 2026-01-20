const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    const {
        name, email, countryCode, phone, subject, areaOfInterest,
        companyName, role, yearStarted, interestedArea,
        yearsOfExperience, previousCompany, message
    } = req.body;

    console.log('Received form data:', JSON.stringify(req.body, null, 2));

    // Verify Resend is configured
    if (!resend) {
        console.error('RESEND_API_KEY not configured!');
        return res.status(500).json({
            message: 'Email service (Resend) not configured. Please check server environment variables.'
        });
    }

    // FIRE-AND-FORGET: Respond immediately to the frontend
    res.status(200).json({
        message: 'Email sending initiated successfully',
        info: { messageId: 'queued-for-delivery' }
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
    const emailOptions = {
        from: 'Innoaivators <onboarding@resend.dev>', // Use verified domain or onboarding email
        to: 'innoaivation@gmail.com',
        reply_to: email,
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

    // Send email asynchronously
    console.log('Attempting to send email via Resend...');

    const logFile = path.join(__dirname, 'email.log');
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    };

    try {
        const { data, error } = await resend.emails.send(emailOptions);
        if (error) {
            console.error('Resend Error:', error);
            log(`ERROR: Failed to send to ${email}. Error: ${error.message}`);
        } else {
            console.log('Email sent successfully via Resend:', data.id);
            log(`SUCCESS: Email sent to ${email} (Resend ID: ${data.id})`);
        }
    } catch (error) {
        console.error('Error sending email (Resend Exception):', error);
        log(`ERROR: Failed to send to ${email}. Exception: ${error.message}`);
    }
});

// Debug endpoint to verify Resend configuration
app.get('/api/debug-email', async (req, res) => {
    console.log('Debug email endpoint hit');

    const debugInfo = {
        envApiKeySet: !!process.env.RESEND_API_KEY,
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        apiKeyPrefix: process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 5)}...` : 'not set'
    };

    if (!resend) {
        return res.status(500).json({
            status: 'error',
            message: 'RESEND_API_KEY missing in Render',
            debugInfo
        });
    }

    try {
        console.log('Sending debug email via Resend...');
        const { data, error } = await resend.emails.send({
            from: 'Innoaivators Debug <onboarding@resend.dev>',
            to: 'innoaivation@gmail.com',
            subject: 'Resend Debug Email Test',
            text: 'This is a synchronous debug email to verify Resend configuration on Render.',
        });

        if (error) {
            return res.status(500).json({
                status: 'error',
                message: 'Resend API returned an error',
                error,
                debugInfo
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Email sent successfully via Resend',
            id: data.id,
            debugInfo
        });
    } catch (error) {
        console.error('Resend debug email failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email via Resend',
            error: error.message,
            debugInfo
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
