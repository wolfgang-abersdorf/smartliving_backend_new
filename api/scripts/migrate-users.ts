import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

const prisma = new PrismaClient();

async function run() {
    console.log('Starting Users Migration...');
    const wp = await mysql.createConnection(process.env.WP_DB_URL || 'mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
    console.log('Connected to WP MySQL');

    // We don't delete existing users because we might want to keep the current test users that may have been created
    // But for a fresh migration, we could. Let's find existing emails.
    const existingEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map(u => u.email));

    const [usersRows] = await wp.query(`SELECT * FROM wp_users`);

    for (const u of (usersRows as any)) {
        if (existingEmails.has(u.user_email)) {
            console.log(`Skipping existing user: ${u.user_email}`);
            continue;
        }

        const [metaRows] = await wp.query(`SELECT meta_key, meta_value FROM wp_usermeta WHERE user_id = ?`, [u.ID]);
        const meta: Record<string, any> = {};
        for (const row of (metaRows as any)) {
            meta[row.meta_key] = row.meta_value;
        }

        let role = 'agent';
        if (meta['wp_capabilities'] && meta['wp_capabilities'].includes('administrator')) {
            role = 'admin';
        }

        let name = u.display_name || meta['first_name'] + ' ' + meta['last_name'];
        if (name.trim() === 'undefined undefined' || !name.trim()) name = u.user_login;

        console.log(`Migrating user: ${u.user_email} (Role: ${role})`);

        await prisma.user.create({
            data: {
                id: u.ID, // Preserve IDs if possible so collection references match
                username: u.user_login,
                email: u.user_email || `${u.user_login}@migrated.local`,
                name: name,
                // In WP, passwords use phpass hash. Bcrypt is what we use in node. 
                // We'll keep the WP hash. PHP hashes ($P$) aren't compatible with bcrypt by default, 
                // so users might need to reset password or we can write a custom verifier. 
                // For now, we store it.
                passwordHash: u.user_pass,
                phoneNumber: meta['phone_number'] || null,
                company: meta['company'] || null,
                position: meta['position'] || null,
                clientMode: meta['client_mode'] === '1' || meta['client_mode'] === 'true',
                role: role,
                createdAt: new Date(u.user_registered)
            }
        });
    }

    console.log('Users migration finished!');

    // Update auto-increment sequence in Postgres since we forced IDs
    await prisma.$executeRawUnsafe(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));`);
    console.log('Updated user ID sequence.');

    await wp.end();
    await prisma.$disconnect();
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
