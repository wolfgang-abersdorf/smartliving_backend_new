const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const buildings = await prisma.building.findMany({
    include: {
      blocks: {
        include: {
          units: true
        }
      }
    }
  });
  console.log(JSON.stringify(buildings, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
