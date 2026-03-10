import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.building.findMany({ select: { id: true, lat: true, lng: true } });
  const counts: Record<string, number> = {};
  all.forEach(b => {
    const key = `${b.lat},${b.lng}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(counts);
}
main().catch(console.error).finally(() => prisma.$disconnect());
