import type * as THREE from 'three';

export interface PointerInfo {
  x: number;
  y: number;
  ndc: THREE.Vector2;
  down: boolean;
  button: number;
  target: EventTarget | null;
}

export interface Screen {
  /** music track to play while active */
  readonly music?: string;
  enter(): void | Promise<void>;
  exit(): void;
  update(dt: number, time: number): void;
  onPointerMove?(p: PointerInfo): void;
  onPointerDown?(p: PointerInfo): void;
  onPointerUp?(p: PointerInfo): void;
  onKey?(e: KeyboardEvent): void;
  onResize?(w: number, h: number): void;
}
