import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  NetChatMessage,
  ServerToClientEvents,
} from '../../shared/protocols/network.js';
import {
  ChatMessageSchema,
  CreateRoomSchema,
  JoinRoomSchema,
  KickPayloadSchema,
  LoadoutPayloadSchema,
  PlayerInputSchema,
  PlayerShootSchema,
  ReadyPayloadSchema,
  SwitchWeaponSchema,
} from '../../shared/validation/networkSchemas.js';
import { AntiCheatManager } from './anti-cheat/AntiCheatManager.js';
import { MatchmakingManager } from './matchmaking/MatchmakingManager.js';
import { ModerationManager } from './moderation/ModerationManager.js';
import { RoomManager } from './rooms/RoomManager.js';

export interface HeritageServerInstance {
  httpServer: http.Server;
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  roomManager: RoomManager;
  matchmaking: MatchmakingManager;
  antiCheat: AntiCheatManager;
  close: () => Promise<void>;
}

/**
 * Crée et configure une instance complète du serveur HÉRITAGE – RISE OF AFRICA.
 */
export function createHeritageServer(options?: {
  port?: number;
  host?: string;
  clientOrigin?: string;
}): HeritageServerInstance {
  const clientOrigin = options?.clientOrigin ?? process.env.CLIENT_ORIGIN ?? '*';
  const antiCheat = new AntiCheatManager();
  const moderation = new ModerationManager();

  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  const serveStatic = process.env.NODE_ENV === 'production' && fs.existsSync(clientDistDir);
    const mimeMap: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.map': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.woff2': 'font/woff2',
  };

  const httpServer = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          game: 'HERITAGE - RISE OF AFRICA',
          version: '2.1.0',
          roomsActive: roomManager.getRoomCount(),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    if (req.url === '/api/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rooms: roomManager.listPublicRooms() }));
      return;
    }

    if (serveStatic && req.url && !req.url.startsWith('/socket.io')) {
      const cleanPath = req.url.split('?')[0];
      const rel = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
      const fullPath = path.resolve(clientDistDir, rel);
      if (fullPath.startsWith(clientDistDir) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath);
        res.writeHead(200, { 'Content-Type': mimeMap[ext] ?? 'application/octet-stream' });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
      const fallback = path.join(clientDistDir, 'index.html');
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(fallback).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const roomManager = new RoomManager(antiCheat, {
    toRoom: (roomId, event, payload) => {
      (io.to(roomId) as unknown as { emit: (ev: string, data: unknown) => void }).emit(
        event,
        payload
      );
    },
    toPlayer: (playerId, event, payload) => {
      (io.to(playerId) as unknown as { emit: (ev: string, data: unknown) => void }).emit(
        event,
        payload
      );
    },
  });

  const matchmaking = new MatchmakingManager(roomManager);
  let chatCounter = 0;

  io.on('connection', (socket) => {
    const playerId = socket.id;

    socket.emit('server:welcome', {
      version: '0.2.0',
      message: 'Connecté au serveur autoritaire HÉRITAGE – RISE OF AFRICA (v0.2).',
    });

    socket.on('ping:check', (clientTime) => {
      if (typeof clientTime === 'number' && Number.isFinite(clientTime)) {
        socket.emit('pong:check', { clientTime, serverTime: Date.now() });
      }
    });

    socket.on('room:list', (ack) => {
      if (typeof ack === 'function') {
        ack(roomManager.listPublicRooms());
      }
    });

    socket.on('room:create', (rawPayload, ack) => {
      const parsed = CreateRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Paramètres de salon invalides.' });
        return;
      }

      const prevRoom = roomManager.getRoomOfPlayer(playerId);
      if (prevRoom) void socket.leave(prevRoom.roomId);

      const res = roomManager.createRoom({
        hostId: playerId,
        ...parsed.data,
      });

      if (!res.ok || !res.room) {
        ack?.({ ok: false, error: res.error ?? 'Impossible de créer le salon.' });
        return;
      }

      void socket.join(res.room.roomId);
      ack?.({ ok: true, room: res.room.getRoomStateInfo(), playerId });
    });

    socket.on('room:join', (rawPayload, ack) => {
      const parsed = JoinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Données de connexion au salon invalides.' });
        return;
      }

      const prevRoom = roomManager.getRoomOfPlayer(playerId);
      if (prevRoom) void socket.leave(prevRoom.roomId);

      const res = roomManager.joinRoomByCode({
        playerId,
        ...parsed.data,
      });

      if (!res.ok || !res.room) {
        ack?.({ ok: false, error: res.error ?? 'Impossible de rejoindre le salon.' });
        return;
      }

      void socket.join(res.room.roomId);
      ack?.({ ok: true, room: res.room.getRoomStateInfo(), playerId });
    });

    socket.on('room:leave', () => {
      const leftRoomId = roomManager.leaveCurrentRoom(playerId);
      if (leftRoomId) void socket.leave(leftRoomId);
    });

    socket.on('room:ready', (raw) => {
      const parsed = ReadyPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      roomManager.getRoomOfPlayer(playerId)?.setReady(playerId, parsed.data.ready);
    });

    socket.on('room:loadout', (raw) => {
      const parsed = LoadoutPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      roomManager
        .getRoomOfPlayer(playerId)
        ?.setLoadout(playerId, parsed.data.heroId, parsed.data.weaponId);
    });

    socket.on('room:kick', (raw) => {
      const parsed = KickPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      const room = roomManager.getRoomOfPlayer(playerId);
      if (!room) return;
      if (roomManager.kickFromRoom(playerId, parsed.data.targetPlayerId)) {
        const targetSocket = io.sockets.sockets.get(parsed.data.targetPlayerId);
        void targetSocket?.leave(room.roomId);
      }
    });

    socket.on('room:start', () => {
      const room = roomManager.getRoomOfPlayer(playerId);
      if (!room) return;
      const res = room.startMatch(playerId);
      if (!res.ok && res.error) {
        socket.emit('room:error', { message: res.error });
      }
    });

    socket.on('chat:send', (raw) => {
      const parsed = ChatMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      const room = roomManager.getRoomOfPlayer(playerId);
      if (!room) return;
      if (!moderation.canSendChat(playerId)) return;

      const combatant = room.getCombatant(playerId);
      const cleanText = moderation.sanitizeMessage(parsed.data.text);
      if (!cleanText) return;

      const msg: NetChatMessage = {
        id: `msg_${++chatCounter}`,
        roomId: room.roomId,
        senderId: playerId,
        senderName: combatant?.name ?? 'Joueur',
        text: cleanText,
        channel: parsed.data.channel,
        timestamp: Date.now(),
      };
      io.to(room.roomId).emit('chat:message', msg);
    });

    socket.on('game:input', (raw) => {
      if (!antiCheat.checkRateLimit(`${playerId}:input`, 90)) return;
      const parsed = PlayerInputSchema.safeParse(raw);
      if (!parsed.success) return;
      roomManager.getRoomOfPlayer(playerId)?.queueInput(playerId, parsed.data);
    });

    socket.on('game:shoot', (raw) => {
      if (!antiCheat.checkRateLimit(`${playerId}:shoot`, 20)) return;
      const parsed = PlayerShootSchema.safeParse(raw);
      if (!parsed.success) return;
      roomManager.getRoomOfPlayer(playerId)?.processShoot(playerId, parsed.data);
    });

    socket.on('game:reload', () => {
      if (!antiCheat.checkRateLimit(`${playerId}:reload`, 5)) return;
      roomManager.getRoomOfPlayer(playerId)?.startReload(playerId);
    });

    socket.on('game:switchWeapon', (raw) => {
      if (!antiCheat.checkRateLimit(`${playerId}:switch`, 8)) return;
      const parsed = SwitchWeaponSchema.safeParse(raw);
      if (!parsed.success) return;
      roomManager.getRoomOfPlayer(playerId)?.switchWeapon(playerId, parsed.data.weaponId);
    });

    socket.on('disconnect', () => {
      moderation.clearPlayer(playerId);
      roomManager.leaveCurrentRoom(playerId);
    });
  });

  return {
    httpServer,
    io,
    roomManager,
    matchmaking,
    antiCheat,
    close: async () => {
      roomManager.destroyAll();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}

// Démarrage automatique lorsque exécuté comme point d'entrée principal
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';
  const instance = createHeritageServer({ port, host });
  instance.httpServer.listen(port, host, () => {
    console.log(`[HÉRITAGE SERVEUR v0.2] Multijoueur actif sur http://${host}:${port}`);
  });
}
