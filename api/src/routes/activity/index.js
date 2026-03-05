"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(fastify) {
    // Mock endpoint to accept tracking events
    fastify.post('/track-event', async (request, reply) => {
        return reply.code(200).send({ success: true });
    });
    // Mock endpoint for stats (used by getActivityLogs)
    fastify.get('/stats', async (request, reply) => {
        return reply.code(200).send({ data: [] });
    });
    // Mock endpoint for aggregated stats
    fastify.get('/aggregated', async (request, reply) => {
        return reply.code(200).send({ data: {} });
    });
}
