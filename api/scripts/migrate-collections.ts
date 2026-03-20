// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import { unserialize } from 'php-serialize';

const prisma = new PrismaClient();

function parseSerialized(val?: string) {
    if (!val) return [];
    try {
        const parsed = unserialize(val);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'object' && parsed !== null) {
            return Object.values(parsed);
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function run() {
    const wp = await mysql.createConnection(process.env.WP_DB_URL || 'mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
    console.log('Connected to WP MySQL');

    await prisma.collectionBuilding.deleteMany({});
    await prisma.collection.deleteMany({});
    console.log('Cleared existing collections');

    const [collectionsRows] = await wp.query(`SELECT ID, post_title, post_author, post_date FROM wp_posts WHERE post_type='collections'`);

    for (const c of (collectionsRows as any)) {
        console.log(`Processing collection: ${c.post_title} (ID: ${c.ID})`);

        const [metaRows] = await wp.query(`SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=?`, [c.ID]);
        const meta: Record<string, string> = {};
        for (const row of (metaRows as any)) {
            meta[row.meta_key] = row.meta_value;
        }

        // ACF fields: objects (text), buildings_ids (serialized ID array)
        const objects = meta['objects'] || '';
        const buildingIdsRaw = meta['buildings_ids'];
        const buildingIds = parseSerialized(buildingIdsRaw).map(id => Number(id)).filter(id => !isNaN(id));

        try {
            const collection = await prisma.collection.create({
                data: {
                    id: c.ID,
                    title: c.post_title,
                    objects: objects,
                    authorId: parseInt(c.post_author),
                    createdAt: new Date(c.post_date),
                    updatedAt: new Date(c.post_date),
                }
            });

            if (buildingIds.length > 0) {
                // Verify buildings exist in our new DB (IDs should match from migrate.ts)
                const existingBuildings = await prisma.building.findMany({
                    where: { id: { in: buildingIds } },
                    select: { id: true }
                });
                const existingIds = existingBuildings.map(b => b.id);

                for (const bId of buildingIds) {
                    if (existingIds.includes(bId)) {
                        await prisma.collectionBuilding.create({
                            data: {
                                collectionId: collection.id,
                                buildingId: bId
                            }
                        }).catch(e => console.error(`Failed to link building ${bId} to collection ${collection.id}:`, e.message));
                    } else {
                        console.warn(`Building ${bId} not found in PostgreSQL, skipping link for collection ${collection.id}`);
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to create collection ${c.ID}:`, e.message);
        }
    }

    console.log('Migration finished');
    await wp.end();
    await prisma.$disconnect();
}

run().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
