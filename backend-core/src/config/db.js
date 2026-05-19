import mongoose from 'mongoose';
import process from 'node:process';

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection) {
    console.log("Using existing MongoDB connection");
    return cachedConnection;
  }

  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedConnection = conn;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    cachedConnection = null;
  }
};

export default connectDB;
