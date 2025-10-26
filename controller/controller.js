const { User, RecentProject } = require("../model/model.js");
const bcrypt = require("bcryptjs");
const { v2: cloudinary } = require("cloudinary");
const nodemailer = require("nodemailer");
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function maybeUploadToCloudinary(filePath, folder = "user_profiles") {
  if (!filePath) return null;
  try {
    const result = await cloudinary.uploader.upload(filePath, {
        folder,
        width: 300,
        height: 300,
        crop: "fill",
    });
    fs.unlinkSync(filePath)
    return result.secure_url
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    try {
      fs.unlinkSync(filePath);
    } catch {}
    return null;
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Controller for uploading a project
const uploadProject = async (req, res) => {
  try {
    const { projectTitle, projectDescription, projectLink } = req.body;
    const file = req.file;

    if (!projectTitle || !projectDescription || !projectLink || !file) {
      return res.status(400).json({ message: "All fields are required, including image" });
    }

    const imageUrl = await maybeUploadToCloudinary(file.path, "projects");

    if (!imageUrl) {
      return res.status(500).json({ message: "Image upload failed" });
    }

    const newProject = new RecentProject({
      profilePicture: imageUrl,
      projectTitle,
      projectDescription,
      projectLink,
    });

    await newProject.save();

    res.status(201).json({ message: "Project uploaded successfully", project: newProject });
  } catch (error) {
    console.error("Upload project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller for sending message
const sendMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER, // Your email
      subject: `Portfolio Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

module.exports = { uploadProject, sendMessage };