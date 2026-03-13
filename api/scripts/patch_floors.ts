// @ts-nocheck
// Патч v2: заполняем floor для зданий с нестандартными blockUid
// Поиск блоков по building_id + порядковому номеру
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import { unserialize } from 'php-serialize';

const prisma = new PrismaClient();

function parseSerialized(val?: string): string[] {
    if (!val) return [];
    try {
        const parsed = unserialize(val);
        if (typeof parsed === 'object' && parsed !== null) {
            return Object.values(parsed).map((v) => String(v));
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function run() {
    const wp = await mysql.createConnection('mysql://wordpress:wordpress@172.26.0.1:3376/wp-app');
    console.log('Connected to WP MySQL');

    const [buildingsRows] = await wp.query(
        `SELECT ID, post_title FROM wp_posts WHERE post_type='buildings' AND post_status='publish'`
    );

    let updated = 0;
    let skipped = 0;

    for (const b of buildingsRows as any[]) {
        const [metaRows] = await wp.query(
            `SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=?`,
            [b.ID]
        );
        const meta: Record<string, string> = {};
        for (const row of metaRows as any[]) {
            meta[row.meta_key] = row.meta_value;
        }

        const blockCount = parseInt(meta['block']) || 0;

        // Получаем список блоков этого здания из БД, отсортированных по id
        const dbBlocks = await prisma.block.findMany({
            where: { buildingId: b.ID },
            orderBy: { id: 'asc' },
        });

        for (let i = 0; i < blockCount; i++) {
            // Сначала пробуем по blockUid стандартного формата
            let block = await prisma.block.findFirst({
                where: { blockUid: `bld-${b.ID}-block-${i}` }
            });

            // Если нет — берём по индексу из списка блоков этого здания
            if (!block && dbBlocks[i]) {
                block = dbBlocks[i];
            }

            if (!block) {
                console.log(`  Block not found for building ${b.ID}, blockIndex ${i}`);
                skipped++;
                continue;
            }

            const unitCount = parseInt(meta[`block_${i}_units_unit`]) || 0;

            // Получаем юниты этого блока из БД
            const dbUnits = await prisma.unit.findMany({
                where: { blockId: block.id },
                orderBy: { id: 'asc' },
            });

            for (let j = 0; j < unitCount; j++) {
                const prefix = `block_${i}_units_unit_${j}`;
                const numberTitle = meta[`${prefix}_numbertitle`];

                if (!numberTitle) continue;

                const floorVal = meta[`${prefix}_floor`];
                const floorsVal = meta[`${prefix}_amount_of_floors`];
                const floor = floorVal != null && floorVal !== '' ? parseInt(floorVal) : null;
                const floorsTotal = floorsVal ? parseInt(floorsVal) : null;
                const apartmentTypes = parseSerialized(meta[`${prefix}_type_of_apartment`]);
                const photos = parseSerialized(meta[`${prefix}_photo`]);
                const views = parseSerialized(meta[`${prefix}_having_a_view`]);

                // Ищем по numberTitle сначала
                let unit = await prisma.unit.findFirst({
                    where: { blockId: block.id, numberTitle },
                });

                // Если не нашли по названию — берём по индексу
                if (!unit && dbUnits[j]) {
                    unit = dbUnits[j];
                }

                if (!unit) {
                    skipped++;
                    continue;
                }

                await prisma.unit.update({
                    where: { id: unit.id },
                    data: { floor, floorsTotal, apartmentTypes, photos, views },
                });

                updated++;
            }
        }
        if (b.ID == 14378) {
            console.log(`Building ${b.ID} "${b.post_title}" - checking units:`);
            const units = await prisma.unit.findMany({ where: { block: { buildingId: b.ID } } });
            units.slice(0, 5).forEach(u => console.log(`  ${u.numberTitle}: floor=${u.floor}`));
        }
    }

    console.log(`\nPatch v2 completed: ${updated} units updated, ${skipped} skipped`);
    await wp.end();
    await prisma.$disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
