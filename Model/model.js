const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const recentProjectSchema = new mongoose.Schema(
  {
    profilePicture: { type: String, required: true },
    projectTitle: { type: String, required: true },
    projectDescription: { type: String, required: true },
    projectLink: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model('user', userSchema);
const RecentProject = mongoose.model('recentProject', recentProjectSchema);

module.exports = { User, RecentProject };
