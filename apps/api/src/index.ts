import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './db/client';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import authRoutes from './routes/auth';
import accountRoutes from './routes/account';
import briefRoutes from './routes/brief';
import brandProfileRoutes from './routes/brandProfile';
import contentRoutes from './routes/content';
import scheduleRoutes from './routes/schedule';
import socialRoutes from './routes/social';
import billingRoutes from './routes/billing_new'; // PostLoop billing
import usageRoutes from './routes/usage'; // PostLoop usage tracking
import webhookRoutes from './routes/webhooks';
import stripeWebhookRoutes from './routes/webhooks_stripe'; // PostLoop Stripe webhooks

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

// Webhook routes BEFORE body parser (Stripe requires raw body)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRoutes);
app.use('/api/webhooks', webhookRoutes);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/briefs', briefRoutes);
app.use('/api/brand-profile', brandProfileRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/usage', usageRoutes);

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
