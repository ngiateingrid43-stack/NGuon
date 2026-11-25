import { describe, it, expect, afterEach } from 'vitest';
import { PeerHostSession } from '@client/network/PeerHostServer';

describe('PeerHostSession (Serveur Hôte P2P style Blur)', () => {
  const sessions: PeerHostSession[] = [];

  afterEach(() => {
    for (const s of sessions) s.dispose();
    sessions.length = 0;
  });

  it('promeut immédiatement le créateur en Serveur Hôte et permet de lancer la partie sans serveur Node', () => {
    let latestRoomCode = '';
    let matchMap = '';
    let playerCountInSnap = 0;

    const host = new PeerHostSession({
      onRoomUpdated: (r) => {
        latestRoomCode = r.code;
      },
      onRoomKicked: () => {},
      onRoomError: () => {},
      onChatMessage: () => {},
      onMatchStarted: (p) => {
        matchMap = p.mapId;
        playerCountInSnap = p.snapshot.players.length;
      },
      onSnapshot: () => {},
      onShotTracer: () => {},
      onDamage: () => {},
      onKillFeed: () => {},
      onMatchEnded: () => {},
    });
    sessions.push(host);

    const room = host.hostCreateRoom({
      playerName: 'MansaHôte',
      roomName: 'Salon Blur Test',
      mapId: 'great_zimbabwe',
      botFillCount: 3,
    });

    expect(host.getRole()).toBe('host');
    expect(room.code).toHaveLength(6);
    expect(latestRoomCode).toBe(room.code);

    host.startMatch();
    expect(matchMap).toBe('great_zimbabwe');
    // 1 hôte humain + 3 bots de remplissage
    expect(playerCountInSnap).toBe(4);
  });

  it('permet à un autre joueur local (BroadcastChannel) de découvrir, rejoindre le salon Hôte et démarrer', async () => {
    let clientStarted = false;

    const host = new PeerHostSession({
      onRoomUpdated: () => {},
      onRoomKicked: () => {},
      onRoomError: () => {},
      onChatMessage: () => {},
      onMatchStarted: () => {},
      onSnapshot: () => {},
      onShotTracer: () => {},
      onDamage: () => {},
      onKillFeed: () => {},
      onMatchEnded: () => {},
    });

    const client = new PeerHostSession({
      onRoomUpdated: () => {},
      onRoomKicked: () => {},
      onRoomError: () => {},
      onChatMessage: () => {},
      onMatchStarted: () => {
        clientStarted = true;
      },
      onSnapshot: () => {},
      onShotTracer: () => {},
      onDamage: () => {},
      onKillFeed: () => {},
      onMatchEnded: () => {},
    });
    sessions.push(host, client);

    const room = host.hostCreateRoom({
      playerName: 'Hôte1',
      roomName: 'LAN Kongo',
      mapId: 'kongo_forest',
      botFillCount: 0,
    });

    const listed = await client.discoverLanRooms();
    expect(listed.some((r) => r.code === room.code)).toBe(true);

    const joined = await client.joinLanRoomByCode({
      code: room.code,
      playerName: 'Ami2',
      heroId: 'amina',
      weaponId: 'war_bow',
    });
    expect(joined.ok).toBe(true);
    expect(joined.room?.members).toHaveLength(2);

    host.startMatch();
    await new Promise((r) => setTimeout(r, 80));
    expect(clientStarted).toBe(true);
  });
});
