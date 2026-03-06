import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const res = await prisma.block.count({ where: { category: { equals: 'apartments', mode: 'insensitive' } } });
    console.log('insensitive block count apartments:', res);
    
    const res2 = await prisma.block.count({ where: { category: 'apartments' } });
    console.log('strict count apartments:', res2);

    const priceCount = await prisma.unit.count({ where: { price: { lte: 200000 } } });
    console.log('price <= 200000 count:', priceCount);

    const matchCount = await prisma.building.count({
        where: {
            blocks: {
                some: {
                    category: { equals: 'apartments', mode: 'insensitive' },
                    units: {
                        some: { price: { lte: 200000 }, status: { not: 'Sold' } }
                    }
                }
            }
        }
    });

    console.log('Combined matching buildings:', matchCount);
}
main().finally(() => prisma.$disconnect());
