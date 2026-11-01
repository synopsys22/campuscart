import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..', '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

// The embedded database lives outside the project folder because the project sits
// inside OneDrive, and syncing live database files can lock or corrupt them.
const appDataRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  dbMode: process.env.DB_MODE || '',
  embeddedPort: Number(process.env.EMBEDDED_DB_PORT) || 27018,
  dataDir: process.env.CAMPUSCART_DATA_DIR || path.join(appDataRoot, 'CampusCart', 'db'),
  jwtSecret: process.env.JWT_SECRET || 'campuscart-demo-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: path.join(SERVER_ROOT, 'uploads'),
  clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
};
