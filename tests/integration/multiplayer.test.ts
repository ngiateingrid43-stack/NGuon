import { describe, it, expect, afterEach } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/protocols/network';
import { createHeritageServer, type HeritageServerInstance } from '@server/server';

describe('Intégration Multijoueur Socket.IO (v0.2)', () => {
  let server: HeritageServerInstance | null = null;
  const clients: Array<Socket<ServerToClientEvents, ClientToServerEvents>> = [];

  afterEach(async () => {
    for (const c of clients) {
      c.disconnect();
    }
    clients.length = 0;
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('permet à deux joueurs de créer/rejoindre un salon, lancer un Deathmatch et échanger des états', async () => {
    server = createHeritageServer({ clientOrigin: '*' });
    await new Promise<void>((resolve) => {
      server!.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3099;
    const url = `http://127.0.0.1:${port}`;

    const c1: Socket<ServerToClientEvents, ClientToServerEvents> = ioClient(url, {
      transports: ['websocket'],
    });
    const c2: Socket<ServerToClientEvents, ClientToServerEvents> = ioClient(url, {
      transports: ['websocket'],
    });
    clients.push(c1, c2);

    await Promise.all([
      new Promise<void>((r) => c1.on('connect', () => r())),
      new Promise<void>((r) => c2.on('connect', () => r())),
    ]);

    // Joueur 1 crée le salon
    const createRes = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      c1.emit(
        'room:create',
        { playerName: 'Mansa', roomName: 'Tombouctou Live', killLimit: 5 },
        (res) => resolve({ ok: res.ok, code: res.room?.code })
      );
    });
    expect(createRes.ok).toBe(true);
    expect(createRes.code).toBeTruthy();

    // Joueur 2 rejoint avec le code
    const joinRes = await new Promise<{ ok: boolean; count?: number }>((resolve) => {
      c2.emit('room:join', { code: createRes.code!, playerName: 'Zazzau' }, (res) =>
        resolve({ ok: res.ok, count: res.room?.members.length })
      );
    });
    expect(joinRes.ok).toBe(true);
    expect(joinRes.count).toBe(2);

    // Lancement de la partie par l'hôte (c1)
    const bothStarted = Promise.all([
      new Promise<string>((r) => c1.once('match:started', (p) => r(p.mapId))),
      new Promise<string>((r) => c2.once('match:started', (p) => r(p.mapId))),
    ]);
    c1.emit('room:start');
    const [m1, m2] = await bothStarted;
    expect(m1).toBe('tombouctou');
    expect(m2).toBe('tombouctou');

    // Réception d'un snapshot synchronisé à 20 Hz
    const snap = await new Promise<number>((resolve) => {
      c2.once('match:snapshot', (s) => resolve(s.players.length));
    });
    expect(snap).toBe(2);
  });
});
