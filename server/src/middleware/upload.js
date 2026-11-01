import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, file, done) {
    fs.mkdirSync(env.uploadsDir, { recursive: true });
    done(null, env.uploadsDir);
  },
  filename(req, file, done) {
    done(null, `${randomUUID()}${EXTENSIONS[file.mimetype]}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(req, file, done) {
    if (EXTENSIONS[file.mimetype]) done(null, true);
    else done(ApiError.badRequest('Images must be JPG, PNG or WebP.'));
  },
}).single('image');

export function imageUploaded(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload.');
  res.status(201).json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
}
