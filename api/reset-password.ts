import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function run() {
    const rawPassword = 'password@123';
    const hash = await bcrypt.hash(rawPassword, 10);
    
    await prisma.user.update({
        where: { username: 'admin_db' },
        data: { passwordHash: hash }
    });
    
    console.log(`Password for admin_db has been reset to: ${rawPassword}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
