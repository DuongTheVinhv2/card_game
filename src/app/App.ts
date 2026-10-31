import * as THREE from 'three';
import { createStage, type Stage } from '../gfx/stage';
import { Background } from '../gfx/background';
import { FX } from '../gfx/fx/FX';
import { CameraRig } from '../gfx/cameraRig';
import { anim } from '../core/anim';
import type { Screen, PointerInfo } from './Screen';
import { loadSettings, saveSettings, type Settings } from './settings';
import { audio, type MusicTrack } from '../audio/audio';
import type { RunState } from '../logic/run';
import { saveRun } from '../logic/run';
import { tooltip } from '../ui/tooltip';
import { setMaxAnisotropy } from '../gfx/cards/cardTextures';

export class App {
  readonly stage: Stage;
  readonly rig: CameraRig;
  readonly bg: Background;
  readonly fx: FX;
  readonly ui: HTMLElement;
  readonly settings: Settings;
  screen: Screen | null = null;
  run: RunState | null = null;
  readonly pointer: PointerInfo = { x: 0, y: 0, ndc: new THREE.Vector2(), down: false, button: 0, target: null };
  time = 0;
  private last = performance.now();
  private switching = false;
  private fps = 60;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor() {
    this.settings = loadSettings();
    anim.speed = this.settings.speed;
    this.stage = createStage({ parent: document.getElementById('gl')!, fov: 38, quality: this.settings.quality });
    this.rig = new CameraRig(this.stage.camera);
    this.rig.shakeEnabled = this.settings.shake;
    this.bg = new Background();
    this.stage.scene.add(this.bg.mesh);
    this.fx = new FX();
    if (this.settings.quality < 2) {
      this.fx.intensityScale = 0.7;
      this.stage.noise.blendMode.opacity.value = 0.06;
    }
    this.stage.scene.add(this.fx.root);
    this.ui = document.getElementById('ui')!;
    setMaxAnisotropy(this.stage.renderer.capabilities.getMaxAnisotropy());
    this.stage.onResize.push((w, h) => {
      this.fx.setViewport(h * this.stage.renderer.getPixelRatio(), this.stage.camera.fov);
      this.screen?.onResize?.(w, h);
    });
    this.fx.setViewport(this.stage.size.h * this.stage.renderer.getPixelRatio(), this.stage.camera.fov);
    this.bindInput();
  }

  get w(): number {
    return this.stage.size.w;
  }

  get h(): number {
    return this.stage.size.h;
  }

  private bindInput(): void {
    const canvas = this.stage.renderer.domElement;
    // the engine remembers the requested track and starts it once the context is unlocked
    const unlock = () => audio.init();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    const upd = (e: PointerEvent) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.ndc.set((e.clientX / this.w) * 2 - 1, -(e.clientY / this.h) * 2 + 1);
      this.pointer.target = e.target;
      this.rig.mouse.set(this.pointer.ndc.x, this.pointer.ndc.y);
    };
    window.addEventListener('pointermove', (e) => {
      upd(e);
      this.screen?.onPointerMove?.(this.pointer);
    });
    canvas.addEventListener('pointerdown', (e) => {
      upd(e);
      this.pointer.down = true;
      this.pointer.button = e.button;
      this.screen?.onPointerDown?.(this.pointer);
    });
    window.addEventListener('pointerup', (e) => {
      upd(e);
      const was = this.pointer.down;
      this.pointer.down = false;
      if (was) this.screen?.onPointerUp?.(this.pointer);
    });
    window.addEventListener('keydown', (e) => this.screen?.onKey?.(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // subtle tick when hovering any button
    let lastBtn: Element | null = null;
    document.addEventListener('mouseover', (e) => {
      const b = (e.target as Element | null)?.closest?.('.btn, .seg-btn, .icon-btn');
      if (b && b !== lastBtn && !b.classList.contains('disabled')) audio.play('hover', { volume: 0.25, pitch: 1.4 });
      lastBtn = b ?? null;
    });
    window.addEventListener('blur', () => {
      this.pointer.down = false;
    });
  }

  start(): void {
    const loop = (now: number) => {
      const dtReal = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const dt = anim.update(dtReal);
      this.time += dt;
      this.rig.update(dtReal);
      this.bg.update(dt, this.time, this.w, this.h, this.rig.parallax);
      this.fx.update(dt, this.time);
      this.screen?.update(dt, this.time);
      this.stage.render(dtReal);
      this.frameCount++;
      this.fpsTimer += dtReal;
      if (this.fpsTimer >= 1) {
        this.fps = this.frameCount / this.fpsTimer;
        this.frameCount = 0;
        this.fpsTimer = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get currentFps(): number {
    return this.fps;
  }

  async fadeOut(sec = 0.45): Promise<void> {
    const f = document.getElementById('fade')!;
    f.style.transition = `opacity ${sec}s ease`;
    f.classList.remove('clear');
    await anim.waitReal(sec);
  }

  async fadeIn(sec = 0.6): Promise<void> {
    const f = document.getElementById('fade')!;
    f.style.transition = `opacity ${sec}s ease`;
    f.classList.add('clear');
    await anim.waitReal(sec * 0.6);
  }

  /** swap to a new screen with a fade through black */
  async go(next: Screen, fade = true): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    tooltip.hide();
    if (fade && this.screen) await this.fadeOut();
    if (this.screen) this.screen.exit();
    this.fx.clear();
    this.rig.offset.set(0, 0, 0);
    this.rig.lookOffset.set(0, 0, 0);
    this.screen = next;
    if (next.music) audio.setMusic(next.music as MusicTrack, 1.6);
    await next.enter();
    this.switching = false;
    await this.fadeIn();
  }

  persist(): void {
    saveRun(this.run);
  }

  saveSettings(): void {
    saveSettings(this.settings);
    anim.speed = this.settings.speed;
    this.rig.shakeEnabled = this.settings.shake;
  }

  /** world-space shake helper honoring settings */
  shake(amount: number): void {
    if (this.settings.shake) this.rig.shake(amount);
  }
}
