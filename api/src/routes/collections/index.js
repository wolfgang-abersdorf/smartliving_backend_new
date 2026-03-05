"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(fastify) {
    // Get collections - lightweight list for admins and regular users
    fastify.get('/', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;
        const isAdmin = ['admin', 'ADMIN', 'SUPERADMIN'].includes(request.user.role || '');
        const where = isAdmin ? {} : { authorId: userId };
        const collections = await fastify.prisma.collection.findMany({
            where,
            select: {
                id: true,
                title: true,
                createdAt: true,
                author: { select: { name: true, email: true } },
                _count: {
                    select: { collectionBuildings: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return collections.map(c => ({
            id: c.id,
            title: { rendered: c.title },
            authorName: c.author?.name || c.author?.email || 'Unknown',
            createdAt: c.createdAt,
            buildingsCount: c._count.collectionBuildings
        }));
    });
    // Create new collection
    fastify.post('/', {
        preValidation: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['title'],
                properties: {
                    title: { type: 'string' },
                    objects: { type: 'string' }, // Stringified array or similar if needed, keeping WP structure
                    buildings_ids: { type: 'array', items: { type: 'integer' } }
                }
            }
        }
    }, async (request, reply) => {
        const { title, objects, buildings_ids } = request.body;
        // Validate buildings exist
        if (buildings_ids && buildings_ids.length > 0) {
            const existingBuildings = await fastify.prisma.building.count({
                where: { id: { in: buildings_ids } }
            });
            if (existingBuildings !== buildings_ids.length) {
                return reply.code(400).send({ error: 'One or more buildings do not exist' });
            }
        }
        const collection = await fastify.prisma.collection.create({
            data: {
                title,
                objects,
                authorId: request.user.id,
                collectionBuildings: {
                    create: (buildings_ids || []).map((id) => ({ buildingId: id }))
                }
            },
            include: {
                collectionBuildings: true
            }
        });
        return {
            id: collection.id,
            title: { rendered: collection.title },
            acf: {
                objects: collection.objects,
                buildings_ids: collection.collectionBuildings.map(cb => cb.buildingId)
            }
        };
    });
    // Get single collection
    fastify.get('/:id', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params;
        const collection = await fastify.prisma.collection.findUnique({
            where: { id: parseInt(id) },
            include: {
                collectionBuildings: {
                    include: { building: true }
                }
            }
        });
        if (!collection)
            return reply.code(404).send({ error: 'Collection not found' });
        return {
            id: collection.id,
            title: { rendered: collection.title },
            objects: collection.objects,
            acf: {
                objects: collection.objects,
                buildings_ids: collection.collectionBuildings.map(cb => cb.buildingId)
            }
        };
    });
    // Update collection
    fastify.put('/:id', {
        preValidation: [fastify.authenticate],
        schema: {
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
        const { id } = request.params;
        const { title, objects, buildings_ids } = request.body;
        // Check ownership or admin
        const collection = await fastify.prisma.collection.findUnique({ where: { id: parseInt(id) } });
        if (!collection)
            return reply.code(404).send({ error: 'Collection not found' });
        const isAdmin = ['admin', 'ADMIN', 'SUPERADMIN'].includes(request.user.role || '');
        if (collection.authorId !== request.user.id && !isAdmin) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        // Update basic info and building links
        const updated = await fastify.prisma.collection.update({
            where: { id: parseInt(id) },
            data: {
                title,
                objects,
                collectionBuildings: {
                    deleteMany: {},
                    create: (buildings_ids || []).map((id) => ({ buildingId: id }))
                }
            }
        });
        return updated;
    });
    // Delete collection
    fastify.delete('/:id', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params;
        const collection = await fastify.prisma.collection.findUnique({ where: { id: parseInt(id) } });
        if (!collection)
            return reply.code(404).send({ error: 'Collection not found' });
        const isAdmin = ['admin', 'ADMIN', 'SUPERADMIN'].includes(request.user.role || '');
        if (collection.authorId !== request.user.id && !isAdmin) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        await fastify.prisma.collection.delete({ where: { id: parseInt(id) } });
        return { success: true };
    });
}
