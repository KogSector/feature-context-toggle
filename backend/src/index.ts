/**
 * Feature Context Toggle - Backend Entry Point
 * 
 * Express server for managing feature toggles
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import toggleRoutes from './routes/toggles.js';

const app = express();
const PORT = process.env.PORT || 3099;

// Security middleware
app.use(helmet());

// CORS - allow frontend access
app.use(cors({
    origin: [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:3000',  // Alternative local dev
        'http://127.0.0.1:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Body parsing
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'feature-context-toggle',
        timestamp: new Date().toISOString(),
    });
});

// Toggle routes
app.use('/api/toggles', toggleRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString(),
    });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     🎛️  Feature Context Toggle - Backend Service         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  🚀 Server running on http://localhost:${PORT}            ║`);
    console.log('║  📊 Toggles API: /api/toggles                            ║');
    console.log('║  💚 Health check: /health                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});

export default app;
