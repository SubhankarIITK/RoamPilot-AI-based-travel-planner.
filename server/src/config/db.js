import mongoose from 'mongoose';

export const getMongoDatabaseName = () => {
  const name = String(process.env.MONGO_DB_NAME || 'roampilot').trim();
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(name)) {
    throw new Error('MONGO_DB_NAME must contain only letters, numbers, underscores, or hyphens.');
  }
  return name;
};

const connectDB = async () => {
  try {
    const dbName = getMongoDatabaseName();
    await mongoose.connect(process.env.MONGO_URI, { dbName });
    console.log(`MongoDB connected to isolated database: ${dbName}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;
