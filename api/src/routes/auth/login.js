"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * WordPress-compatible password verification.
 *
 * WordPress uses the following hash formats:
 *
 *   1. $wp$2y$... — WordPress 6.x (bcrypt of HMAC-SHA384, with $wp prefix)
 *      Formula: bcrypt( base64( HMAC-SHA384( password, 'wp-sha384' ) ) )
 *      Storage: $wp + $2y$COST$SALTHASH  (PHP uses $2y$, Node bcrypt uses $2b$)
 *
 *   2. $P$...     — Legacy phpass (MD5-based, WordPress < 6.x)
 *      Handled via wordpress-hash-node, auto-migrated to bcrypt on next login.
 *
 *   3. $2y$ / $2b$ / $2a$ — Raw bcrypt (set manually or migrated by this app)
 *      Standard bcrypt.compare()
 */
async function checkWordPressPassword(password, storedHash) {
    // Case 1: WordPress 6.x — $wp$2y$... prefix
    // WP computes: base64_encode(hash_hmac('sha384', $password, 'wp-sha384', true))
    // then bcrypt-hashes the result. PHP stores $2y$ but Node requires $2b$.
    if (storedHash.startsWith('$wp$')) {
        // Derive the same intermediate value WordPress uses
        const hmacBuf = crypto_1.default.createHmac('sha384', 'wp-sha384').update(password).digest();
        const passwordToVerify = hmacBuf.toString('base64');
        // Strip '$wp' prefix → '$2y$10$...' → replace $2y$ with $2b$ for Node.js bcrypt
        const bcryptHash = storedHash.slice(3).replace(/^\$2y\$/, '$2b$');
        try {
            const isMatch = await bcrypt_1.default.compare(passwordToVerify, bcryptHash);
            return { isMatch };
        }
        catch {
            return { isMatch: false };
        }
    }
    // Case 2: Standard bcrypt (re-hashed by this app or set manually)
    if (storedHash.startsWith('$2y$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
        const bcryptHash = storedHash.replace(/^\$2y\$/, '$2b$');
        try {
            const isMatch = await bcrypt_1.default.compare(password, bcryptHash);
            return { isMatch };
        }
        catch {
            return { isMatch: false };
        }
    }
    // Case 3: Legacy phpass ($P$) — verify and migrate to bcrypt on success
    if (storedHash.startsWith('$P$')) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const wpHash = require('wordpress-hash-node');
        const isMatch = wpHash.CheckPassword(password, storedHash);
        if (isMatch) {
            // Upgrade: store a new standard bcrypt hash for future logins
            const newBcryptHash = await bcrypt_1.default.hash(password, 12);
            return { isMatch: true, newBcryptHash };
        }
        return { isMatch: false };
    }
    // Unknown format — deny
    return { isMatch: false };
}
async function default_1(fastify) {
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
        const { username, password } = request.body;
        // Look up user by email or username (WordPress login)
        const user = await fastify.prisma.user.findFirst({
            where: {
                OR: [
                    { email: username },
                    { username: username },
                ]
            }
        });
        if (!user) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }
        const { isMatch, newBcryptHash } = await checkWordPressPassword(password, user.passwordHash);
        if (!isMatch) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }
        // Migrate old phpass hash to bcrypt if needed
        if (newBcryptHash) {
            await fastify.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: newBcryptHash }
            });
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
                username: user.username,
                role: user.role || 'agent',
                phone_number: user.phoneNumber,
                company: user.company,
                position: user.position,
                client_mode: user.clientMode,
                profile_photo_url: user.profilePhoto
            }
        };
    });
}
