import fs from 'node:fs';
import net from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.js';

const LOCAL_MONGO_PORT = 27017;
const PROBE_TIMEOUT_MS = 800;

let embeddedServer = null;

/** Resolves true when something accepts TCP connections on the port. */
function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function connectTo(uri, mode) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return { mode, uri };
}

/**
 * Connects Mongoose using the first available option:
 *   1. An explicit URI (MONGODB_URI).
 *   2. A database already answering locally: a real MongoDB on 27017, or an
 *      embedded mongod left running on the embedded port.
 *   3. A new embedded mongod with data saved on disk.
 * Passing mode "memory" skips all of that and starts a throwaway database.
 */
export async function connectDatabase(options = {}) {
  const {
    uri = env.mongoUri,
    mode = env.dbMode,
    embeddedPort = env.embeddedPort,
    localPorts = [LOCAL_MONGO_PORT, embeddedPort],
    dataDir = env.dataDir,
  } = options;

  if (uri) return connectTo(uri, 'uri');

  if (mode === 'memory') {
    embeddedServer = await MongoMemoryServer.create();
    return connectTo(embeddedServer.getUri('campuscart'), 'memory');
  }

  for (const port of localPorts) {
    if (await isPortOpen(port)) {
      const label = port === embeddedPort ? 'embedded-reused' : 'local';
      return connectTo(`mongodb://127.0.0.1:${port}/campuscart`, label);
    }
  }

  fs.mkdirSync(dataDir, { recursive: true });
  embeddedServer = await MongoMemoryServer.create({
    instance: { port: embeddedPort, dbPath: dataDir, storageEngine: 'wiredTiger' },
  });
  return connectTo(embeddedServer.getUri('campuscart'), 'embedded');
}

/** Closes the connection and stops mongod if this process started it. Saved data is kept. */
export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (embeddedServer) {
    await embeddedServer.stop({ doCleanup: false });
    embeddedServer = null;
  }
}
