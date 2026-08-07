import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection pool — reuse connections instead of opening fresh ones every request
      maxPoolSize: 10,
      minPoolSize: 2,

      // Timeouts — fail fast instead of hanging forever
      serverSelectionTimeoutMS: 5000,   // Give up selecting a server after 5s
      socketTimeoutMS: 45000,           // Drop idle sockets after 45s
      connectTimeoutMS: 10000,          // Initial connection timeout

      // Keep connections alive under idle periods (important on Render/Railway)
      heartbeatFrequencyMS: 10000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Log disconnections so you know when DB drops
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected — will auto-reconnect');
    });
    mongoose.connection.on('reconnected', () => {
      console.info('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
