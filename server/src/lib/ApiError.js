/**
 * An error we deliberately send to the client. `status` is the HTTP status,
 * `code` is a stable machine-readable string and `details` is optional.
 */
export class ApiError extends Error {
  constructor(status, message, code = 'error', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = 'bad_request', details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Please log in to continue.', code = 'unauthorized') {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have access to this resource.', code = 'forbidden') {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Not found.', code = 'not_found') {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = 'conflict') {
    return new ApiError(409, message, code);
  }
}

export default ApiError;
