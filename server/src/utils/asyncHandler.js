/**
 * Wrap async route handlers so rejected promises reach Express' error
 * middleware instead of crashing the process.
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default asyncHandler;
