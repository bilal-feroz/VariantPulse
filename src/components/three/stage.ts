/**
 * The shared WebGL stage behind every three.js view.
 *
 * It owns what each scene would otherwise repeat: the renderer, a camera, a
 * studio environment generated in code (no HDR or model file is fetched, so
 * the views keep working offline like the rest of the workspace), and a render
 * loop that only runs while there is something to see. The loop stops when the
 * view scrolls out of sight or the tab is hidden, and it sleeps whenever the
 * scene reports that nothing moved, so a still view costs no GPU time at all.
 *
 * This module imports three, so it is only ever loaded with a dynamic import
 * from an effect. Server rendering never evaluates it.
 */

import {
  CanvasTexture,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** A frame may not step further than this, so a tab returning from the background does not lurch. */
const MAX_STEP = 0.1;
/** Frames with nothing moving before the loop goes to sleep. */
const IDLE_FRAMES = 3;

export interface StageHooks {
  /** Advances the scene by `delta` seconds; returns whether anything moved. */
  update(delta: number, time: number): boolean;
  /** The drawing area changed, in CSS pixels. */
  resize(width: number, height: number): void;
  /** Runs after each drawn frame, with the camera current. */
  afterRender?(): void;
}

export interface Stage {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  /** Current size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Read live: the reader can change the setting while the page is open. */
  readonly reducedMotion: boolean;
  /** Draws at least one more frame, waking the loop if it slept. */
  invalidate(): void;
  run(hooks: StageHooks): void;
  dispose(): void;
}

export function createStage(
  host: HTMLElement,
  { fov, onLost }: { fov: number; onLost: () => void },
): Stage {
  // Throws where WebGL is unavailable; the caller keeps its fallback.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // Neutral tone mapping keeps brand colours close to their hex values.
  renderer.toneMapping = NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  // Validating shaders stalls the first frame and only helps while developing.
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";

  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  disposeTree(room);
  scene.environment = environment;

  const camera = new PerspectiveCamera(fov, 1, 0.1, 200);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let width = 0;
  let height = 0;
  let hooks: StageHooks | null = null;
  let frame = 0;
  let last = 0;
  let idle = 0;
  let invalid = true;
  let inView = true;
  let disposed = false;

  const active = () => !disposed && hooks !== null && inView && !document.hidden && width > 0 && height > 0;

  const tick = (now: number) => {
    frame = 0;
    if (!active() || !hooks) {
      last = 0;
      return;
    }
    const delta = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
    last = now;

    const moved = hooks.update(delta, now / 1000);
    if (moved || invalid) {
      renderer.render(scene, camera);
      hooks.afterRender?.();
      invalid = false;
      idle = 0;
    } else {
      idle += 1;
    }

    if (idle < IDLE_FRAMES) frame = requestAnimationFrame(tick);
    else last = 0;
  };

  const wake = () => {
    if (frame || !active()) return;
    idle = 0;
    frame = requestAnimationFrame(tick);
  };

  const measure = () => {
    const rect = host.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === width && h === height) return;
    width = w;
    height = h;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    hooks?.resize(w, h);
    invalid = true;
    wake();
  };

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(host);

  const intersection = new IntersectionObserver(
    ([entry]) => {
      inView = entry?.isIntersecting ?? true;
      wake();
    },
    { rootMargin: "80px" },
  );
  intersection.observe(host);

  const onVisibility = () => wake();
  document.addEventListener("visibilitychange", onVisibility);

  const onMotion = () => {
    invalid = true;
    wake();
  };
  motion.addEventListener("change", onMotion);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  return {
    renderer,
    scene,
    camera,
    canvas,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get reducedMotion() {
      return motion.matches;
    },
    invalidate() {
      invalid = true;
      wake();
    },
    run(next) {
      hooks = next;
      measure();
      // A size known before the hooks arrived still has to reach them.
      if (width && height) next.resize(width, height);
      invalid = true;
      wake();
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      disposeTree(scene);
      environment.dispose();
      renderer.dispose();
      // Browsers cap live WebGL contexts; give this one back now rather than at collection.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/** Frees every geometry, material and texture under `root`. */
export function disposeTree(root: Object3D) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    // Meshes, instanced meshes, points and sprites all carry these two.
    const drawable = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    drawable.geometry?.dispose();
    if (drawable.material) {
      for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) {
        materials.add(material);
      }
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value && typeof value === "object" && (value as Texture).isTexture) textures.add(value as Texture);
    }
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

/**
 * A soft round sprite drawn on a small canvas: a filled dot, or a ring when
 * `ring` is set. Used for dust, halos and the scan glow, so no image is fetched.
 */
export function softTexture({ ring = false, size = 128 } = {}): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    if (ring) {
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.62, "rgba(255,255,255,0)");
      gradient.addColorStop(0.78, "rgba(255,255,255,1)");
      gradient.addColorStop(0.9, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const scratch = new Vector3();

/** Projects a world position to CSS pixels in the stage. */
export function toScreen(
  stage: Pick<Stage, "camera" | "width" | "height">,
  world: Vector3,
): { x: number; y: number; depth: number } {
  scratch.copy(world).project(stage.camera);
  return {
    x: (scratch.x * 0.5 + 0.5) * stage.width,
    y: (-scratch.y * 0.5 + 0.5) * stage.height,
    depth: scratch.z,
  };
}

/** Exponential ease toward a target that is frame-rate independent. */
export function approach(current: number, target: number, rate: number, delta: number): number {
  return target + (current - target) * Math.exp(-rate * delta);
}
