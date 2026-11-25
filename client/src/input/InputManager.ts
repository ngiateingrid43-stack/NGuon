/**
 * Gestionnaire unifié des entrées : Clavier/Souris (QWERTY & AZERTY via event.code + Pointer Lock),
 * Manette (Gamepad API Xbox/PlayStation) et Commandes Tactiles (mobile/tablette).
 */
export interface InputSnapshot {
  moveForward: number; // -1 à +1
  moveRight: number; // -1 à +1
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  reload: boolean;
  switchSlot1: boolean;
  switchSlot2: boolean;
  switchSlot3: boolean;
  wheelDelta: number;
  useAbility: boolean;
  useItem: boolean;
  interact: boolean;
  interactHold: boolean;
  dropWeapon: boolean;
  scoreboard: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
}

export interface TouchInputState {
  moveForward: number;
  moveRight: number;
  lookDeltaX: number;
  lookDeltaY: number;
  fire: boolean;
  aim: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  reload: boolean;
  ability: boolean;
  item: boolean;
  interact: boolean;
  swapWeapon: boolean;
}

export class InputManager {
  private keysDown = new Set<string>();
  private mouseButtons = new Set<number>();
  private accumMouseX = 0;
  private accumMouseY = 0;
  private pointerLocked = false;
  private canvasDragging = false;
  private sensitivity = 1.0;
  private invertY = false;

  private reloadQueued = false;
  private slot1Queued = false;
  private slot2Queued = false;
  private slot3Queued = false;
  private wheelDeltaQueued = 0;
  private jumpQueued = false;
  private abilityQueued = false;
  private itemQueued = false;
  private interactQueued = false;
  private dropQueued = false;

  private prevPadButtons: boolean[] = [];
  private touchState: TouchInputState = {
    moveForward: 0,
    moveRight: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    fire: false,
    aim: false,
    jump: false,
    sprint: false,
    crouch: false,
    reload: false,
    ability: false,
    item: false,
    interact: false,
    swapWeapon: false,
  };

  private onPauseRequested?: () => void;
  private targetElement: HTMLElement | null = null;

  public bind(element: HTMLElement, onPauseRequested: () => void): void {
    this.targetElement = element;
    this.onPauseRequested = onPauseRequested;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public setSensitivity(val: number): void {
    this.sensitivity = val;
  }

  public setInvertY(invert: boolean): void {
    this.invertY = invert;
  }

  public isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  public requestPointerLock(): void {
    if (this.targetElement && document.pointerLockElement !== this.targetElement) {
      this.targetElement.requestPointerLock?.();
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public setTouchState(partial: Partial<TouchInputState>): void {
    Object.assign(this.touchState, partial);
  }

  private pollGamepad(): {
    moveForward: number;
    moveRight: number;
    lookX: number;
    lookY: number;
    fire: boolean;
    aim: boolean;
    jump: boolean;
    sprint: boolean;
    crouch: boolean;
    reloadEdge: boolean;
    abilityEdge: boolean;
    itemEdge: boolean;
    swapEdge: boolean;
  } {
    const empty = {
      moveForward: 0,
      moveRight: 0,
      lookX: 0,
      lookY: 0,
      fire: false,
      aim: false,
      jump: false,
      sprint: false,
      crouch: false,
      reloadEdge: false,
      abilityEdge: false,
      itemEdge: false,
      swapEdge: false,
    };
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return empty;
    const pads = navigator.getGamepads();
    const pad = pads?.[0];
    if (!pad || !pad.connected) return empty;

    const dz = (v: number) => (Math.abs(v) < 0.16 ? 0 : v);
    const pressed = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
    const rising = (idx: number) => pressed(idx) && !this.prevPadButtons[idx];

    const out = {
      moveRight: dz(pad.axes[0] ?? 0),
      moveForward: -dz(pad.axes[1] ?? 0),
      lookX: dz(pad.axes[2] ?? 0) * 0.045 * this.sensitivity,
      lookY: dz(pad.axes[3] ?? 0) * 0.036 * this.sensitivity * (this.invertY ? -1 : 1),
      fire: (pad.buttons[7]?.value ?? 0) > 0.35 || pressed(7),
      aim: (pad.buttons[6]?.value ?? 0) > 0.35 || pressed(6),
      jump: pressed(0),
      crouch: pressed(1),
      sprint: pressed(10),
      reloadEdge: rising(2),
      abilityEdge: rising(4),
      itemEdge: rising(5),
      swapEdge: rising(3),
    };

    this.prevPadButtons = pad.buttons.map((b) => Boolean(b?.pressed));
    return out;
  }

  public consumeSnapshot(): InputSnapshot {
    const gp = this.pollGamepad();

    const kbForward =
      (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp') ? 1 : 0) -
      (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown') ? 1 : 0);
    const kbRight =
      (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight') ? 1 : 0) -
      (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft') ? 1 : 0);

    const forward = Math.max(-1, Math.min(1, kbForward + gp.moveForward + this.touchState.moveForward));
    const right = Math.max(-1, Math.min(1, kbRight + gp.moveRight + this.touchState.moveRight));

    const lookScale = 0.0022 * this.sensitivity;
    const lookDeltaX = this.accumMouseX * lookScale + gp.lookX + this.touchState.lookDeltaX;
    const lookDeltaY =
      this.accumMouseY * lookScale * (this.invertY ? -1 : 1) + gp.lookY + this.touchState.lookDeltaY;
    this.accumMouseX = 0;
    this.accumMouseY = 0;
    this.touchState.lookDeltaX = 0;
    this.touchState.lookDeltaY = 0;

    const reload = this.reloadQueued || gp.reloadEdge || this.touchState.reload;
    const switchSlot1 = this.slot1Queued;
    const switchSlot2 = this.slot2Queued || gp.swapEdge;
    const switchSlot3 = this.slot3Queued;
    const wheelDelta = this.wheelDeltaQueued || (this.touchState.swapWeapon ? 1 : 0);
    const jump = this.jumpQueued || this.keysDown.has('Space') || gp.jump || this.touchState.jump;
    const useAbility = this.abilityQueued || gp.abilityEdge || this.touchState.ability;
    const useItem = this.itemQueued || gp.itemEdge || this.touchState.item;
    const interact = this.interactQueued || gp.reloadEdge || this.touchState.interact;
    const interactHold = this.keysDown.has('KeyE') || gp.reloadEdge || this.touchState.interact;
    const dropWeapon = this.dropQueued;

    this.reloadQueued = false;
    this.slot1Queued = false;
    this.slot2Queued = false;
    this.slot3Queued = false;
    this.wheelDeltaQueued = 0;
    this.jumpQueued = false;
    this.abilityQueued = false;
    this.itemQueued = false;
    this.interactQueued = false;
    this.dropQueued = false;
    this.touchState.reload = false;
    this.touchState.ability = false;
    this.touchState.jump = false;
    this.touchState.item = false;
    this.touchState.swapWeapon = false;

    const canvasFocusedFire =
      this.pointerLocked || this.canvasDragging;

    return {
      moveForward: forward,
      moveRight: right,
      jump,
      sprint:
        this.keysDown.has('ShiftLeft') ||
        this.keysDown.has('ShiftRight') ||
        gp.sprint ||
        this.touchState.sprint,
      crouch:
        this.keysDown.has('ControlLeft') ||
        this.keysDown.has('KeyC') ||
        gp.crouch ||
        this.touchState.crouch,
      fire: (canvasFocusedFire && this.mouseButtons.has(0)) || gp.fire || this.touchState.fire,
      aim: (canvasFocusedFire && this.mouseButtons.has(2)) || gp.aim || this.touchState.aim,
      reload,
      switchSlot1,
      switchSlot2,
      switchSlot3,
      wheelDelta,
      useAbility,
      useItem,
      interact,
      interactHold,
      dropWeapon,
      scoreboard: this.keysDown.has('Tab'),
      lookDeltaX,
      lookDeltaY,
    };
  }

  public resetKeys(): void {
    this.keysDown.clear();
    this.mouseButtons.clear();
    this.accumMouseX = 0;
    this.accumMouseY = 0;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Tab') {
      e.preventDefault();
    }
    if (e.code === 'Escape') {
      this.onPauseRequested?.();
    }
    if (!e.repeat) {
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.slot1Queued = true;
      if (e.code === 'Digit2' || e.code === 'Numpad2') this.slot2Queued = true;
      if (e.code === 'Digit3' || e.code === 'Numpad3') this.slot3Queued = true;
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyQ') this.abilityQueued = true;
      if (e.code === 'KeyG') this.itemQueued = true;
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'KeyX') this.dropQueued = true;
    }
    this.keysDown.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked && !(this.canvasDragging && this.mouseButtons.has(2))) return;
    const dx = Math.max(-120, Math.min(120, e.movementX));
    const dy = Math.max(-120, Math.min(120, e.movementY));
    this.accumMouseX += dx;
    this.accumMouseY += dy;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);
    if (e.target === this.targetElement) {
      this.canvasDragging = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
    if (this.mouseButtons.size === 0) {
      this.canvasDragging = false;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (Math.abs(e.deltaY) >= 2) {
      this.wheelDeltaQueued = e.deltaY > 0 ? 1 : -1;
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.pointerLocked) e.preventDefault();
  };

  private handlePointerLockChange = (): void => {
    const wasLocked = this.pointerLocked;
    this.pointerLocked = document.pointerLockElement === this.targetElement;
    if (!this.pointerLocked) {
      this.resetKeys();
      if (wasLocked) {
        this.onPauseRequested?.();
      }
    }
  };

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
