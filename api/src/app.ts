import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db';
import redisPlugin from './plugins/redis';
import buildingsIndex from './routes/buildings/index';
import buildingsId from './routes/buildings/[id]';

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors);
  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);

  // Register routes
  fastify.register(buildingsIndex, { prefix: '/api/buildings' });
  fastify.register(buildingsId, { prefix: '/api/buildings' });

  fastify.get('/', async () => { return { status: 'ok' } });

  try {
    const port = parseInt(process.env.PORT || '4000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
