import { FastifyInstance } from 'fastify';
import { transformBuildingToWpFormat } from '../../services/buildings.service';

function getOrderBy(sort?: string) {
    switch (sort) {
        case 'price_asc': return { createdAt: 'asc' as const };
        case 'price_desc': return { createdAt: 'desc' as const };
        case 'newest': return { createdAt: 'desc' as const };
        default: return { createdAt: 'desc' as const };
    }
}

export default async function (fastify: FastifyInstance) {
    fastify.get('/', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1, minimum: 1 },
                    per_page: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
                    category: { type: 'string' },
                    area: { type: 'array', items: { type: 'string' } },
                    price_min: { type: 'number' },
                    price_max: { type: 'number' },
                    area_m2_min: { type: 'number' },
                    area_m2_max: { type: 'number' },
                    rooms: { type: 'array', items: { type: 'integer' } },
                    ownership: { type: 'string' },
                    has_pool: { type: 'boolean' },
                    has_view: { type: 'boolean' },
                    sort: { type: 'string', default: 'newest' },
                    search: { type: 'string' },
                },
            },
        },
    }, async (request) => {
        const query = request.query as any;
        const cacheKey = `buildings:${JSON.stringify(query)}`;

        // Redis cache
        const cached = await fastify.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Prisma query
        const where: any = {};
        const blockWhere: any = {};
        const unitWhere: any = { status: { not: 'Sold' } };

        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
                { address: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        if (query.area?.length) where.area = { in: query.area };
        if (query.has_pool) where.hasPool = true;
        if (query.has_view) where.hasView = true;
        if (query.category) blockWhere.category = { equals: query.category, mode: 'insensitive' };
        if (query.ownership) blockWhere.typeOfOwnership = query.ownership;

        if (query.price_min) unitWhere.price = { ...unitWhere.price, gte: query.price_min };
        if (query.price_max) unitWhere.price = { ...unitWhere.price, lte: query.price_max };
        if (query.area_m2_min) unitWhere.areaM2 = { ...unitWhere.areaM2, gte: query.area_m2_min };
        if (query.area_m2_max) unitWhere.areaM2 = { ...unitWhere.areaM2, lte: query.area_m2_max };
        if (query.rooms?.length) unitWhere.rooms = { in: query.rooms };

        const skip = (query.page - 1) * query.per_page;

        // Add block filtering to buildings if category or ownership is specified
        if (Object.keys(blockWhere).length > 0) {
            where.blocks = { some: blockWhere };
        }

        const [items, total] = await Promise.all([
            fastify.prisma.building.findMany({
                where,
                include: {
                    blocks: {
                        where: Object.keys(blockWhere).length > 0 ? blockWhere : undefined,
                        include: { units: { where: unitWhere } },
                    },
                },
                skip,
                take: query.per_page,
                orderBy: getOrderBy(query.sort),
            }),
            fastify.prisma.building.count({ where }),
        ]);

        const result = {
            items: items.map(transformBuildingToWpFormat as any),
            total,
            page: query.page,
            pages: Math.ceil(total / query.per_page),
        };

        await fastify.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
        return result;
    });

    // GET /api/buildings/:id
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const buildingId = parseInt(id);
        const cacheKey = `building:${buildingId}`;

        const cached = await fastify.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const building = await fastify.prisma.building.findUnique({
            where: { id: buildingId },
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

    // POST /api/buildings
    fastify.post('/', async (request, reply) => {
        const data = request.body as any;
        const slug = data.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        // Generate a numeric ID (since schema uses @id on Int without autoincrement in some places?)
        // Wait, schema says: model Building { id Int @id } - NO autoincrement!
        // I should probably find the max ID and increment it, or update schema to autoincrement.
        // Let's check schema again.
        const maxId = await fastify.prisma.building.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true }
        });
        const nextId = (maxId?.id || 10000) + 1;

        const building = await fastify.prisma.building.create({
            data: {
                id: nextId,
                title: data.title,
                slug: slug,
                description: data.description,
                area: data.area,
                address: data.address,
                buildingClass: data.buildingClass,
                developer: data.developer,
                whatsapp: data.whatsapp,
                mainImageUrl: data.mainImageUrl,
                stampImageUrl: data.stampImageUrl,
                stampPosition: data.stampPosition,
                lat: data.lat,
                lng: data.lng,
                blocks: {
                    create: (data.blocks || []).map((b: any, index: number) => ({
                        blockUid: `b-${nextId}-${index}-${Date.now()}`,
                        title: b.title,
                        category: b.category,
                        completionYear: b.completionYear,
                        units: {
                            create: (b.units || []).map((u: any) => ({
                                numberTitle: u.numberTitle,
                                areaM2: u.areaM2,
                                price: u.price,
                                status: u.status,
                                rooms: u.rooms
                            }))
                        }
                    }))
                }
            }
        });

        // Clear cache
        await fastify.redis.del('buildings:*');
        return building;
    });

    // PUT /api/buildings/:id
    fastify.put('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const buildingId = parseInt(id);
        const data = request.body as any;

        // Start transaction for update
        const result = await fastify.prisma.$transaction(async (tx) => {
            // 1. Delete existing blocks and units (cascade)
            await tx.block.deleteMany({ where: { buildingId } });

            // 2. Update building and re-create blocks
            return await tx.building.update({
                where: { id: buildingId },
                data: {
                    title: data.title,
                    description: data.description,
                    area: data.area,
                    address: data.address,
                    buildingClass: data.buildingClass,
                    developer: data.developer,
                    whatsapp: data.whatsapp,
                    mainImageUrl: data.mainImageUrl,
                    stampImageUrl: data.stampImageUrl,
                    stampPosition: data.stampPosition,
                    lat: data.lat,
                    lng: data.lng,
                    blocks: {
                        create: (data.blocks || []).map((b: any, index: number) => ({
                            blockUid: `b-${buildingId}-${index}-${Date.now()}`,
                            title: b.title,
                            category: b.category,
                            completionYear: b.completionYear,
                            units: {
                                create: (b.units || []).map((u: any) => ({
                                    numberTitle: u.numberTitle,
                                    areaM2: u.areaM2,
                                    price: u.price,
                                    status: u.status,
                                    rooms: u.rooms
                                }))
                            }
                        }))
                    }
                }
            });
        });

        // Clear cache
        await fastify.redis.del(`building:${buildingId}`);
        await fastify.redis.del('buildings:*');

        return result;
    });

    // DELETE /api/buildings/:id
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const buildingId = parseInt(id);

        await fastify.prisma.building.delete({
            where: { id: buildingId }
        });

        // Clear cache
        await fastify.redis.del(`building:${buildingId}`);
        await fastify.redis.del('buildings:*');

        return { success: true };
    });
}
