import swaggerJsdoc from 'swagger-jsdoc';
import SwaggerParser from '@apidevtools/swagger-parser';
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
    apis: [path.join(__dirname, 'src/routes/*.js')],
};

const specs = swaggerJsdoc(options);

async function validate() {
    try {
        console.log("Validating swagger spec...");
        let api = await SwaggerParser.validate(specs);
        console.log("API name: %s, Version: %s", api.info.title, api.info.version);
        console.log("Validation successful!");
    } catch (err) {
        console.error("Validation failed:");
        console.error(err);
    }
}

validate();
