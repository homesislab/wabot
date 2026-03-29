import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Wabot API',
            version: '1.0.0',
            description: 'API Documentation for Wabot WhatsApp Automation',
        },
        servers: [
            {
                url: 'https://wabot.homesislab.my.id',
                description: 'Production server',
            },
            {
                url: process.env.VITE_API_URL || 'http://localhost:3002',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Using absolute path to ensure swagger-jsdoc finds the files in ESM
    apis: [path.join(__dirname, '../routes/*.js')],
};

const specs = swaggerJsdoc(options);

export const swaggerDocs = (app, port) => {
    // Serve swagger spec as JSON
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
    });

    // Redirect /api/docs to /api/docs/ to fix relative paths behind reverse proxies
    app.use('/api/docs', (req, res, next) => {
        if (req.originalUrl === '/api/docs') {
            return res.redirect(301, '/api/docs/');
        }
        next();
    });

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));
    console.log(`Docs available at https://wabot.homesislab.my.id/api/docs (or local port ${port})`);
};


