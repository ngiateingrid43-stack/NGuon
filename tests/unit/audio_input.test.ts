import { describe, it, expect } from 'vitest';
import { AudioManager } from '@client/audio/AudioManager';
import { InputManager } from '@client/input/InputManager';

describe('AudioManager Spatialisation & InputManager Multiplateforme (v0.8)', () => {
  it('calcule correctement le panoramique stéréo gauche/droite selon le yaw du joueur', () => {
    const audio = new AudioManager();
    // Joueur à l'origine regardant -Z (yaw = 0 -> droite = +X)
    const panRight = audio.computeStereoPan({ x: 0, z: 0 }, 0, { x: 12, z: 0 });
    const panLeft = audio.computeStereoPan({ x: 0, z: 0 }, 0, { x: -12, z: 0 });
    const panFront = audio.computeStereoPan({ x: 0, z: 0 }, 0, { x: 0, z: -15 });

    expect(panRight).toBeCloseTo(1, 2);
    expect(panLeft).toBeCloseTo(-1, 2);
    expect(panFront).toBeCloseTo(0, 2);
  });

  it('injecte et consomme les entrées tactiles dans InputSnapshot', () => {
    const input = new InputManager();
    input.setTouchState({
      moveForward: 0.85,
      moveRight: -0.4,
      fire: true,
      jump: true,
      ability: true,
    });

    const snap = input.consumeSnapshot();
    expect(snap.moveForward).toBeCloseTo(0.85, 2);
    expect(snap.moveRight).toBeCloseTo(-0.4, 2);
    expect(snap.fire).toBe(true);
    expect(snap.jump).toBe(true);
    expect(snap.useAbility).toBe(true);

    // Les impulsions ponctuelles (jump, ability) se réinitialisent après consommation
    const next = input.consumeSnapshot();
    expect(next.jump).toBe(false);
    expect(next.useAbility).toBe(false);
  });
});
