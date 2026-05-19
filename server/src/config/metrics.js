import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'wabot-backend'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom Metrics
export const messagesReceivedTotal = new client.Counter({
    name: 'wabot_messages_received_total',
    help: 'Total number of messages received by the system',
    registers: [register],
});

export const rulesTriggeredTotal = new client.Counter({
    name: 'wabot_rules_triggered_total',
    help: 'Total number of times a rule was matched and executed',
    labelNames: ['action_type'],
    registers: [register],
});

export const aiGenerationsTotal = new client.Counter({
    name: 'wabot_ai_generations_total',
    help: 'Total number of AI generation requests (text or image)',
    labelNames: ['provider', 'type'],
    registers: [register],
});

export const apiCallsTotal = new client.Counter({
    name: 'wabot_api_calls_total',
    help: 'Total number of external API calls made by rules',
    labelNames: ['method'],
    registers: [register],
});

export const deduplicatedMessagesTotal = new client.Counter({
    name: 'wabot_deduplicated_messages_total',
    help: 'Total number of duplicate messages ignored by the dedup logic',
    registers: [register],
});

export { register, client };
