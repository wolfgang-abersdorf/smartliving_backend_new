import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
    // Update collection
    fastify.put('/:id', {
        preValidation: [fastify.authenticate],
        schema: {
            params: { type: 'object', properties: { id: { type: 'integer' } } },
            body: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    objects: { type: 'string' },
                    buildings_ids: { type: 'array', items: { type: 'integer' } }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const { title, objects, buildings_ids } = request.body as any;

        const collection = await fastify.prisma.collection.findUnique({ where: { id } });

        if (!collection) {
            return reply.code(404).send({ error: 'Collection not found' });
        }

        if (collection.authorId !== request.user.id && request.user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        // If updating buildings, we delete old relations and create new ones
        if (buildings_ids !== undefined) {
            // Validate
            if (buildings_ids.length > 0) {
                const existingBuildings = await fastify.prisma.building.count({ where: { id: { in: buildings_ids } } });
                if (existingBuildings !== buildings_ids.length) {
                    return reply.code(400).send({ error: 'One or more buildings do not exist' });
                }
            }

            await fastify.prisma.collectionBuilding.deleteMany({ where: { collectionId: id } });

            if (buildings_ids.length > 0) {
                await fastify.prisma.collectionBuilding.createMany({
                    data: buildings_ids.map((bid: number) => ({ collectionId: id, buildingId: bid }))
                });
            }
        }

        const updated = await fastify.prisma.collection.update({
            where: { id },
            data: {
                title: title !== undefined ? title : undefined,
                objects: objects !== undefined ? objects : undefined,
            },
            include: { collectionBuildings: true }
        });

        return {
            success: true,
            id: updated.id,
            title: { rendered: updated.title },
            acf: {
                objects: updated.objects,
                buildings_ids: updated.collectionBuildings.map(cb => cb.buildingId)
            }
        };
    });

    // Delete collection
    fastify.delete('/:id', {
        preValidation: [fastify.authenticate],
        schema: {
            params: { type: 'object', properties: { id: { type: 'integer' } } }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: number };

        const collection = await fastify.prisma.collection.findUnique({ where: { id } });

        if (!collection) return reply.code(404).send({ error: 'Collection not found' });
        if (collection.authorId !== request.user.id && request.user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        await fastify.prisma.collection.delete({ where: { id } });

        return { success: true };
    });
}
