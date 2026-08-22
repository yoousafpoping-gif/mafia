export function registerVoiceHandlers(io, socket, manager, voice, run) {
  void io;
  void manager;

  socket.on('voice:join', (payload, ack) =>
    run(ack, () => {
      const { room, player } = manager.resolveSocket(socket.id);
      const peers = voice.join(room.code, socket.id, {
        playerId: player.id,
        name: player.name,
      });
      return { code: room.code, peers };
    }),
  );

  socket.on('voice:leave', (payload, ack) =>
    run(ack, () => {
      voice.leave(socket.id);
      return { left: true };
    }),
  );

  socket.on('voice:signal', (payload, ack) =>
    run(ack, () => {
      voice.relay(socket.id, payload?.to, 'voice:signal', { data: payload?.data });
      return { relayed: true };
    }),
  );

  socket.on('voice:ice', (payload, ack) =>
    run(ack, () => {
      voice.relay(socket.id, payload?.to, 'voice:ice', { candidate: payload?.candidate });
      return { relayed: true };
    }),
  );
}
