import type { InputManager } from '@client/input/InputManager';

/**
 * Superposition de contrôles tactiles multiplateformes (Mobile / Tablette)
 * avec joystick auto-sprint, visée tactile, tir, saut, accroupir, arme, pouvoir, grenade, interaction et pause.
 */
export class TouchControlsManager {
  private root: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private activeStickId: number | null = null;
  private activeLookId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private crouchToggled = false;
  private enabled = false;

  constructor(
    container: HTMLElement,
    private inputManager: InputManager,
    private onPause?: () => void
  ) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls-root';
    this.root.className = 'touch-controls hidden';
    this.root.innerHTML = `
      <button class="touch-btn touch-pause-btn" id="tc-btn-pause">PAUSE</button>
      <div class="touch-stick-zone" id="tc-stick-base">
        <div class="touch-stick-knob" id="tc-stick-knob"></div>
      </div>
      <div class="touch-look-zone" id="tc-look-zone"></div>
      <div class="touch-actions">
        <button class="touch-btn fire" id="tc-btn-fire">TIR</button>
        <button class="touch-btn" id="tc-btn-aim">VISER</button>
        <button class="touch-btn" id="tc-btn-jump">SAUT</button>
        <button class="touch-btn" id="tc-btn-crouch">BAISSER</button>
        <button class="touch-btn" id="tc-btn-swap">ARME</button>
        <button class="touch-btn" id="tc-btn-reload">R</button>
        <button class="touch-btn power" id="tc-btn-power">Q</button>
        <button class="touch-btn" id="tc-btn-item">G</button>
        <button class="touch-btn interact" id="tc-btn-interact">E</button>
      </div>
    `;
    container.appendChild(this.root);

    this.stickBase = this.root.querySelector('#tc-stick-base')!;
    this.stickKnob = this.root.querySelector('#tc-stick-knob')!;

    this.enabled =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0);
    this.bindTouchEvents();
  }

  public setForceEnabled(force: boolean): void {
    if (force) this.enabled = true;
  }

  public setMatchActive(active: boolean): void {
    this.root.classList.toggle('hidden', !active || !this.enabled);
  }

  private bindTouchEvents(): void {
    this.stickBase.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        this.activeStickId = t.identifier;
        this.updateStick(t.clientX, t.clientY);
      },
      { passive: true }
    );
    this.stickBase.addEventListener(
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === this.activeStickId) {
            this.updateStick(t.clientX, t.clientY);
          }
        }
      },
      { passive: true }
    );
    const resetStick = () => {
      this.activeStickId = null;
      this.stickKnob.style.transform = 'translate(0px, 0px)';
      this.inputManager.setTouchState({ moveForward: 0, moveRight: 0, sprint: false });
    };
    this.stickBase.addEventListener('touchend', resetStick, { passive: true });
    this.stickBase.addEventListener('touchcancel', resetStick, { passive: true });

    const lookZone = this.root.querySelector('#tc-look-zone') as HTMLElement;
    lookZone.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        const t = e.changedTouches[0];
        if (!t) return;
        this.activeLookId = t.identifier;
        this.lastLookX = t.clientX;
        this.lastLookY = t.clientY;
      },
      { passive: true }
    );
    lookZone.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === this.activeLookId) {
            const dx = t.clientX - this.lastLookX;
            const dy = t.clientY - this.lastLookY;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
            this.inputManager.setTouchState({
              lookDeltaX: dx * 0.0048,
              lookDeltaY: dy * 0.0042,
            });
          }
        }
      },
      { passive: true }
    );
    lookZone.addEventListener('touchend', () => {
      this.activeLookId = null;
    });

    const bindHold = (sel: string, key: 'fire' | 'aim' | 'interact') => {
      const btn = this.root.querySelector(sel)!;
      btn.addEventListener('touchstart', () => this.inputManager.setTouchState({ [key]: true }), {
        passive: true,
      });
      btn.addEventListener('touchend', () => this.inputManager.setTouchState({ [key]: false }), {
        passive: true,
      });
      btn.addEventListener('touchcancel', () => this.inputManager.setTouchState({ [key]: false }), {
        passive: true,
      });
    };
    bindHold('#tc-btn-fire', 'fire');
    bindHold('#tc-btn-aim', 'aim');
    bindHold('#tc-btn-interact', 'interact');

    this.root.querySelector('#tc-btn-jump')!.addEventListener(
      'touchstart',
      () => this.inputManager.setTouchState({ jump: true }),
      { passive: true }
    );
    this.root.querySelector('#tc-btn-reload')!.addEventListener(
      'touchstart',
      () => this.inputManager.setTouchState({ reload: true }),
      { passive: true }
    );
    this.root.querySelector('#tc-btn-power')!.addEventListener(
      'touchstart',
      () => this.inputManager.setTouchState({ ability: true }),
      { passive: true }
    );
    this.root.querySelector('#tc-btn-item')!.addEventListener(
      'touchstart',
      () => this.inputManager.setTouchState({ item: true }),
      { passive: true }
    );
    this.root.querySelector('#tc-btn-swap')!.addEventListener(
      'touchstart',
      () => this.inputManager.setTouchState({ swapWeapon: true }),
      { passive: true }
    );
    const crouchBtn = this.root.querySelector('#tc-btn-crouch') as HTMLElement;
    crouchBtn.addEventListener(
      'touchstart',
      () => {
        this.crouchToggled = !this.crouchToggled;
        crouchBtn.classList.toggle('active', this.crouchToggled);
        this.inputManager.setTouchState({ crouch: this.crouchToggled });
      },
      { passive: true }
    );
    const pauseBtn = this.root.querySelector('#tc-btn-pause') as HTMLElement;
    pauseBtn.addEventListener('click', () => this.onPause?.());
  }

  private updateStick(clientX: number, clientY: number): void {
    const rect = this.stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const moveForward = -dy / maxR;
    this.inputManager.setTouchState({
      moveRight: dx / maxR,
      moveForward,
      sprint: moveForward > 0.84,
    });
  }

  public dispose(): void {
    this.root.remove();
  }
}
