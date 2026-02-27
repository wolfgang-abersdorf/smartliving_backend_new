import { FastifyInstance } from 'fastify';

/**
 * Parses and maps ACF array format directly from the WordPress REST API into Prisma compatible fields.
 */
function mapAcfToPrisma(acf: any): any {
    if (!acf) return {};

    return {
        address: acf.address || '',
        area: acf.area || '',
        mainImageUrl: typeof acf.main_image === 'string' ? acf.main_image : (acf.main_image?.url || ''),
        description: acf.description || '',
        hasView: !!acf.having_a_view,
        hasPool: !!acf.availability_of_a_swimming_pool,
        hasCarAccess: !!acf.car_access,
        hasParking: !!acf.private_parking,
        developer: acf.developer || '',
        commission: acf.commission || '',
        telegram: acf.telegram || '',
        whatsapp: acf.whatsapp || '',
        pdfUrl: typeof acf.pdf_file === 'string' ? acf.pdf_file : (acf.pdf_file?.url || ''),
        buildingClass: acf.characteristics?.class_of_building || '',
        buildingMaterial: acf.characteristics?.building_material || '',
        roadType: acf.characteristics?.the_road_to_the_house || '',
        territory: acf.characteristics?.territory || '',
        advantages: Array.isArray(acf.advantages) ? acf.advantages : [],
        contacts: Array.isArray(acf.contacts) ? acf.contacts : [],
        documents: Array.isArray(acf.documents) ? acf.documents : [],
        albums: Array.isArray(acf.album) ? acf.album : [],
        mapData: acf.map || null,
    };
}

export default async function (fastify: FastifyInstance) {
    fastify.post('/wordpress-sync', {
        schema: {
            body: {
                type: 'object',
                required: ['event', 'post_id'],
                properties: {
                    event: { type: 'string' },
                    post_id: { type: 'number' },
                    timestamp: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        // Basic shared secret check
        const authHeader = request.headers.authorization;
        const secret = process.env.WEBHOOK_SECRET || 'my_super_secret_webhook_key';

        if (!authHeader || authHeader !== `Bearer ${secret}`) {
            fastify.log.warn('Unauthorized webhook attempt');
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { post_id } = request.body as { post_id: number; event: string };

        try {
            // Fetch the updated post from WordPress REST API (bypassing Fastify's own DB temporarily)
            // We assume WordPress is accessible internally via the 'wordpress' or 'nginx' host.
            // Using a custom exporter to bypass ACF REST API formatting errors
            const wpApiUrl = process.env.WP_API_URL || 'http://wordpress:80';
            const response = await fetch(`${wpApiUrl}/wp-content/themes/wp-theme/inc/fastify-exporter.php?id=${post_id}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch building from WP: ${response.status} ${response.statusText}`);
            }

            const wpBuilding = await response.json();

            // Update or create entirely in PostgreSQL
            const mappedData = mapAcfToPrisma(wpBuilding.acf);

            await fastify.prisma.building.upsert({
                where: { id: post_id },
                update: {
                    title: wpBuilding.title?.rendered || 'Untitled',
                    slug: wpBuilding.slug || 'untitled',
                    ...mappedData
                },
                create: {
                    id: post_id,
                    title: wpBuilding.title?.rendered || 'Untitled',
                    slug: wpBuilding.slug || 'untitled',
                    ...mappedData
                }
            });

            // We also need to sync blocks and units.
            if (wpBuilding.acf?.block && Array.isArray(wpBuilding.acf.block)) {
                for (const blockData of wpBuilding.acf.block) {
                    if (!blockData.block_id) continue;

                    const upsertedBlock = await fastify.prisma.block.upsert({
                        where: { blockUid: blockData.block_id },
                        update: {
                            title: blockData.title || '',
                            category: blockData.category || '',
                            completionYear: parseInt(blockData.completion_year, 10) || null,
                            completionQuarter: blockData.completion_quarter || '',
                            constructionStage: blockData.construction_stage || '',
                            typeOfOwnership: blockData.type_of_ownership || '',
                            leaseholdYears: blockData.total_years_of_leasehold ? String(blockData.total_years_of_leasehold) : null,
                            buildingId: post_id
                        },
                        create: {
                            blockUid: blockData.block_id,
                            title: blockData.title || '',
                            category: blockData.category || '',
                            completionYear: parseInt(blockData.completion_year, 10) || null,
                            completionQuarter: blockData.completion_quarter || '',
                            constructionStage: blockData.construction_stage || '',
                            typeOfOwnership: blockData.type_of_ownership || '',
                            leaseholdYears: blockData.total_years_of_leasehold ? String(blockData.total_years_of_leasehold) : null,
                            buildingId: post_id
                        }
                    });

                    // And then units syncing
                    if (blockData.units?.unit && Array.isArray(blockData.units.unit)) {
                        // Because units often lack a stable unique ID in the ACF repeater, the safest approach for a full sync 
                        // is to delete all existing units for this block and re-insert them, OR if they have IDs, to upsert.
                        // For simplicity in this webhook, we delete and recreate.
                        await fastify.prisma.unit.deleteMany({
                            where: { blockId: upsertedBlock.id }
                        });

                        const unitsToCreate = blockData.units.unit.map((unit: any) => ({
                            blockId: upsertedBlock.id,
                            numberTitle: unit.numbertitle || '',
                            areaM2: parseFloat(unit.area_m2) || 0,
                            price: parseFloat(unit.price) || 0,
                            currency: unit.currency || 'USD',
                            status: unit.status || 'Sale',
                            rooms: parseInt(unit.number_of_rooms, 10) || null,
                            floor: parseInt(unit.floor, 10) || null,
                            views: Array.isArray(unit.view) ? unit.view : [],
                            landArea: parseFloat(unit.land_area) || null,
                            apartmentTypes: Array.isArray(unit.type_of_apartment) ? unit.type_of_apartment : [],
                            floorsTotal: parseInt(unit.amount_of_floors, 10) || null,
                            photos: typeof unit.photo === 'string' ? [unit.photo] : []
                        }));

                        if (unitsToCreate.length > 0) {
                            await fastify.prisma.unit.createMany({
                                data: unitsToCreate
                            });
                        }
                    }
                }
            }

            // Clear cache
            const keys = await fastify.redis.keys('buildings:*');
            if (keys.length > 0) {
                await fastify.redis.del(keys);
            }

            fastify.log.info(`Successfully synced building ${post_id} from WordPress webhook`);
            return reply.send({ success: true, message: `Building ${post_id} synced` });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Sync failed', details: (error as Error).message });
        }
    });
}
