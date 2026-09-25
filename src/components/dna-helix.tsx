"use client";

/**
 * The home composition: a DNA double helix, base pairs and all, turning slowly
 * in three dimensions.
 *
 * The model is a glTF binary drawn with three.js. It is lit by a generated
 * studio environment rather than an HDR file, so nothing beyond the model
 * itself is fetched and the page keeps working offline like the rest of the
 * workspace.
 *
 * Framing is computed, not hand-placed. Turning about its own axis, the helix
 * never leaves its bounding cylinder, so the camera is pulled back until that
 * cylinder, leaned and tipped as it is on screen and in true perspective, fits
 * the column at whatever aspect the current breakpoint gives it.
 *
 * Rendering stops whenever the helix cannot be seen: scrolled out of view or
 * in a background tab. Under reduced motion it holds a single still frame.
 *
 * It is decorative (every figure it stands for is stated in text nearby), so
 * it is hidden from assistive technology.
 */

import * as React from "react";
import {
  Box3,
  Euler,
  Group,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { cn } from "@/lib/utils";

/** "DNA Helix with Base Pairing (3D)" by naratech, CC BY-NC 4.0. Credited in the page footer. */
const MODEL_URL = "/models/dna-helix.glb";

/** Lean of the helix axis from vertical, in the plane of the screen: the top toward the sources. */
const LEAN = -0.3;
/** Tip of the upper end away from the viewer, so the helix is seen from slightly above. */
const TIP = -0.2;
/**
 * Where the turn starts, and where it rests under reduced motion: the angle at
 * which the unwound end faces the viewer and both separated strands show.
 */
const INITIAL_SPIN = 1.8;
/** Radians per second about the helix's own axis: one turn every 24 seconds. */
const SPIN_SPEED = (Math.PI * 2) / 24;
/** Vertical field of view, in degrees. Narrow, so the near end is not ballooned. */
const FOV = 24;
/** How much of the column, edge to edge, the helix may fill. */
const FILL = 0.92;
/** The longest step one frame may take, so a tab returning from the background does not lurch. */
const MAX_STEP = 0.1;

export function DnaHelix({ className }: { className?: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Without WebGL the column simply stays empty; nothing in it carries meaning.
      return;
    }
    renderer.toneMapping = NeutralToneMapping;
    // Validating shaders stalls the first frame and only helps while developing.
    renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = environment;

    // The pose is fixed; only the inner group turns.
    const pose = new Group();
    pose.rotation.set(TIP, 0, LEAN);
    const spin = new Group();
    spin.rotation.y = INITIAL_SPIN;
    pose.add(spin);
    scene.add(pose);

    const camera = new PerspectiveCamera(FOV, 1, 0.01, 10);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let model: Object3D | null = null;
    let rim: Vector3[] = [];
    let inView = true;
    let last = 0;

    const render = () => renderer.render(scene, camera);

    const tick = (time: number) => {
      // The first frame after a pause has nothing to measure from.
      const step = last ? Math.min((time - last) / 1000, MAX_STEP) : 0;
      last = time;
      spin.rotation.y += SPIN_SPEED * step;
      render();
    };

    /** Runs the loop only while there is something to see and motion is welcome. */
    const schedule = () => {
      const run = model !== null && inView && !motion.matches;
      renderer.setAnimationLoop(run ? tick : null);
      if (!run) last = 0;
    };

    const fit = () => {
      const { clientWidth: width, clientHeight: height } = host;
      if (width === 0 || height === 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (rim.length > 0) camera.position.set(0, 0, fitDistance(rim, camera.aspect));
      camera.updateProjectionMatrix();
      // Resizing clears the canvas, so repaint now rather than on the next tick.
      if (model) render();
    };

    const resize = new ResizeObserver(fit);
    resize.observe(host);

    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    });
    visibility.observe(host);

    motion.addEventListener("change", schedule);

    const controller = new AbortController();
    fetch(MODEL_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${MODEL_URL} returned ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => new GLTFLoader().parseAsync(buffer, ""))
      .then((gltf) => {
        if (controller.signal.aborted) {
          dispose(gltf.scene);
          return;
        }
        const root = gltf.scene;
        root.position.sub(new Box3().setFromObject(root).getCenter(new Vector3()));
        const { halfLength, radius } = measure(root);
        rim = rimPoints(halfLength, radius);
        spin.add(root);
        model = root;
        fit();
        setReady(true);
        schedule();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("The helix model could not be loaded.", error);
      });

    return () => {
      controller.abort();
      resize.disconnect();
      visibility.disconnect();
      motion.removeEventListener("change", schedule);
      renderer.setAnimationLoop(null);
      if (model) dispose(model);
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        "pointer-events-none transition-opacity duration-700",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}

/**
 * Half the helix's length along its axis, and the furthest any vertex sits from
 * that axis. Read from the vertices rather than the bounding box: the box's
 * corners lie well outside a helix, and fitting to them would shrink it.
 */
function measure(root: Object3D): { halfLength: number; radius: number } {
  root.updateMatrixWorld(true);
  const point = new Vector3();
  let halfLength = 0;
  let radius = 0;
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const position = node.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      halfLength = Math.max(halfLength, Math.abs(point.y));
      radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
  });
  return { halfLength, radius };
}

/** Points around both rims of the bounding cylinder, posed as the helix is. */
function rimPoints(halfLength: number, radius: number): Vector3[] {
  const pose = new Euler(TIP, 0, LEAN);
  const points: Vector3[] = [];
  for (const y of [-halfLength, halfLength]) {
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      points.push(new Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)).applyEuler(pose));
    }
  }
  return points;
}

/** The camera distance at which every rim point lands inside the frame. */
function fitDistance(points: Vector3[], aspect: number): number {
  const reach = Math.tan((FOV * Math.PI) / 360) * FILL;
  let distance = 0;
  for (const point of points) {
    // A point at depth z projects to x / (d - z), so it is in frame once d
    // reaches z + |x| / reach horizontally, and likewise vertically.
    distance = Math.max(
      distance,
      point.z + Math.abs(point.x) / (reach * aspect),
      point.z + Math.abs(point.y) / reach,
    );
  }
  return distance;
}

/** Frees the GPU copies of everything the model brought with it. */
function dispose(root: Object3D) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    for (const material of [node.material].flat()) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
