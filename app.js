const express = require("express");
const cors = require("cors");
const connectDB = require("./Dbconfig/db.connect.js");
const userRoutes = require("./routes/user.routes.js");

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: "https://abubakri-portfolio.vercel.app",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", userRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Backend is actually running");
});

module.exports = app;
