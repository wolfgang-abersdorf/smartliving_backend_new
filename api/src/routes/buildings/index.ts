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
}
