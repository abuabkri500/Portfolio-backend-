const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, require: true },
    email: { type: String, require: true, unique: true },
    password: { type: String, require: true },
  },
  { timestamps: true }
);
const recentProjectSchema = new mongoose.Schema(
  {
    profilePicture: { type: String, require: true },
    projectTitle: { type: String, require: true },
    projectDescription: { type: String, require: true },
    projectLink: { type: String, require: true },
  },
  { timestamps: true }
);

const User = mongoose.model("user", userSchema);
const RecentProject = mongoose.model("recentPriject", recentProjectSchema);

module.exports = { User, RecentProject };
