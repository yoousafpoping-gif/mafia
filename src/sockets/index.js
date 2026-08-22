import { GameError } from '../errors/GameError.js';
import { logger } from '../utils/logger.js';
import { VoiceManager } from '../voice/VoiceManager.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerVoiceHandlers } from './handlers/voiceHandlers.js';

export function registerSocketHandlers(io, manager) {
  const voice = new VoiceManager(io);

  io.on('connection', (socket) => {
    logger.info(`socket ${socket.id} connected`);

    const normalizeError = (error) =>
      error instanceof GameError
        ? { code: error.code, message: error.message }
        : { code: 'INTERNAL_ERROR', message: 'Unexpected server error' };

    const run = (ack, fn) => {
      try {
        const data = fn();
        if (typeof ack === 'function') ack({ ok: true, data });
        return data;
      } catch (error) {
        const payload = normalizeError(error);
        if (typeof ack === 'function') {
          ack({ ok: false, error: payload });
        } else {
          socket.emit('action:error', payload);
        }
        if (error instanceof GameError) {
          logger.debug(`rejected ${socket.id}: ${error.code} \u2013 ${error.message}`);
        } else {
          logger.error(`handler failure from ${socket.id}:`, error);
        }
        return undefined;
      }
    };

    socket.on('disconnect', (reason) => {
      logger.info(`socket ${socket.id} disconnected (${reason})`);
      voice.dropSocket(socket.id);
      manager.handleDisconnect(socket.id);
    });

    registerRoomHandlers(socket, manager, run);
    registerGameHandlers(io, socket, manager, run);
    registerVoiceHandlers(io, socket, manager, voice, run);
  });
}
