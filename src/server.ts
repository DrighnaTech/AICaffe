import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';

/**
 * Configure and return the Express application
 */
export const createServer = (): Express => {
    const app = express();

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(pino());

    // Health check
    app.get('/health', (req: Request, res: Response) => {
        res.json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            service: 'aicaffe-monolith'
        });
    });

    // Basic route placeholder
    app.get('/', (req: Request, res: Response) => {
        res.json({
            message: 'AiCaffe API Gateway - Modular Monolith',
            version: '1.0.0'
        });
    });

    // 404 handler
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            error: 'Not Found',
            code: 'AC_404'
        });
    });

    // Error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error(err.stack);
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'AC_500'
        });
    });

    return app;
};
