import 'dotenv/config';
import Fastify from 'fastify';
import path from 'path';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import dbPlugin from './plugins/db';
import redisPlugin from './plugins/redis';
import authPlugin from './plugins/auth';
import buildingsIndex from './routes/buildings/index';
import buildingsId from './routes/buildings/[id]';
import authLogin from './routes/auth/login';
import authMe from './routes/auth/me';
import usersIndex from './routes/users/index';
import collectionsIndex from './routes/collections/index';
import collectionsId from './routes/collections/[id]';

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors);
  await fastify.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/public/',
  });

  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);

  // Register routes
  fastify.register(buildingsIndex, { prefix: '/api/buildings' });
  fastify.register(buildingsId, { prefix: '/api/buildings' });
  fastify.register(authLogin, { prefix: '/api/auth' });
  fastify.register(authMe, { prefix: '/api/auth' });
  fastify.register(usersIndex, { prefix: '/api/users' });
  fastify.register(collectionsIndex, { prefix: '/api/collections' });
  fastify.register(collectionsId, { prefix: '/api/collections' });

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
