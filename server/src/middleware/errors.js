import env from '../config/env.js';
import ApiError from '../lib/ApiError.js';
import logger from '../lib/logger.js';

/** Anything that did not match a route. */
export function notFound(req, _res, next) {
  next(
    ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found.`, 'route_not_found'),
  );
}

/**
 * Single place that turns thrown errors into JSON responses.
 * Known ApiErrors keep their message; unexpected errors are logged and hidden.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({
      message: 'Request body must be valid JSON.',
      code: 'invalid_json',
    });
    return;
  }

  if (error.type === 'entity.too.large') {
    res.status(413).json({
      message: 'Request body is too large.',
      code: 'payload_too_large',
    });
    return;
  }

  if (error.type === 'charset.unsupported') {
    res.status(415).json({
      message: 'Unsupported request encoding.',
      code: 'unsupported_encoding',
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      message: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  // Safety nets for constraints that are normally translated in the service.
  if (error.code === '23505') {
    res.status(409).json({
      message: 'This record already exists.',
      code: 'conflict',
    });
    return;
  }

  if (error.code === '23514' && String(error.message).includes('Maximum 4 readings per day')) {
    res.status(400).json({
      message: 'You can add only 4 readings per day.',
      code: 'daily_limit_reached',
    });
    return;
  }

  if (error.code === '22P02') {
    res.status(400).json({
      message: 'One of the submitted values has an invalid format.',
      code: 'invalid_input',
    });
    return;
  }

  logger.error('Unhandled error', {
    message: error.message,
    stack: env.isProduction ? undefined : error.stack,
  });

  res.status(500).json({
    message: 'Something went wrong on our side. Please try again.',
    code: 'server_error',
  });
}
