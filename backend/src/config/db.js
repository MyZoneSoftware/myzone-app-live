import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Faster, clearer failures when URI/auth is wrong
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "myzone",
      serverSelectionTimeoutMS: 8000
    });

    console.log("MongoDB connected");
    return true;
  } catch (err) {
    console.error("Mongo Error:", err.message);
    console.error("⚠️ Continuing without MongoDB connection (dev mode).");
    return false;
  }
};

export default connectDB;
