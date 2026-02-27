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

        // Checking if the hash matches. If it's a temp password directly stored as plain text during migration, allow it.
        const isMatch = await bcrypt.compare(password, user.passwordHash).catch(() => false);

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
