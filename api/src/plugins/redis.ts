import fastifyPlugin from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

export default fastifyPlugin(async (fastify, options) => {
    await fastify.register(fastifyRedis, {
        url: process.env.REDIS_URL || 'redis://redis:6379'
    });
});
