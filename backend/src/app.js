const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const roomRoutes = require('./routes/roomRoutes');
const healthRecordRoutes = require('./routes/healthRecordRoutes');
const aiRoutes = require('./routes/aiRoutes');
const documentRoutes = require('./routes/documentRoutes');
const { initCronJobs } = require('./services/cronService');
const initDatabase = require('./config/initDatabase');
const seedData = require('./config/seedData');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Pet Care API is running healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint không tồn tại'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await initDatabase();
  await seedData();
  initCronJobs();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║   🏥 Pet Care Hospital Management System            ║
║   🚀 Server chạy tại http://localhost:${PORT}          ║
║   📊 Environment: ${process.env.NODE_ENV || 'development'}                    ║
╚══════════════════════════════════════════════════════╝
    `);
  });
};

startServer().catch((error) => {
  console.error('❌ Không thể khởi động backend:', error.message);
  process.exit(1);
});