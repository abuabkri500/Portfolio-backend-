const { User, RecentProject } = require("../Model/model.js");
const bcrypt = require("bcryptjs");
const { v2: cloudinary } = require("cloudinary");
const nodemailer = require("nodemailer");
const fs = require("fs");

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

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Increased timeout settings for better reliability
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000, // 30 seconds
  socketTimeout: 60000, // 60 seconds
  // Disable connection pooling for serverless
  pool: false,
  // Add debug logging
  debug: true,
  logger: true,
  // Additional options for serverless
  tls: {
    rejectUnauthorized: false
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
        console.error("Cloudinary delete error:", cloudinaryError);
        // Continue to delete the cloudinary even if its fails
      }
    }

    await RecentProject.findByIdAndDelete(id);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller for sending message
const sendMessage = async (req, res) => {
  try {
    console.log("Send message request received");
    console.log("Body:", req.body);

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      console.log("Missing fields:", { name, namePresent: !!name, emailPresent: !!email, messagePresent: !!message });
      return res.status(400).json({ message: "All fields are required" });
    }

    console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");

    const mailOptions = {
      from: process.env.EMAIL_USER, // Must use your Gmail account as sender
      replyTo: email, // Set visitor's email as reply-to so you can reply directly
      to: process.env.EMAIL_USER, // Your email to receive messages
      subject: `Portfolio Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong> ${message.replace(/\n/g, '<br>')}</p>`,
    };

    console.log("Sending email...");
    console.log("Mail options:", {
      from: mailOptions.from,
      replyTo: mailOptions.replyTo,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      throw emailError; // Re-throw to be caught by outer catch
    }

    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

module.exports = { uploadProject, getRecentProjects, deleteProject, sendMessage };
