import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (fastify, opts) => {
    fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || 'supersecret'
    });

    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });
});

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: { id: number, email: string, role: string }
        user: { id: number, email: string, role: string }
    }
}
