// Restores the demo data: npm run db:reset
// Refuses to touch a remote database unless --force is passed.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { seedDatabase } from './seed.js';

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

function isLocalUri(uri) {
  try {
    return LOCAL_HOSTS.includes(new URL(uri).hostname);
  } catch {
    return false;
  }
}

const database = await connectDatabase();
try {
  if (!isLocalUri(database.uri) && !process.argv.includes('--force')) {
    console.error('Refusing to reset a database that is not on this computer. Use --force if you are sure.');
    process.exitCode = 1;
  } else {
    await seedDatabase();
    console.log('Demo data restored.');
  }
} finally {
  await disconnectDatabase();
}
