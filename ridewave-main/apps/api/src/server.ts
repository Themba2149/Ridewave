import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { attachRealtime } from './realtime/socket';
import { logger } from './utils/logger';

const server = http.createServer(createApp());
const io = attachRealtime(server);
server.listen(env.PORT, () => {
  logger.info(`RideWave API listening on http://localhost:${env.PORT} (${env.NODE_ENV}); real-time channel on the same port`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  void io.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
