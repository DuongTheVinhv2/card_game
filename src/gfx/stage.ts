import * as THREE from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';

/**
 * Soft highlight roll-off: identity below the knee (so card art keeps exact colours),
 * smooth exponential shoulder above it (so HDR glows turn white-hot instead of clipping hard).
 */
class SoftClipEffect extends Effect {
  constructor(knee = 0.8) {
    super(
      'SoftClipEffect',
      /* glsl */ `
      uniform float knee;
      uniform float exposure;
      uniform float saturation;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        float r = 1.0 - knee;
        vec3 hi = knee + r * (1.0 - exp(-(c - knee) / r));
        c = mix(c, hi, step(knee, c));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ['knee', new THREE.Uniform(knee)],
          ['exposure', new THREE.Uniform(1.0)],
          ['saturation', new THREE.Uniform(1.0)],
        ]),
      },
    );
  }
}

export interface StageOptions {
  /** element to attach the canvas to */
  parent: HTMLElement;
  fov?: number;
  /** quality tier: 2 = full, 1 = reduced, 0 = minimal */
  quality?: number;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: FlatCamera;
  composer: EffectComposer;
  bloom: BloomEffect;
  chroma: ChromaticAberrationEffect;
  vignette: VignetteEffect;
  softClip: SoftClipEffect;
  noise: NoiseEffect;
  /** css pixel size of the canvas */
  size: { w: number; h: number };
  resize(): void;
  render(dt: number): void;
  onResize: Array<(w: number, h: number) => void>;
}

/** Orthographic projection; fov/aspect retain the shared layout helpers' design scale. */
export type FlatCamera = THREE.OrthographicCamera & { fov: number; aspect: number };

/**
 * Standard renderer + post chain shared by the game and all dev preview pages.
 * HDR (half float) buffers: emissive values > 1 bloom; SoftClip handles the shoulder.
 */
export function createStage(opts: StageOptions): Stage {
  const quality = opts.quality ?? 2;
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality >= 2 ? 2 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x03040a, 1);
  opts.parent.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 400) as FlatCamera;
  camera.fov = opts.fov ?? 40;
  camera.aspect = 16 / 9;
  camera.position.set(0, 0, 22);

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: quality >= 2 ? 4 : 0,
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    mipmapBlur: true,
    intensity: 1.25,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.22,
    radius: 0.72,
  });
  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0, 0.0),
    radialModulation: true,
    modulationOffset: 0.25,
  });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.6 });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  noise.blendMode.opacity.value = 0.12;
  const softClip = new SoftClipEffect(0.8);

  composer.addPass(new EffectPass(camera, bloom, softClip));
  composer.addPass(new EffectPass(camera, chroma, vignette, noise));

  const size = { w: 1, h: 1 };
  const onResize: Array<(w: number, h: number) => void> = [];
  const resize = () => {
    const w = opts.parent.clientWidth || window.innerWidth;
    const h = opts.parent.clientHeight || window.innerHeight;
    size.w = w;
    size.h = h;
    renderer.setSize(w, h, true);
    composer.setSize(w, h);
    camera.aspect = w / h;
    const hh = 20 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    camera.left = -hh * camera.aspect; camera.right = hh * camera.aspect;
    camera.top = hh; camera.bottom = -hh;
    camera.updateProjectionMatrix();
    for (const cb of onResize) cb(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    composer,
    bloom,
    chroma,
    vignette,
    softClip,
    noise,
    size,
    resize,
    onResize,
    render(dt: number) {
      composer.render(dt);
    },
  };
}
