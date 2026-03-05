"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(fastify) {
    fastify.get('/me', {
        preValidation: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;
        const user = await fastify.prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            phone_number: user.phoneNumber,
            company: user.company,
            position: user.position,
            client_mode: user.clientMode,
            profile_photo_url: user.profilePhoto,
            role: user.role
        };
    });
}
