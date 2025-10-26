
const mongoose = require('mongoose');
require("dotenv").config();

const connect = async () => {
 try {
    const connection = await mongoose.connect(process.env.MONGO_URI)
    if (connection) {
        console.log("Database connected successfully");
    }
 } catch (error) {
    console.log("MongoDB connection failed:",error);

 }
}

module.exports = connect;