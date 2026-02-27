import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

export default async function (fastify: FastifyInstance) {
    // Update user profile
    fastify.put('/:id', {
        preValidation: [fastify.authenticate],
        schema: {
            params: { type: 'object', properties: { id: { type: 'integer' } } },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    phoneNumber: { type: 'string' },
                    company: { type: 'string' },
                    position: { type: 'string' },
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: number };

        if (request.user.id !== id && request.user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const data = request.body as any;

        const user = await fastify.prisma.user.update({
            where: { id },
            data
        });

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone_number: user.phoneNumber,
                company: user.company,
                position: user.position,
                client_mode: user.clientMode,
                profile_photo_url: user.profilePhoto,
                role: user.role
            }
        };
    });

    // Upload Avatar
    fastify.post('/photo', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const data = await request.file();
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        const uploadDir = path.join(__dirname, '../../../../public/uploads/avatars');
        await fs.mkdir(uploadDir, { recursive: true }).catch(() => { }); // ignore exists error

        const filename = `avatar-${request.user.id}-${Date.now()}${path.extname(data.filename)}`;
        const filepath = path.join(uploadDir, filename);

        await pipeline(data.file, createWriteStream(filepath));

        const photoUrl = `/uploads/avatars/${filename}`;

        await fastify.prisma.user.update({
            where: { id: request.user.id },
            data: { profilePhoto: photoUrl }
        });

        return { success: true, profile_photo_url: photoUrl };
    });

    // Delete Avatar
    fastify.delete('/photo', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        await fastify.prisma.user.update({
            where: { id: request.user.id },
            data: { profilePhoto: null }
        });
        return { success: true };
    });
}
