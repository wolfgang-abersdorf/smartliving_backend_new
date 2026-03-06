import { FastifyInstance } from 'fastify';

interface AIRequest {
    message: string;
    context?: any;
    conversationHistory?: any[];
}

export default async function (fastify: FastifyInstance) {
    fastify.post('/chat', async (request, reply) => {
        try {
            const data = request.body as AIRequest;
            const { message, context, conversationHistory } = data;

            // Import service dynamically or use a singleton service
            const { processChat } = await import('../../services/ai.service');

            const response = await processChat(fastify.prisma, message, context, conversationHistory);

            return response;
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(500).send({ error: error.message || 'Internal Server Error' });
        }
    });
}
