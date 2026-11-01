import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, inject, it } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';

afterEach(async () => {
  await disconnectDatabase();
});

describe('connectDatabase', () => {
  it('uses MONGODB_URI first when one is provided', async () => {
    const info = await connectDatabase({ uri: inject('mongoUri') });
    expect(info.mode).toBe('uri');
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('starts a working throwaway database in memory mode', async () => {
    const info = await connectDatabase({ mode: 'memory' });
    expect(info.mode).toBe('memory');
    await mongoose.connection.db.collection('probe').insertOne({ ok: true });
    const stored = await mongoose.connection.db.collection('probe').findOne({ ok: true });
    expect(stored.ok).toBe(true);
  });

  it('keeps embedded data on disk across a restart', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campuscart-db-test-'));
    const options = { embeddedPort: 27099, localPorts: [], dataDir };

    const first = await connectDatabase(options);
    expect(first.mode).toBe('embedded');
    await mongoose.connection.db.collection('probe').insertOne({ survives: 'restart' });
    await disconnectDatabase();

    await connectDatabase(options);
    const stored = await mongoose.connection.db.collection('probe').findOne({ survives: 'restart' });
    expect(stored).not.toBeNull();
    await disconnectDatabase();

    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('prefers a database already answering on the local port', async () => {
    const port = Number(new URL(inject('mongoUri')).port);
    const info = await connectDatabase({ localPorts: [port] });
    expect(info.mode).toBe('local');
    expect(info.uri).toContain(String(port));
  });
});
