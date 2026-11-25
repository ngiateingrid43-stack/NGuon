import { describe, it, expect } from 'vitest';
import { AntiCheatManager } from '@server/anti-cheat/AntiCheatManager';
import { RoomManager } from '@server/rooms/RoomManager';

function createTestRoomManager() {
  const events: Array<{ target: string; event: string; payload: unknown }> = [];
  const ac = new AntiCheatManager();
  const rm = new RoomManager(ac, {
    toRoom: (roomId, event, payload) => events.push({ target: roomId, event, payload }),
    toPlayer: (playerId, event, payload) => events.push({ target: playerId, event, payload }),
  });
  return { rm, events };
}

describe('RoomManager & GameRoom (Serveur autoritaire)', () => {
  it('crée un salon, permet de rejoindre par code et ferme le salon s’il devient vide', () => {
    const { rm } = createTestRoomManager();
    const created = rm.createRoom({
      hostId: 'p1',
      playerName: 'Joueur1',
      roomName: 'Duel Gao',
      mode: 'deathmatch',
      mapId: 'tombouctou',
      maxPlayers: 4,
      killLimit: 5,
      isPrivate: false,
      heroId: 'sundiata',
      weaponId: 'flintlock_musket',
    });

    expect(created.ok).toBe(true);
    const code = created.room!.code;
    expect(rm.listPublicRooms()).toHaveLength(1);

    const joined = rm.joinRoomByCode({
      code,
      playerId: 'p2',
      playerName: 'Joueur2',
      heroId: 'sundiata',
      weaponId: 'flintlock_musket',
    });
    expect(joined.ok).toBe(true);
    expect(created.room!.getPlayerCount()).toBe(2);

    rm.leaveCurrentRoom('p1');
    expect(created.room!.hostId).toBe('p2');
    rm.leaveCurrentRoom('p2');
    expect(rm.getRoomCount()).toBe(0);
  });

  it('valide les tirs côté serveur, élimine, respawn et termine le Deathmatch', () => {
    const { rm, events } = createTestRoomManager();
    const created = rm.createRoom({
      hostId: 'p1',
      playerName: 'Sundiata1',
      roomName: 'Match Test',
      mode: 'deathmatch',
      mapId: 'tombouctou',
      maxPlayers: 4,
      killLimit: 1,
      isPrivate: false,
      heroId: 'sundiata',
      weaponId: 'flintlock_musket',
    });
    const room = created.room!;
    rm.joinRoomByCode({
      code: room.code,
      playerId: 'p2',
      playerName: 'Sundiata2',
      heroId: 'sundiata',
      weaponId: 'flintlock_musket',
    });

    const started = room.startMatch('p1');
    expect(started.ok).toBe(true);
    room.stopLoop(); // Contrôle déterministe du tick dans le test

    const p1 = room.getCombatant('p1')!;
    const p2 = room.getCombatant('p2')!;

    // Positionner les deux joueurs face à face en zone dégagée
    p1.position = { x: 0, y: 0, z: 10 };
    p2.position = { x: 0, y: 0, z: 14 };
    p2.armor = 0;
    p2.health = 30;

    // Tir tête depuis p1 vers p2
    room.processShoot('p1', {
      seq: 1,
      origin: { x: 0, y: 1.56, z: 10 },
      direction: { x: 0, y: 0, z: 1 },
      isAiming: true,
    });

    expect(p2.isAlive).toBe(false);
    expect(p1.stats.kills).toBe(1);

    // Un tick déclenche la victoire par kill_limit=1
    room.stepTick(0.05);
    expect(events.some((e) => e.event === 'match:ended')).toBe(true);
    room.destroy();
  });
});
