const express = require("express");
const router = express.Router();
const { uploadProject, getRecentProjects, deleteProject, sendMessage, testEmailConnection } = require("../controller/controller.js");
const multer = require("multer");

// Configure multer for file uploads using memory storage (for serverless environments)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.get("/get-recent-projects", getRecentProjects);
router.post("/upload-project", upload.single("image"), uploadProject);
router.delete("/delete-project/:id", deleteProject);
router.post("/send-message", sendMessage);
router.get("/test-email", testEmailConnection); // Test endpoint to verify email configuration

module.exports = router;