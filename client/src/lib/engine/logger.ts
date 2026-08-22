const stamp = () => new Date().toISOString();

const write = (level: 'info' | 'warn' | 'error' | 'debug', args: unknown[]) => {
  console[level](`[${stamp()}] [${level.toUpperCase()}]`, ...args);
};

export const logger = {
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
  debug: (...args: unknown[]) => write('debug', args),
};
