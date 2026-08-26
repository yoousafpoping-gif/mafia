import { config } from '../config/index.js';
import { assert, ErrorCodes, GameError } from '../errors/GameError.js';
import { logger } from '../utils/logger.js';
import { randomCode } from '../utils/random.js';
import { sanitizeName } from '../utils/validate.js';
import { GameRoom } from './GameRoom.js';

export class GameStateManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.socketIndex = new Map();
    this.sweeper = setInterval(() => this._sweepIdleRooms(), config.sweepIntervalMs);
    this.sweeper.unref?.();
  }

  createRoom({ name, socketId, isPublic = false, cosmetics }) {
    const cleanName = sanitizeName(name);
    const code = this._generateCode();
    const room = new GameRoom(this.io, code, { name: cleanName, socketId, cosmetics });
    // البحث السريع بيعمل أوض عامة — باقي الأوض بالكود بس (خاصة)
    room.isPublic = Boolean(isPublic);
    this.rooms.set(code, room);
    this._bind(socketId, code, room.hostId);
    logger.info(`Room ${code} created by ${cleanName}${isPublic ? ' (public)' : ''}`);
    return { room, player: room.players.get(room.hostId) };
  }

  joinRoom({ code, name, token, socketId, cosmetics }) {
    const room = this.getRoom(code);

    if (token) {
      const player = room.reattach({ token, socketId, cosmetics });
      this._bind(socketId, room.code, player.id);
      logger.info(`${player.name} rejoined room ${room.code}`);
      return { room, player, rejoined: true };
    }

    const player = room.addPlayer({ name, socketId, cosmetics });
    this._bind(socketId, room.code, player.id);
    logger.info(`${player.name} joined room ${room.code}`);
    return { room, player, rejoined: false };
  }

  getRoom(rawCode) {
    assert(
      typeof rawCode === 'string' && rawCode.trim() !== '',
      ErrorCodes.VALIDATION_ERROR,
      'A room code is required',
    );
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    assert(room, ErrorCodes.ROOM_NOT_FOUND, `Room ${code} does not exist or has closed`);
    return room;
  }

  resolveSocket(socketId) {
    const entry = this.socketIndex.get(socketId);
    if (!entry) throw new GameError(ErrorCodes.NOT_IN_ROOM, 'Join a room before doing that');

    const room = this.rooms.get(entry.roomCode);
    if (!room) throw new GameError(ErrorCodes.ROOM_NOT_FOUND, 'That room has closed');

    const player = room.players.get(entry.playerId);
    if (!player) throw new GameError(ErrorCodes.NOT_IN_ROOM, 'You are no longer seated in that room');

    return { room, player };
  }

  peekSocket(socketId) {
    try {
      return this.resolveSocket(socketId);
    } catch {
      return null;
    }
  }

  handleDisconnect(socketId) {
    const entry = this.socketIndex.get(socketId);
    this.socketIndex.delete(socketId);
    if (!entry) return;
    const room = this.rooms.get(entry.roomCode);
    if (room) room.handleDisconnect(socketId);
  }

  disposeRoom(room, reason) {
    this.io.to(room.code).emit('room:closed', { reason });
    room.dispose();
    this.rooms.delete(room.code);
    for (const [socketId, entry] of this.socketIndex) {
      if (entry.roomCode === room.code) this.socketIndex.delete(socketId);
    }
    logger.info(`Room ${room.code} disposed (${reason})`);
  }

  stop() {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
    this.socketIndex.clear();
  }

  _bind(socketId, roomCode, playerId) {
    this.socketIndex.set(socketId, { roomCode, playerId });
  }

  _generateCode() {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const code = randomCode(6);
      if (!this.rooms.has(code)) return code;
    }
    throw new GameError(ErrorCodes.INTERNAL_ERROR, 'Unable to allocate a room code');
  }

  _sweepIdleRooms() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      const idleFor = now - room.lastActivityAt;
      if (room.isEmpty() && idleFor > config.emptyRoomTtlMs) {
        this.disposeRoom(room, 'idle-empty');
        continue;
      }
      if (idleFor > config.roomIdleTtlMs) {
        this.disposeRoom(room, 'expired');
      }
    }
  }
}
