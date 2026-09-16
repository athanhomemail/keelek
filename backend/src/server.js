import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { testDbConnection } from './config/db.js';
import { initSocket } from './services/socketService.js';
import { initLotteryScraperScheduler } from './services/lotteryScraper.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Kee-Lek API',
    domain: 'kuayrai.com',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', apiRoutes);

// Initialize Socket.io service
initSocket(io);

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  const dbOk = await testDbConnection();
  if (!dbOk) {
    console.warn('⚠️ Warning: Database connection failed. Please ensure MySQL container is running.');
  }

  // Initialize Scraper Schedulers
  initLotteryScraperScheduler();

  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`⌨️ Kee-Lek (คีย์เลข) Backend Server Running!`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔌 Socket.io: Enabled`);
    console.log(`📁 Database: ${process.env.DB_NAME || 'keelek'}`);
    console.log(`🤖 LINE Mock Mode: ${process.env.MOCK_LINE_MODE !== 'false' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`==================================================\n`);
  });
}

startServer();
