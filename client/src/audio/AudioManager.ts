import type { UserSettings } from '@shared/validation/schemas';
import type { WeaponId } from '@shared/types/weapon';

/**
 * Synthétiseur audio procédural réaliste basé sur Web Audio API :
 * - Tirs multi-couches par arme (claquement supersonique, détonation saturée, culasse mécanique, écho)
 * - Effets d'arc, de lames, d'explosions, de fanfare de libération et d'ambiance continentale.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private driveCurve: Float32Array | null = null;
  private ambienceStarted = false;

  private masterVol = 0.75;
  private sfxVol = 0.85;
  private ambienceVol = 0.45;
  private muted = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambienceGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.ambienceGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.driveCurve = this.buildSaturationCurve(45);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.ambienceStarted) {
      this.startDesertAmbience();
    }
  }

  private buildSaturationCurve(amount: number): Float32Array {
    const samples = 256;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  public applySettings(settings: UserSettings): void {
    this.masterVol = settings.masterVolume;
    this.sfxVol = settings.sfxVolume;
    this.ambienceVol = settings.ambienceVolume;
    this.muted = settings.muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.03);
    this.ambienceGain.gain.setTargetAtTime(this.ambienceVol * 0.22, now, 0.05);
  }

  private startDesertAmbience(): void {
    if (!this.ctx || !this.ambienceGain) return;
    this.ambienceStarted = true;

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 2.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.4;

    noise.connect(filter);
    filter.connect(this.ambienceGain);
    noise.start();
  }

  public computeStereoPan(
    listenerPos: { x: number; z: number },
    listenerYaw: number,
    sourcePos: { x: number; z: number }
  ): number {
    const dx = sourcePos.x - listenerPos.x;
    const dz = sourcePos.z - listenerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return 0;
    const rightX = Math.cos(listenerYaw);
    const rightZ = -Math.sin(listenerYaw);
    const pan = (dx * rightX + dz * rightZ) / dist;
    return Math.max(-1, Math.min(1, pan));
  }

  private createOutputNode(isPlayer: boolean, pan: number, now: number): AudioNode {
    if (!isPlayer && this.ctx && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      panner.connect(this.sfxGain!);
      return panner;
    }
    return this.sfxGain!;
  }

  private spawnNoiseBurst(
    durationSec: number,
    decayRate: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    gainStart: number,
    outputNode: AudioNode,
    delay = 0,
    saturate = false
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const len = Math.max(64, Math.floor(this.ctx.sampleRate * durationSec));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-t * decayRate);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, freqStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.001, gainStart), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    if (saturate && this.driveCurve && typeof this.ctx.createWaveShaper === 'function') {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.driveCurve as Float32Array<ArrayBuffer>;
      src.connect(shaper);
      shaper.connect(filter);
    } else {
      src.connect(filter);
    }
    filter.connect(g);
    g.connect(outputNode);
    src.start(now);
  }

  /**
   * Joue le son acoustique propre à chaque catégorie d'arme (poudre noire, fusil rayé,
   * fusil de chasse, canon/mortier, arc, lames de mêlée).
   */
  public playWeaponFire(weaponId: WeaponId, isPlayer = true, distance = 0, pan = 0): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = isPlayer ? 1 : Math.max(0.08, 1 - distance / 90);
    const out = this.createOutputNode(isPlayer, pan, now);

    // 1. Armes de mêlée (lame / bâton)
    if (
      weaponId === 'machete' ||
      weaponId === 'spear' ||
      weaponId === 'short_sword' ||
      weaponId === 'war_staff' ||
      weaponId === 'imperial_sabre'
    ) {
      this.spawnNoiseBurst(0.14, 4.5, 'bandpass', 1800, 380, 0.36 * atten, out);
      this.playTone(weaponId === 'war_staff' ? 280 : 1240, 0.045, 0.1 * atten, now + 0.02, 'triangle');
      return;
    }

    // 2. Arc / Arbalète / Haches / Fronde
    if (
      weaponId === 'war_bow' ||
      weaponId === 'crossbow' ||
      weaponId === 'throwing_axes' ||
      weaponId === 'explosive_sling'
    ) {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(weaponId === 'crossbow' ? 320 : 210, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
      og.gain.setValueAtTime(0.28 * atten, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(og);
      og.connect(out);
      osc.start(now);
      osc.stop(now + 0.14);
      this.spawnNoiseBurst(0.16, 4.0, 'bandpass', 2200, 620, 0.34 * atten, out);
      return;
    }

    // 3. Armes lourdes (Canon, Double Canon, Mortier)
    const isHeavy =
      weaponId === 'hand_cannon' ||
      weaponId === 'double_barrel_shotgun' ||
      weaponId === 'incendiary_mortar';
    const isSnappy = weaponId === 'dueling_pistol' || weaponId === 'imperial_carbine' || weaponId === 'siege_gatling';
    const isLongRifle = weaponId === 'royal_long_rifle' || weaponId === 'repeating_rifle' || weaponId === 'flintlock_musket';

    // Couche 1 : Punch sub-basse poitrine
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = isHeavy ? 'sawtooth' : 'sine';
    punch.frequency.setValueAtTime(isHeavy ? 140 : isSnappy ? 230 : 195, now);
    punch.frequency.exponentialRampToValueAtTime(isHeavy ? 28 : 42, now + (isHeavy ? 0.19 : 0.095));
    punchGain.gain.setValueAtTime((isHeavy ? 0.72 : 0.56) * atten, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.21 : 0.11));
    punch.connect(punchGain);
    punchGain.connect(out);
    punch.start(now);
    punch.stop(now + 0.22);

    // Couche 2 : Claquement supersonique initial (0-28ms)
    this.spawnNoiseBurst(
      isHeavy ? 0.045 : 0.028,
      5.5,
      'highpass',
      isSnappy ? 1800 : 1200,
      900,
      (isHeavy ? 0.85 : 0.78) * atten,
      out,
      0,
      true
    );

    // Couche 3 : Déflagration de poudre saturée
    this.spawnNoiseBurst(
      isHeavy ? 0.32 : isLongRifle ? 0.22 : 0.16,
      isHeavy ? 4.2 : 6.0,
      'lowpass',
      isHeavy ? 2600 : 4200,
      isHeavy ? 240 : 420,
      (isHeavy ? 0.82 : 0.68) * atten,
      out,
      0.005,
      true
    );

    // Couche 4 : Clic mécanique culasse / réverbération ouverte lointaine
    this.spawnNoiseBurst(
      isHeavy ? 0.52 : 0.38,
      4.8,
      'bandpass',
      950,
      300,
      (isHeavy ? 0.34 : 0.24) * atten,
      out,
      0.035,
      false
    );
    if (isSnappy || isLongRifle) {
      this.playTone(2600, 0.018, 0.08 * atten, now + 0.018, 'square');
    }
  }

  public playGunshot(isPlayer = true, distance = 0, pan = 0): void {
    this.playWeaponFire('imperial_carbine', isPlayer, distance, pan);
  }

  public playExplosion(distance = 0, pan = 0): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.15, 1 - distance / 90);
    const out = this.createOutputNode(false, pan, now);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.48);
    g.gain.setValueAtTime(0.75 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.53);

    this.spawnNoiseBurst(0.65, 3.6, 'lowpass', 2200, 140, 0.82 * atten, out, 0, true);
  }

  public playLiberationFanfare(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.playTone(392, 0.16, 0.22, now, 'triangle');
    this.playTone(493.88, 0.16, 0.22, now + 0.11, 'triangle');
    this.playTone(587.33, 0.2, 0.24, now + 0.22, 'triangle');
    this.playTone(783.99, 0.38, 0.26, now + 0.34, 'triangle');
  }

  public playAbility(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.playTone(440, 0.12, 0.2, now, 'sine');
    this.playTone(660, 0.16, 0.22, now + 0.08, 'triangle');
  }

  public playReload(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.playTone(460, 0.04, 0.18, now, 'square');
    this.playTone(840, 0.05, 0.2, now + 0.16, 'triangle');
  }

  public playHitmarker(isHeadshot: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.playTone(isHeadshot ? 1480 : 920, 0.055, 0.26, now, 'sine');
    if (isHeadshot) {
      this.playTone(1960, 0.07, 0.22, now + 0.035, 'triangle');
    }
  }

  public playPickup(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.playTone(587, 0.08, 0.2, now, 'sine');
    this.playTone(880, 0.12, 0.2, now + 0.06, 'sine');
  }

  public playFootstep(onSand = true): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const out = this.sfxGain;
    this.spawnNoiseBurst(
      0.065,
      6.0,
      'bandpass',
      onSand ? 480 : 320,
      onSand ? 260 : 180,
      0.16,
      out
    );
  }

  public playMatchEnd(victory: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    if (victory) {
      this.playTone(523.25, 0.16, 0.24, now, 'triangle');
      this.playTone(659.25, 0.16, 0.24, now + 0.12, 'triangle');
      this.playTone(783.99, 0.28, 0.28, now + 0.24, 'triangle');
    } else {
      this.playTone(392, 0.2, 0.22, now, 'sine');
      this.playTone(311.13, 0.3, 0.22, now + 0.18, 'sine');
    }
  }

  private playTone(
    freq: number,
    duration: number,
    gainVal: number,
    startTime: number,
    type: OscillatorType = 'sine'
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}
