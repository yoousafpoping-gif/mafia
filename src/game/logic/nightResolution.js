import { DEATH_CAUSES, ROLES, ROLE_TEAMS, TEAMS } from '../constants.js';

export function resolveNightActions(players, actions) {
  const deaths = [];
  const deathCauses = new Map();
  const events = [];

  const addDeath = (id, cause) => {
    if (!id) return;
    if (!deathCauses.has(id)) {
      deathCauses.set(id, []);
      deaths.push(id);
    }
    deathCauses.get(id).push(cause);
  };

  const nameOf = (id) => players.get(id)?.name ?? 'حد منهم';

  const actorsByRole = (role) =>
    [...players.values()].filter((player) => player.role === role && actions.has(player.id));

  const medicTargetId =
    actorsByRole(ROLES.MEDIC).map((p) => actions.get(p.id).targetId).find((t) => t !== null) ?? null;
  const medicSavedIds = new Set(medicTargetId ? [medicTargetId] : []);

  const sniperShot = actorsByRole(ROLES.SNIPER)
    .map((actor) => ({ actor, targetId: actions.get(actor.id).targetId }))
    .find((shot) => shot.targetId !== null);

  if (sniperShot) {
    const target = players.get(sniperShot.targetId);
    if (ROLE_TEAMS[target.role] === TEAMS.TOWN) {
      if (medicSavedIds.has(target.id)) {
        addDeath(sniperShot.actor.id, DEATH_CAUSES.SNIPER_BACKFIRE);
        events.push({
          kind: 'SNIPER_BACKFIRE_SAVED',
          text: `القناص ضرب في ${nameOf(target.id)}، بس الدكتور مسكه وحيّاه.. والقناص دفع التمن.`,
        });
      } else {
        addDeath(target.id, DEATH_CAUSES.SNIPER_SHOT);
        addDeath(sniperShot.actor.id, DEATH_CAUSES.SNIPER_BACKFIRE);
        events.push({
          kind: 'SNIPER_BACKFIRE',
          text: `طلقة في الضلمة.. ${nameOf(target.id)} كان بريء، والقناص مشي معاه تحت.`,
        });
      }
    } else {
      addDeath(target.id, DEATH_CAUSES.SNIPER_SHOT);
      events.push({
        kind: 'SNIPER_HIT',
        text: `رصاصة واحدة في القلب.. ${nameOf(target.id)} ما شافش الفجر.`,
      });
    }
  }

  const bossEntry = actorsByRole(ROLES.MAFIA_BOSS)[0];
  const bossTargetId = bossEntry ? actions.get(bossEntry.id).targetId : null;

  if (bossTargetId) {
    const target = players.get(bossTargetId);
    if (medicSavedIds.has(bossTargetId)) {
      events.push({
        kind: 'MEDIC_SAVE',
        text: `الموت جالي ${nameOf(bossTargetId)}.. بس الدكتور كان مستنيه.`,
      });
    } else {
      addDeath(bossTargetId, DEATH_CAUSES.MAFIA_KILL);
      events.push({
        kind: 'MAFIA_KILL',
        text: `${nameOf(bossTargetId)} راح من غير ما حد يسمع صوته بالليل.`,
      });
    }
  }

  if (medicTargetId && !bossTargetId && !sniperShot) {
    events.push({
      kind: 'QUIET_NIGHT',
      text: 'البلد نامت قلقانة، بس كلها صحت بالسلامة.',
    });
  }

  const silencerEntry = actorsByRole(ROLES.SILENCER)[0];
  const silencerTargetId = silencerEntry ? actions.get(silencerEntry.id).targetId : null;

  // FRAMER — plants evidence on someone so they read as Mafia to investigations.
  const framers = actorsByRole(ROLES.FRAMER);
  const framedIds = new Set(
    framers
      .map((p) => actions.get(p.id).targetId)
      .filter((t) => t && !framers.some((f) => f.id === t)),
  );

  // DETECTIVE — investigates one target; framed players (and real mafia) read guilty.
  let investigation = null;
  const detectiveEntry = actorsByRole(ROLES.DETECTIVE)[0];
  if (detectiveEntry) {
    const targetId = actions.get(detectiveEntry.id).targetId;
    const target = targetId ? players.get(targetId) : null;
    if (target && target.isAlive) {
      const readsMafia =
        ROLE_TEAMS[target.role] === TEAMS.MAFIA || framedIds.has(target.id);
      investigation = {
        detectiveId: detectiveEntry.id,
        targetId: target.id,
        targetName: target.name,
        verdict: readsMafia ? 'MAFIA' : 'TOWN',
      };
    }
  }

  // VIGILANTE — a town-side shooter: kills unless the Medic saved the target.
  const vigilanteShot = actorsByRole(ROLES.VIGILANTE)
    .map((actor) => ({ actor, targetId: actions.get(actor.id).targetId }))
    .find((shot) => shot.targetId !== null);

  if (vigilanteShot) {
    const target = players.get(vigilanteShot.targetId);
    if (target && target.isAlive) {
      if (medicSavedIds.has(target.id)) {
        events.push({
          kind: 'VIGILANTE_SAVED',
          text: `طلقة في الظلام.. لكن ${nameOf(target.id)} كان محميّ.`,
        });
      } else {
        addDeath(target.id, DEATH_CAUSES.SNIPER_SHOT);
        events.push({
          kind: 'VIGILANTE_HIT',
          text: `${nameOf(target.id)} قعاد صاحي بالليل.. ولقى نهايته على يد المنتقم.`,
        });
      }
    }
  }

  return {
    deaths,
    deathCauses,
    events,
    addDeath,
    silenceTargetId: silencerTargetId,
    shotFired: Boolean(sniperShot),
    shooterId: sniperShot ? sniperShot.actor.id : null,
    vigilanteFired: Boolean(vigilanteShot),
    vigilanteShooterId: vigilanteShot ? vigilanteShot.actor.id : null,
    investigation,
  };
}
