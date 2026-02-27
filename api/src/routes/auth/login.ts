import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';

export default async function (fastify: FastifyInstance) {
    fastify.post('/login', {
        schema: {
            body: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { username, password } = request.body as any;

        const user = await fastify.prisma.user.findFirst({
            where: {
                OR: [
                    { email: username },
                    { name: username }
                ]
            }
        });

        if (!user) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        // Checking if the hash matches using bcrypt first
        let isMatch = await bcrypt.compare(password, user.passwordHash).catch(() => false);

        // If bcrypt fails and it looks like a WP hash, try wordpress-hash-node
        if (!isMatch && user.passwordHash.startsWith('$P$')) {
            const wpHash = require('wordpress-hash-node');
            isMatch = wpHash.CheckPassword(password, user.passwordHash);

            // Re-hash with bcrypt for future logins if it matched
            if (isMatch) {
                const newHash = await bcrypt.hash(password, 10);
                await fastify.prisma.user.update({
                    where: { id: user.id },
                    data: { passwordHash: newHash }
                });
            }
        }

        if (!isMatch && user.passwordHash !== password) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        const token = fastify.jwt.sign({
            id: user.id,
            email: user.email,
            role: user.role || 'agent'
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role || 'agent',
                profile_photo_url: user.profilePhoto
            }
        };
    });
}
