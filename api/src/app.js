"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const db_1 = __importDefault(require("./plugins/db"));
const redis_1 = __importDefault(require("./plugins/redis"));
const auth_1 = __importDefault(require("./plugins/auth"));
const index_1 = __importDefault(require("./routes/buildings/index"));
const login_1 = __importDefault(require("./routes/auth/login"));
const me_1 = __importDefault(require("./routes/auth/me"));
const index_2 = __importDefault(require("./routes/users/index"));
const index_3 = __importDefault(require("./routes/collections/index"));
const index_4 = __importDefault(require("./routes/pdf/index"));
const index_5 = __importDefault(require("./routes/webhooks/index"));
const index_6 = __importDefault(require("./routes/activity/index"));
const fastify = (0, fastify_1.default)({ logger: true });
async function main() {
    await fastify.register(cors_1.default);
    await fastify.register(multipart_1.default, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
    await fastify.register(static_1.default, {
        root: path_1.default.join(__dirname, '../../public'),
        prefix: '/public/',
    });
    await fastify.register(db_1.default);
    await fastify.register(redis_1.default);
    await fastify.register(auth_1.default);
    // Register routes
    fastify.register(index_1.default, { prefix: '/api/buildings' });
    fastify.register(login_1.default, { prefix: '/api/auth' });
    fastify.register(me_1.default, { prefix: '/api/auth' });
    fastify.register(index_2.default, { prefix: '/api/users' });
    fastify.register(index_3.default, { prefix: '/api/collections' });
    fastify.register(index_4.default, { prefix: '/api/pdf' });
    fastify.register(index_5.default, { prefix: '/api/webhooks' });
    fastify.register(index_6.default, { prefix: '/api/activity' });
    fastify.get('/', async () => { return { status: 'ok' }; });
    try {
        const port = parseInt(process.env.PORT || '4000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on ${port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
main();
