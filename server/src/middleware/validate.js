import { ApiError } from '../utils/ApiError.js';

/**
 * Validates parts of the request against Zod schemas. Clean values go on
 * req.validated, because req.query is read-only in Express 5.
 * Usage: validate({ body: schema, query: schema, params: schema })
 */
export const validate = (schemas) => (req, res, next) => {
  req.validated = {};
  const errors = {};

  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});
    if (result.success) {
      req.validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || part;
        errors[field] ??= issue.message;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    next(ApiError.badRequest('Please check the highlighted fields.', errors));
    return;
  }
  next();
};
