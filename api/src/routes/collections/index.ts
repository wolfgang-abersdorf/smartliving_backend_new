import { FastifyInstance } from 'fastify';
import { transformBuildingToWpFormat } from '../../services/buildings.service';

export default async function (fastify: FastifyInstance) {
    // Get collections - admins get all, regular users get only theirs
    fastify.get('/', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;
        const isAdmin = ['admin', 'ADMIN', 'SUPERADMIN'].includes(request.user.role || '');

        const where = isAdmin ? {} : { authorId: userId };

        const collections = await fastify.prisma.collection.findMany({
            where,
            include: {
                author: { select: { name: true, email: true } },
                collectionBuildings: {
                    include: {
                        building: {
                            include: {
                                blocks: {
                                    include: { units: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return collections.map(c => ({
            id: c.id,
            title: { rendered: c.title },
            authorName: (c as any).author?.name || (c as any).author?.email || 'Unknown',
            createdAt: c.createdAt,
            acf: {
                objects: c.objects,
                buildings_ids: c.collectionBuildings.map(cb => transformBuildingToWpFormat(cb.building as any))
            }
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
        const { title, objects, buildings_ids } = request.body as any;

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
                    create: (buildings_ids || []).map((id: number) => ({ buildingId: id }))
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
        const { id } = request.params as any;
        const collection = await fastify.prisma.collection.findUnique({
            where: { id: parseInt(id) },
            include: {
                collectionBuildings: {
                    include: { building: true }
                }
            }
        });

        if (!collection) return reply.code(404).send({ error: 'Collection not found' });

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
        const { id } = request.params as any;
        const { title, objects, buildings_ids } = request.body as any;

        // Check ownership or admin
        const collection = await fastify.prisma.collection.findUnique({ where: { id: parseInt(id) } });
        if (!collection) return reply.code(404).send({ error: 'Collection not found' });

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
                    create: (buildings_ids || []).map((id: number) => ({ buildingId: id }))
                }
            }
        });

        return updated;
    });

    // Delete collection
    fastify.delete('/:id', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as any;
        const collection = await fastify.prisma.collection.findUnique({ where: { id: parseInt(id) } });
        if (!collection) return reply.code(404).send({ error: 'Collection not found' });

        const isAdmin = ['admin', 'ADMIN', 'SUPERADMIN'].includes(request.user.role || '');
        if (collection.authorId !== request.user.id && !isAdmin) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        await fastify.prisma.collection.delete({ where: { id: parseInt(id) } });
        return { success: true };
    });
}
