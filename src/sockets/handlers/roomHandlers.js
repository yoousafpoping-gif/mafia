import { sanitizeName } from '../../utils/validate.js';
import { quickMatch } from '../../matchmaker.js';

export function registerRoomHandlers(socket, manager, run) {
  socket.on('room:create', (payload, ack) =>
    run(ack, () => {
      const name = sanitizeName(payload?.name);
      const { room, player } = manager.createRoom({ name, socketId: socket.id });
      socket.join(room.code);
      return {
        code: room.code,
        playerId: player.id,
        token: player.token,
        state: room.privateState(player.id),
      };
    }),
  );

  // البحث السريع: انضم لأوضة عامة مفتوحة، أو اعمل وحدة جديدة
  socket.on('room:quick_match', (payload, ack) =>
    run(ack, () => {
      const name = sanitizeName(payload?.name);
      const { code, created } = quickMatch(manager, { name, socketId: socket.id });
      if (!created) {
        // فيه أوضة عامة — انضم بمسار الدخول العادي المجرّب
        const { room, player } = manager.joinRoom({ code, name, socketId: socket.id });
        socket.join(room.code);
        return {
          code: room.code,
          playerId: player.id,
          token: player.token,
          created: false,
          state: room.privateState(player.id),
        };
      }
      // أوضة جديدة — اللاعب هو الهوست خلاص (اتعملت بضمّه)
      const room = manager.getRoom(code);
      socket.join(room.code);
      const player = room.players.get(room.hostId);
      return {
        code: room.code,
        playerId: player.id,
        token: player.token,
        created: true,
        state: room.privateState(player.id),
      };
    }),
  );

  socket.on('room:join', (payload, ack) =>
    run(ack, () => {
      const { room, player, rejoined } = manager.joinRoom({
        code: payload?.code,
        name: payload?.name,
        token: payload?.token ?? null,
        socketId: socket.id,
      });
      socket.join(room.code);
      return {
        code: room.code,
        playerId: player.id,
        token: player.token,
        rejoined,
        state: room.privateState(player.id),
      };
    }),
  );

  socket.on('room:snapshot', (payload, ack) =>
    run(ack, () => {
      const room = manager.getRoom(payload?.code);
      return { code: room.code, phase: room.phase, playerCount: room.players.size };
    }),
  );
}
