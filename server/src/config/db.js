import mongoose from 'mongoose';

let connectionPromise = null;

export const getMongoDatabaseName = () => {
  const name = String(process.env.MONGO_DB_NAME || 'roampilot').trim();
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(name)) {
    throw new Error('MONGO_DB_NAME must contain only letters, numbers, underscores, or hyphens.');
  }
  return name;
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (connectionPromise) return connectionPromise;

  const dbName = getMongoDatabaseName();
  connectionPromise = mongoose.connect(process.env.MONGO_URI, { dbName })
    .then(connection => {
      console.log(`MongoDB connected to isolated database: ${dbName}`);
      return connection;
    })
    .catch(error => {
      connectionPromise = null;
      throw error;
    });
  return connectionPromise;
};

export default connectDB;
