import { ensureSeeded } from '../seed/seed.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

const DESCRIPTIONS = {
  uri: 'your MONGODB_URI',
  local: 'local MongoDB',
  embedded: 'embedded MongoDB, data saved on disk',
  'embedded-reused': 'embedded MongoDB, already running',
  memory: 'in-memory MongoDB, data is lost on exit',
};

async function main() {
  console.log('Starting CampusCart...');
  const database = await connectDatabase();
  if (await ensureSeeded()) console.log('Empty database found, so demo data was added.');

  const app = createApp();
  app.locals.databaseMode = database.mode;

  const server = app.listen(env.port, () => {
    console.log(`\n  CampusCart is running at http://localhost:${env.port}`);
    console.log(`  Database: ${DESCRIPTIONS[database.mode]}`);
    if (database.mode !== 'uri') console.log(`  Browse the data with the MongoDB extension: ${database.uri}`);
    console.log('\n  Demo logins');
    console.log('    Student  student@campuscart.dev / Student@123');
    console.log('    Admin    admin@campuscart.dev / Admin@123');
    console.log('\n  Press Ctrl+C to stop.\n');
  });

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Close the other app, or set a different PORT in .env.`);
    } else {
      console.error(error);
    }
    await disconnectDatabase();
    process.exit(1);
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\nStopping CampusCart...');
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('CampusCart could not start:', error.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
