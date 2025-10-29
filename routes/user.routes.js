const express = require("express");
const router = express.Router();
const { uploadProject, getRecentProjects, deleteProject, sendMessage } = require("../controller/controller.js");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Routes
router.get("/get-recent-projects", getRecentProjects);
router.post("/upload-project", upload.single("image"), uploadProject);
router.delete("/delete-project/:id", deleteProject);
router.post("/send-message", sendMessage);

module.exports = router;
