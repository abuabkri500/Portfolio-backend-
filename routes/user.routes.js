const express = require("express");
const router = express.Router();
const { uploadProject, sendMessage } = require("../controller/controller.js");
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
router.post("/upload-project", upload.single("image"), uploadProject);
router.post("/send-message", sendMessage);

module.exports = router;
