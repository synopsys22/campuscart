import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function apiNotFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Converts every error into the API's standard { success: false, message } shape. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  let errors = err.errors;

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}.`;
    errors = undefined;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use.`;
    errors = undefined;
  } else if (err.name === 'ValidationError') {
    status = 400;
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, detail]) => [field, detail.message]),
    );
    message = 'Please check the highlighted fields.';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 2 MB or smaller.' : err.message;
    errors = undefined;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
    errors = undefined;
  }

  if (status >= 500) {
    if (env.nodeEnv !== 'test') console.error(err);
    message = 'Something went wrong on our side. Please try again.';
    errors = undefined;
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }) });
}
