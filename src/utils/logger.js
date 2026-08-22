import { config } from '../config/index.js';

const stamp = () => new Date().toISOString();

const write = (level, args) => {
  console[level](`[${stamp()}] [${level.toUpperCase()}]`, ...args);
};

export const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  debug: (...args) => {
    if (config.logLevel === 'debug') write('debug', args);
  },
};
