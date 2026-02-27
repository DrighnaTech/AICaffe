import dotenv from 'dotenv';
import { createServer } from './server';

// Load environment variables
dotenv.config();

const port = process.env.PORT || 8000;

/**
 * Start the server
 */
const startServer = async () => {
    try {
        const app = createServer();

        app.listen(port, () => {
            console.log(`[server]: AiCaffe Monolith is running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
