import { assert, ErrorCodes } from '../errors/GameError.js';
import { logger } from '../utils/logger.js';

export class VoiceManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  join(roomCode, socketId, seatInfo) {
    let roster = this.rooms.get(roomCode);
    if (!roster) {
      roster = new Map();
      this.rooms.set(roomCode, roster);
    }

    const peers = [...roster.keys()];
    roster.set(socketId, { ...seatInfo, roomCode });

    for (const peerId of peers) {
      this.io.to(peerId).emit('voice:peer-joined', { socketId, seatInfo });
    }
    logger.debug(`voice: ${seatInfo.name} joined voice room ${roomCode}`);
    return peers;
  }

  leave(socketId) {
    for (const [roomCode, roster] of this.rooms.entries()) {
      const seat = roster.get(socketId);
      if (!seat) continue;
      roster.delete(socketId);
      if (roster.size === 0) {
        this.rooms.delete(roomCode);
      } else {
        for (const peerId of roster.keys()) {
          this.io.to(peerId).emit('voice:peer-left', { socketId });
        }
      }
      logger.debug(`voice: ${seat.name} left voice room ${roomCode}`);
      return roomCode;
    }
    return null;
  }

  relay(fromSocketId, toSocketId, event, payload) {
    assert(typeof toSocketId === 'string', ErrorCodes.VALIDATION_ERROR, 'A target socket is required');

    const fromRoom = this.seatOf(fromSocketId)?.roomCode ?? null;
    const toSeat = this.seatOf(toSocketId);
    assert(toSeat, ErrorCodes.VALIDATION_ERROR, 'Target peer is not in a voice room');
    assert(
      fromRoom !== null && fromRoom === toSeat.roomCode,
      ErrorCodes.VALIDATION_ERROR,
      'Signal target is in another room',
    );

    this.io.to(toSocketId).emit(event, { from: fromSocketId, ...payload });
  }

  seatOf(socketId) {
    for (const [roomCode, roster] of this.rooms.entries()) {
      const seat = roster.get(socketId);
      if (seat) return { ...seat, roomCode };
    }
    return null;
  }

  dropSocket(socketId) {
    return Boolean(this.leave(socketId));
  }
}
