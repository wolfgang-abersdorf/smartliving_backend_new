// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import { unserialize } from 'php-serialize';

const prisma = new PrismaClient();

async function getImageUrl(wp: mysql.Connection, attachmentId?: string): Promise<string | null> {
    if (!attachmentId || isNaN(Number(attachmentId))) return null;
    const [rows] = await wp.query(`SELECT guid FROM wp_posts WHERE ID=?`, [Number(attachmentId)]);
    if ((rows as any).length > 0) return (rows as any)[0].guid;
    return null;
}

function parseSerialized(val?: string) {
    if (!val) return [];
    try {
        const parsed = unserialize(val);
        if (typeof parsed === 'object' && parsed !== null) {
            return Object.values(parsed).map(v => String(v));
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function run() {
    const wp = await mysql.createConnection(process.env.WP_DB_URL || 'mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
    console.log('Connected to WP MySQL');

    await prisma.building.deleteMany({});
    console.log('Cleared existing buildings');

    const [buildingsRows] = await wp.query(`SELECT ID, post_title, post_name FROM wp_posts WHERE post_type='buildings' AND post_status='publish'`);

    for (const b of (buildingsRows as any)) {
        console.log(`Processing building: ${b.post_title} (ID: ${b.ID})`);
        const [metaRows] = await wp.query(`SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=?`, [b.ID]);
        const meta: Record<string, string> = {};
        for (const row of (metaRows as any)) {
            meta[row.meta_key] = row.meta_value;
        }

        const mainImageUrl = await getImageUrl(wp, meta['main_image']);
        const pdfUrl = await getImageUrl(wp, meta['pdf_file']);

        const advantages = parseSerialized(meta['advantages']);

        let contacts = [];
        const contactCount = parseInt(meta['contacts']) || 0;
        for (let i = 0; i < contactCount; i++) {
            contacts.push({
                name: meta[`contacts_${i}_name`],
                phone: meta[`contacts_${i}_phone`],
                email: meta[`contacts_${i}_email`],
                position: meta[`contacts_${i}_position`]
            });
        }

        let albums = [];
        const albumCount = parseInt(meta['albums_album']) || 0;
        for (let i = 0; i < albumCount; i++) {
            const imageIds = parseSerialized(meta[`albums_album_${i}_images`]);
            const imageUrls = [];
            for (const id of imageIds) {
                const url = await getImageUrl(wp, id);
                if (url) imageUrls.push(url);
            }
            albums.push({
                album_title: meta[`albums_album_${i}_album_title`],
                images: imageUrls
            });
        }

        const savedBuilding = await prisma.building.upsert({
            where: { slug: b.post_name },
            update: { id: b.ID },
            create: {
                id: b.ID,
                title: b.post_title,
                slug: b.post_name,
                address: meta['address'],
                area: meta['area'],
                description: meta['description'],
                developer: meta['developer'],
                commission: meta['commission'],
                telegram: meta['telegram'],
                whatsapp: meta['whatsapp'],

                hasView: meta['having_a_view'] === '1',
                hasPool: meta['availability_of_a_swimming_pool'] === '1',
                hasCarAccess: meta['car_access'] === '1',
                hasParking: meta['private_parking'] === '1',

                mainImageUrl,
                pdfUrl,

                lat: meta['map'] ? null : null, // Skipping complex map extraction for now
                lng: meta['map'] ? null : null,

                buildingClass: meta['characteristics_class_of_building'],
                buildingMaterial: meta['characteristics_building_material'],
                roadType: meta['characteristics_the_road_to_the_house'],
                territory: meta['characteristics_territory'],

                advantages,
                contacts,
                albums
            }
        });

        const blockCount = parseInt(meta['block']) || 0;
        for (let i = 0; i < blockCount; i++) {
            const blockCategory = meta[`block_${i}_category`] || 'Villas';
            const blockTitle = meta[`block_${i}_title`] || `${blockCategory} - Block ${i + 1}`;
            const blockUid = `bld-${savedBuilding.id}-block-${i}`;

            const ownership = meta[`block_${i}_units_unit_0_type_of_ownership`] || meta[`block_${i}_type_of_ownership`];
            const leasehold = meta[`block_${i}_units_unit_0_total_years_of_leasehold`] || meta[`block_${i}_total_years_of_leasehold`] || null;

            const savedBlock = await prisma.block.create({
                data: {
                    blockUid,
                    buildingId: savedBuilding.id,
                    title: blockTitle,
                    category: blockCategory,
                    typeOfOwnership: ownership,
                    leaseholdYears: leasehold,
                    completionYear: meta[`block_${i}_completion_year`] ? parseInt(meta[`block_${i}_completion_year`]) : null,
                    completionQuarter: meta[`block_${i}_completion_quarter`] || null,
                    constructionStage: meta[`block_${i}_construction_stage`] || null
                }
            });

            const unitCount = parseInt(meta[`block_${i}_units_unit`]) || 0;
            for (let j = 0; j < unitCount; j++) {
                const prefix = `block_${i}_units_unit_${j}`;
                await prisma.unit.create({
                    data: {
                        blockId: savedBlock.id,
                        numberTitle: meta[`${prefix}_numbertitle`],
                        areaM2: meta[`${prefix}_area_m2`] ? parseFloat(meta[`${prefix}_area_m2`]) : null,
                        price: meta[`${prefix}_price`] ? parseFloat(meta[`${prefix}_price`]) : null,
                        currency: meta[`${prefix}_currency`] || 'USD',
                        status: meta[`${prefix}_status`] || 'Sale',
                        rooms: meta[`${prefix}_number_of_rooms`] ? parseInt(meta[`${prefix}_number_of_rooms`]) : null,
                        floor: meta[`${prefix}_floor`] ? parseInt(meta[`${prefix}_floor`]) : null,
                        floorsTotal: meta[`${prefix}_amount_of_floors`] ? parseInt(meta[`${prefix}_amount_of_floors`]) : null,
                        landArea: meta[`${prefix}_land_area`] ? parseFloat(meta[`${prefix}_land_area`]) : null,
                        apartmentTypes: parseSerialized(meta[`${prefix}_type_of_apartment`]),
                        views: parseSerialized(meta[`${prefix}_having_a_view`]),
                        photos: parseSerialized(meta[`${prefix}_photo`]),
                    } as any
                });
            }
        }
    }

    console.log('Migration completed successfully!');
    await wp.end();
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
