import { describe, it, expect } from 'vitest';
import {
  ChatMessageSchema,
  CreateRoomSchema,
  PlayerInputSchema,
  PlayerShootSchema,
} from '@shared/validation/networkSchemas';
import { AntiCheatManager } from '@server/anti-cheat/AntiCheatManager';

describe('Protocoles réseau & Validation Zod', () => {
  it('valide la création de salon et applique les valeurs par défaut', () => {
    const parsed = CreateRoomSchema.safeParse({
      playerName: 'Sundiata',
      roomName: 'Tombouctou Arena',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mode).toBe('deathmatch');
      expect(parsed.data.mapId).toBe('tombouctou');
      expect(parsed.data.killLimit).toBe(15);
    }
  });

  it('rejette des entrées de mouvement ou de tir aberrantes', () => {
    const badInput = PlayerInputSchema.safeParse({
      seq: -1,
      dt: 5.0,
      moveForward: 99,
      moveRight: 0,
      jump: false,
      sprint: false,
      crouch: false,
      yaw: 0,
      pitch: 0,
      isAiming: false,
    });
    expect(badInput.success).toBe(false);

    const badShoot = PlayerShootSchema.safeParse({
      seq: 1,
      origin: { x: 9999, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
      isAiming: true,
      clientTime: 100,
    });
    expect(badShoot.success).toBe(false);

    const badChat = ChatMessageSchema.safeParse({ text: '   ' });
    expect(badChat.success).toBe(false);
  });

  it('applique la limitation de débit dans AntiCheatManager', () => {
    const ac = new AntiCheatManager();
    const now = 10000;
    expect(ac.checkRateLimit('p1:shoot', 2, now)).toBe(true);
    expect(ac.checkRateLimit('p1:shoot', 2, now + 10)).toBe(true);
    expect(ac.checkRateLimit('p1:shoot', 2, now + 20)).toBe(false);
    expect(ac.checkRateLimit('p1:shoot', 2, now + 1100)).toBe(true);
  });
});
