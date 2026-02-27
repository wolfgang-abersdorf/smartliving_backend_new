import { FastifyInstance } from 'fastify';
import { transformBuildingToWpFormat } from '../../services/buildings.service';

export default async function (fastify: FastifyInstance) {
    fastify.get('/:id', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'integer' }
                },
                required: ['id']
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const cacheKey = `building:${id}`;

        const cached = await fastify.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const building = await fastify.prisma.building.findUnique({
            where: { id },
            include: {
                blocks: {
                    include: { units: true },
                },
            },
        });

        if (!building) {
            return reply.code(404).send({ error: 'Building not found' });
        }

        const result = transformBuildingToWpFormat(building as any);
        await fastify.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

        return result;
    });
}
