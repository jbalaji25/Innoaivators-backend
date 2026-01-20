const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const net = require('net');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

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

// Create transporter with smtp.googlemail.com and TLS tweaks
let smtpLogs = [];
const transporter = nodemailer.createTransport({
    host: 'smtp.googlemail.com',
    port: 465,
    secure: true, // use SSL/TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 30000,
    family: 4, // Force IPv4
    tls: {
        rejectUnauthorized: false,
        servername: 'smtp.googlemail.com'
    },
    logger: {
        info: (msg) => {
            const formatted = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            smtpLogs.push(`[INFO] ${formatted}`);
            console.log(msg);
        },
        warn: (msg) => {
            const formatted = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            smtpLogs.push(`[WARN] ${formatted}`);
            console.warn(msg);
        },
        error: (msg) => {
            const formatted = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            smtpLogs.push(`[ERROR] ${formatted}`);
            console.error(msg);
        },
        debug: (msg) => {
            const formatted = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            smtpLogs.push(`[DEBUG] ${formatted}`);
        },
    },
    debug: true
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
app.post('/api/send-email', (req, res) => {
    const {
        name, email, countryCode, phone, subject, areaOfInterest,
        companyName, role, yearStarted, interestedArea,
        yearsOfExperience, previousCompany, message
    } = req.body;

    console.log('Received form data:', JSON.stringify(req.body, null, 2));

    // Verify email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email credentials not configured!');
        return res.status(500).json({
            message: 'Email service not configured. Please check server environment variables.'
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
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'innoaivation@gmail.com',
        replyTo: email, // Allow replying directly to the client
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
    console.log('Attempting to send email in background...');

    const logFile = path.join(__dirname, 'email.log');
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    };

    transporter.sendMail(mailOptions)
        .then(info => {
            console.log('Email sent successfully:', info.messageId);
            console.log('SMTP Response:', info.response);
            log(`SUCCESS: Email sent to ${email} (MessageID: ${info.messageId})`);
        })
        .catch(error => {
            console.error('Error sending email (Background):');
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Full error:', error);
            log(`ERROR: Failed to send to ${email}. Error: ${error.message}`);
        });
});

// Debug endpoint to verify email configuration synchronously
app.get('/api/debug-email', async (req, res) => {
    console.log('Debug email endpoint hit');
    smtpLogs = []; // Clear logs for this request

    const debugInfo = {
        envUserSet: !!process.env.EMAIL_USER,
        envPassSet: !!process.env.EMAIL_PASS,
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        emailUser: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}...` : 'not set'
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({
            status: 'error',
            message: 'Environment variables missing in Render',
            debugInfo
        });
    }

    // Raw TCP Test
    const tcpTest = await new Promise((resolve) => {
        const socket = new net.Socket();
        const start = Date.now();
        socket.setTimeout(10000);

        socket.on('connect', () => {
            const duration = Date.now() - start;
            socket.destroy();
            resolve({ status: 'success', message: 'TCP Connection successful', duration: `${duration}ms` });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ status: 'error', message: 'TCP Connection timed out (10s)' });
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve({ status: 'error', message: `TCP Connection failed: ${err.message}`, code: err.code });
        });

        socket.connect(465, 'smtp.googlemail.com');
    });

    try {
        console.log('Verifying transporter...');
        // Add a longer timeout to the verification to prevent 502s
        const verifyPromise = transporter.verify();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Transporter verification timed out')), 35000)
        );

        await Promise.race([verifyPromise, timeoutPromise]);

        console.log('Sending debug email...');
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'innoaivation@gmail.com',
            subject: 'Debug Email Test',
            text: 'This is a synchronous debug email to verify deployment configuration.',
        });

        res.status(200).json({
            status: 'success',
            message: 'Email sent successfully',
            messageId: info.messageId,
            debugInfo,
            tcpTest,
            logs: smtpLogs
        });
    } catch (error) {
        console.error('Debug email failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email',
            error: error.message,
            code: error.code,
            debugInfo,
            tcpTest,
            logs: smtpLogs
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
