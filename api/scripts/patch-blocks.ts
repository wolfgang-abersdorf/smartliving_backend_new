// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

const prisma = new PrismaClient();

async function run() {
    console.log('Starting block data patch...');
    const wp = await mysql.createConnection('mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
    console.log('Connected to WP MySQL');

    const buildings = await prisma.building.findMany({
        include: { blocks: true }
    });

    console.log(`Found ${buildings.length} buildings in PostgreSQL`);

    for (const building of buildings) {
        console.log(`Patching building: ${building.title} (ID: ${building.id})`);
        const [metaRows] = await wp.query(`SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=?`, [building.id]);
        const meta: Record<string, string> = {};
        for (const row of (metaRows as any)) {
            meta[row.meta_key] = row.meta_value;
        }

        const blockCount = parseInt(meta['block']) || 0;
        for (let i = 0; i < blockCount; i++) {
            const blockUid = `bld-${building.id}-block-${i}`;

            const completionYear = meta[`block_${i}_completion_year`] ? parseInt(meta[`block_${i}_completion_year`]) : null;
            const completionQuarter = meta[`block_${i}_completion_quarter`] || null;
            const constructionStage = meta[`block_${i}_construction_stage`] || null;

            if (completionYear || completionQuarter || constructionStage) {
                const updated = await prisma.block.updateMany({
                    where: { blockUid: blockUid },
                    data: {
                        completionYear,
                        completionQuarter,
                        constructionStage
                    }
                });
                if (updated.count > 0) {
                    console.log(`  [OK] Block ${i}: ${constructionStage || '-'} ${completionQuarter || '-'}/${completionYear || '-'}`);
                }
            }
        }
    }

    console.log('Patch completed successfully!');
    await wp.end();
    await prisma.$disconnect();
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
