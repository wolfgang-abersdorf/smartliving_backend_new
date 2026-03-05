"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const redis_1 = __importDefault(require("@fastify/redis"));
exports.default = (0, fastify_plugin_1.default)(async (fastify, options) => {
    await fastify.register(redis_1.default, {
        url: process.env.REDIS_URL || 'redis://redis:6379'
    });
});
