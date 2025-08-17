const mongoose = require('mongoose');

async function connect(uri) {
  if (!uri) throw new Error("Missing MONGODB_URI");
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log("✅ MongoDB connected");
}

module.exports = { connect };
