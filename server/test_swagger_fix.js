import swaggerJsdoc from 'swagger-jsdoc';
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
        ],
    },
    apis: [path.join(__dirname, 'src/routes/*.js')],
};

const specs = swaggerJsdoc(options);
if (specs.paths && Object.keys(specs.paths).length > 0) {
    console.log('SUCCESS: Swagger specs generated successfully with ' + Object.keys(specs.paths).length + ' paths.');
} else {
    console.log('FAILURE: Swagger specs are empty.');
    console.log('Detected APIs path:', options.apis);
}
