/* Tiny timestamped logger. Keeps console output readable in dev and Docker. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const minimum = LEVELS[configuredLevel] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] < minimum) return;
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;

  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  if (meta === undefined) {
    console[level === 'debug' ? 'log' : level](line);
  } else {
    console[level === 'debug' ? 'log' : level](line, meta);
  }
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

export default logger;
