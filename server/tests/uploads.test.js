import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { api, makeAdmin, makeUser, useDatabase } from './support/helpers.js';

useDatabase();

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==',
  'base64',
);
const created = [];

afterAll(() => {
  for (const url of created) fs.rmSync(path.join(env.uploadsDir, path.basename(url)), { force: true });
});

describe('image uploads', () => {
  it('stores an admin image and serves it back', async () => {
    const { bearer } = await makeAdmin();
    const res = await api()
      .post('/api/uploads')
      .set('Authorization', bearer)
      .attach('image', png, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/.+\.png$/);
    created.push(res.body.data.url);
    const served = await api().get(res.body.data.url);
    expect(served.status).toBe(200);
  });

  it('blocks students', async () => {
    const { bearer } = await makeUser();
    const res = await api()
      .post('/api/uploads')
      .set('Authorization', bearer)
      .attach('image', png, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it('rejects a file that is not an allowed image type', async () => {
    const { bearer } = await makeAdmin();
    const res = await api()
      .post('/api/uploads')
      .set('Authorization', bearer)
      .attach('image', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/jpg, png or webp/i);
  });

  it('rejects an image over 2 MB', async () => {
    const { bearer } = await makeAdmin();
    const res = await api()
      .post('/api/uploads')
      .set('Authorization', bearer)
      .attach('image', Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2 MB/);
  });

  it('asks for a file when none is sent', async () => {
    const { bearer } = await makeAdmin();
    const res = await api().post('/api/uploads').set('Authorization', bearer);
    expect(res.status).toBe(400);
  });
});
