const { User, RecentProject } = require("../Model/model.js");
const bcrypt = require("bcryptjs");
const { v2: cloudinary } = require("cloudinary");
const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");
const fs = require("fs");

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Check if Cloudinary credentials are available
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("Cloudinary credentials are missing. Please check your environment variables.");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function maybeUploadToCloudinary(fileBuffer, folder = "user_profiles") {
  if (!fileBuffer) return null;
  try {
    const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${fileBuffer.toString('base64')}`, {
        folder,
        width: 300,
        height: 300,
        crop: "fill",
    });
    return result.secure_url
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null;
  }
}

// Email transporter using Gmail with optimized settings for serverless
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Must be Gmail App Password (16 characters, NO SPACES)
  },
  // Disable pooling for serverless
  pool: false,
  // Timeout settings optimized for serverless
  connectionTimeout: 30000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  // Debug logging
  debug: true,
  logger: true,
  tls: {
    rejectUnauthorized: true // Changed to true for better security
  }
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Nodemailer transporter verification failed:", error);
  } else {
    console.log("✅ Nodemailer transporter is ready to send emails");
  }
});

// Controller for uploading a project
const uploadProject = async (req, res) => {
  try {
    console.log("Upload request received at:", new Date().toISOString());
    console.log("Body:", req.body);
    console.log("File:", req.file ? "Present" : "Missing");

    const { projectTitle, projectDescription, projectLink } = req.body;
    const file = req.file;

    if (!projectTitle || !projectDescription || !projectLink || !file) {
      console.log("Missing fields:", { projectTitle, projectDescription, projectLink, file: !!file });
      return res.status(400).json({ message: "All fields are required, including the image" });
    }

    console.log("Uploading to Cloudinary...");
    const imageUrl = await maybeUploadToCloudinary(file.buffer, "projects");

    if (!imageUrl) {
      console.log("Cloudinary upload failed");
      return res.status(500).json({ message: "Image upload failed" });
    }

    console.log("Saving to database...");
    const newProject = new RecentProject({
      profilePicture: imageUrl,
      projectTitle,
      projectDescription,
      projectLink,
    });

    await newProject.save();
    console.log("Project saved successfully");

    res.status(201).json({ message: "Project uploaded successfully", project: newProject });
  } catch (error) {
    console.error("Upload project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller for fetching recent projects
const getRecentProjects = async (req, res) => {
  try {
    const projects = await RecentProject.find().sort({ createdAt: -1 });
    res.status(200).json({ projects });
  } catch (error) {
    console.error("Fetch recent projects error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller for deleting a project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    const project = await RecentProject.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Delete image from Cloudinary if it exists
    if (project.profilePicture) {
      try {
        const publicId = project.profilePicture.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`projects/${publicId}`);
      } catch (cloudinaryError) {
        console.log("Cloudinary delete error:", cloudinaryError);
        // Continue to delete the cloudinary even if its fails
      }
    }

    await RecentProject.findByIdAndDelete(id);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.log("Delete project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller for sending message
const sendMessage = async (req, res) => {
  try {
    console.log("📧 Send message request received at:", new Date().toISOString());
    console.log("Body:", req.body);

    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      console.log("❌ Missing fields:", { name, namePresent: !!name, emailPresent: !!email, messagePresent: !!message });
      return res.status(400).json({ message: "All fields are required" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if Gmail credentials are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ Gmail credentials not set in environment variables");
      return res.status(500).json({ message: "Email service not configured. Admin please check environment variables." });
    }

    console.log("🔑 EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("🔑 EMAIL_PASS length:", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : "Not set");

    const mailOptions = {
      from: process.env.EMAIL_USER, // Must use your Gmail account as sender
      replyTo: email, // Set visitor's email as reply-to so you can reply directly
      to: process.env.EMAIL_USER, // Your email to receive messages
      subject: `Portfolio Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h2>New Portfolio Contact Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: #fff; padding: 15px; border-left: 4px solid #007bff; border-radius: 3px;">
            ${message.replace(/\n/g, '<br>')}
          </p>
        </div>
      `,
    };

    console.log("📤 Attempting to send email via Gmail SMTP...");
    console.log("Mail options:", {
      from: mailOptions.from,
      replyTo: mailOptions.replyTo,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully via Gmail");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    
    res.status(200).json({ 
      message: "Message sent successfully",
      messageId: info.messageId 
    });

  } catch (error) {
    console.error("❌ Send message error occurred");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error:", error);

    // Provide specific error messages based on error type
    let userMessage = "Failed to send message";
    if (error.message.includes("Invalid login")) {
      userMessage = "Email authentication failed. Please check your Gmail App Password.";
    } else if (error.message.includes("connect ECONNREFUSED")) {
      userMessage = "Could not connect to Gmail SMTP server. Please try again later.";
    } else if (error.message.includes("ENOTFOUND")) {
      userMessage = "Network error. Please check your internet connection.";
    }

    res.status(500).json({ 
      message: userMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Test endpoint to verify email configuration
const testEmailConnection = async (req, res) => {
  try {
    console.log("🧪 Testing email connection...");
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ 
        success: false,
        message: "Email credentials not configured",
        EMAIL_USER: process.env.EMAIL_USER ? "Set" : "Missing",
        EMAIL_PASS: process.env.EMAIL_PASS ? "Set" : "Missing"
      });
    }

    // Verify the transporter
    const verified = await transporter.verify();
    
    if (verified) {
      console.log("✅ Email transporter is working correctly");
      return res.status(200).json({ 
        success: true,
        message: "Email service is configured and working!",
        email: process.env.EMAIL_USER,
        smtpHost: "smtp.gmail.com",
        smtpPort: 465
      });
    } else {
      return res.status(500).json({ 
        success: false,
        message: "Email verification failed"
      });
    }
  } catch (error) {
    console.error("❌ Email test error:", error);
    res.status(500).json({ 
      success: false,
      message: "Email connection test failed",
      error: error.message,
      hint: "Make sure: 1) Gmail 2FA is enabled, 2) App Password is 16 chars with NO spaces, 3) Credentials are correct"
    });
  }
};

module.exports = { uploadProject, getRecentProjects, deleteProject, sendMessage, testEmailConnection };