import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

export const maxDuration = 300;

const handler = async (req, res) => {
  await connectDB();
  return app(req, res);
};

if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`RoamPilot server running on port ${PORT}`);
      });
    })
    .catch(error => {
      console.error('MongoDB connection error:', error.message);
      process.exitCode = 1;
    });
}

export default handler;
