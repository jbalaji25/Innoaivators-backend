const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    console.log('Testing email configuration...');
    console.log('User:', process.env.EMAIL_USER);
    // Don't log the password!

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // use STARTTLS
        family: 4, // Force IPv4
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        console.log('Verifying transporter...');
        await transporter.verify();
        console.log('Transporter verified successfully.');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'innoaivation@gmail.com', // Sending to self/admin
            subject: 'Test Email from Debug Script',
            text: 'If you receive this, the email configuration is working correctly.',
        });
        console.log('Email sent successfully:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error occurred:');
        console.error(error);
    }
}

testEmail();
