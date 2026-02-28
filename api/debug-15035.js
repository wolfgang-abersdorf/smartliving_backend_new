const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const id = 15035;
        const collection = await prisma.collection.findUnique({
            where: { id },
            include: {
                collectionBuildings: {
                    include: { building: true }
                }
            }
        });
        console.log('RESULT:' + JSON.stringify(collection));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
