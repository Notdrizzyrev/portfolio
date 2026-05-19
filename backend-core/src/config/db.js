// import mongoose from 'mongoose';
import process from 'node:process';

let cachedConnection = null;

const connectDB = async () => {
  // MongoDB is disabled for now - backend will work without it
  console.log("⚠️  MongoDB connection disabled - using JSON data only");
  return null;
};

export default connectDB;