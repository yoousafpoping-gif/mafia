export function registerGameHandlers(io, socket, manager, run) {
  const withSeat = (ack, fn) =>
    run(ack, () => {
      const { room, player } = manager.resolveSocket(socket.id);
      return fn(room, player);
    });

  socket.on('game:start', (payload, ack) =>
    withSeat(ack, (room, player) => {
      room.startGame(player.id);
      return { state: room.privateState(player.id) };
    }),
  );

  socket.on('game:sync', (payload, ack) =>
    withSeat(ack, (room, player) => ({ state: room.privateState(player.id) })),
  );

  socket.on('action:night_ability', (payload, ack) =>
    withSeat(ack, (room, player) => {
      const targetId = typeof payload?.targetId === 'string' ? payload.targetId : null;
      room.submitNightAction(player.id, targetId);
      return { submitted: true };
    }),
  );

  socket.on('action:good_boy_revenge', (payload, ack) =>
    withSeat(ack, (room, player) => {
      const targetId = typeof payload?.targetId === 'string' ? payload.targetId : null;
      room.submitRevenge(player.id, targetId);
      return { submitted: true };
    }),
  );

  socket.on('action:mayor_reveal', (payload, ack) =>
    withSeat(ack, (room, player) => {
      room.revealMayor(player.id);
      return { revealed: true };
    }),
  );

  socket.on('action:vote', (payload, ack) =>
    withSeat(ack, (room, player) => {
      room.castVote(player.id, payload?.targetId);
      return { voted: true };
    }),
  );

  socket.on('game:add_bot', (payload, ack) =>
    withSeat(ack, (room, player) => {
      const count = Math.max(1, Math.min(8, Number(payload?.count) || 1));
      room.addBot(player.id, count);
      return { state: room.privateState(player.id) };
    }),
  );

  socket.on('room:rematch_vote', (payload, ack) =>
    withSeat(ack, (room, player) => {
      const ready = payload?.ready !== false;
      room.voteRematch(player.id, ready);
      return { state: room.publicState() };
    }),
  );

  // شاشة النصر → "إعادة اللعب": reset كامل من غير قطع اتصال حد.
  socket.on('game:request_play_again', (_payload, ack) =>
    withSeat(ack, (room, player) => ({
      outcome: room.requestPlayAgain(player.id),
      state: room.publicState(),
    })),
  );

  socket.on('chat:message', (payload, ack) =>
    withSeat(ack, (room, player) => room.postChat(player.id, payload?.text, payload?.channel)),
  );

  // ريأكشن إيموجي — بث لكل الأوضة فوق كارت المُرسل
  socket.on('reaction:send', (payload, ack) =>
    withSeat(ack, (room, player) => {
      room.sendReaction(player.id, payload?.emojiId);
      return { sent: true };
    }),
  );

  socket.on('room:leave', (payload, ack) =>
    run(ack, () => {
      const { room } = manager.resolveSocket(socket.id);
      socket.leave(room.code);
      manager.handleDisconnect(socket.id);
      // Last one out kills the lights — no zombie rooms left behind.
      if (room.isEmpty()) manager.disposeRoom(room, 'everyone left');
      return { left: true };
    }),
  );
}
