/**
 * The genome map: chromosomes drawn to scale, with every monitored variant
 * pinned where ClinVar places it.
 *
 * Two arrangements share one scene:
 * - `karyotype` stands all 24 chromosomes side by side, centromeres aligned as
 *   a cytogeneticist lays them out, on a shallow arc so the row has depth. On a
 *   narrow view only the chromosomes that carry a monitored variant are kept,
 *   so the figure stays legible on a phone.
 * - `locus` lays one chromosome on its side, p arm to the left, to show where
 *   a single variant sits.
 *
 * Each variant is a lollipop, as in a mutation plot: a stalk out of the
 * chromosome at its GRCh38 position, a head coloured by its signal, and a ring
 * round the chromosome marking the locus. Variants a few megabases apart share
 * a ring and fan out, since at this scale they are the same place.
 *
 * Lengths and centromeres come from `lib/genome`; positions from the evidence.
 * Nothing on the figure is placed by hand.
 *
 * Dragging turns the figure within a range that keeps it readable; the pointer
 * tilts it slightly, and at rest it sways a little so it reads as solid. All of
 * that stops under reduced motion except dragging.
 */

import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";

import { GRCH38, type Chromosome } from "@/lib/genome";
import { SIGNALS, type Signal } from "@/lib/signal";

import { approach, attachPointer, createStage, softTexture, toScreen } from "./stage";

/** Scene units for the longest chromosome, chr1. */
const TALLEST = 4.2;
const SCALE = TALLEST / GRCH38[0].length;
const RADIUS = 0.15;
const SPACING = 0.62;
/** Radius of the arc the row stands on; smaller bends it more. */
const ARC = 15;
/** Loci closer than this (scene units) share a ring and fan out. */
const CLUSTER = 0.14;
/** How far a stalk leans off the line of sight, so it reads as a stalk and not a dot. */
const STALK_LEAN = { karyotype: 0.7, locus: 0.95 } as const;
/** Stalk length, shorter in the karyotype so a marker never reaches the next chromosome. */
const STALK_LENGTH = { karyotype: 0.3, locus: 0.3 } as const;
/** Angle between neighbouring stalks when several variants share a locus. */
const FAN = 0.5;
const HEAD = 0.072;
const FOV = 22;
/** Below this width (CSS px) the karyotype keeps only chromosomes with variants. */
const COMPACT_BELOW = 560;

const YAW_LIMIT = 0.55;
const PITCH_LIMIT = 0.28;
const SWAY = 0.05;

const BONE = "#F7F4ED";
const PORCELAIN_P = "#F4EEE6";
const PORCELAIN_Q = "#EAE1D6";
const CENTROMERE = "#C98C9C";
const CARRIER = "#EDC9D2";
const RING = "#7A263A";

export interface GenomeFinding {
  key: string;
  signal: Signal;
  chromosome: string;
  position: number;
}

export interface GenomePoint {
  key: string;
  x: number;
  y: number;
  front: boolean;
  shown: boolean;
}

export interface GenomeLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  shown: boolean;
  /** Whether a monitored variant sits on this chromosome. */
  carrier: boolean;
}

export interface GenomeOptions {
  findings: GenomeFinding[];
  mode: "karyotype" | "locus";
  /** Locus mode: the variant the figure is about. */
  focusKey: string | null;
  onProject(points: GenomePoint[], labels: GenomeLabel[]): void;
  onReady(): void;
  onLost(): void;
  onDragChange(dragging: boolean): void;
}

export interface GenomeController {
  /** Keys the current filter keeps; null keeps everything. */
  setVisible(keys: ReadonlySet<string> | null): void;
  setActive(key: string | null): void;
  dispose(): void;
}

/** The lathe profile of one chromosome: rounded ends and a constriction at the centromere. */
function chromosomeGeometry(chromosome: Chromosome): LatheGeometry {
  const top = chromosome.centromere * SCALE;
  const bottom = -(chromosome.length - chromosome.centromere) * SCALE;
  const length = top - bottom;
  const cap = Math.min(RADIUS, length / 3);
  const points: Vector2[] = [];

  const pinch = (y: number) => 1 - 0.45 * Math.exp(-((y / (RADIUS * 0.85)) ** 2));
  const add = (y: number, r: number) => points.push(new Vector2(Math.max(r * pinch(y), 1e-4), y));

  const CAP_STEPS = 10;
  for (let k = 0; k <= CAP_STEPS; k += 1) {
    const angle = (k / CAP_STEPS) * (Math.PI / 2);
    add(bottom + cap * (1 - Math.cos(angle)), RADIUS * Math.sin(angle));
  }
  const body = Math.max(2, Math.ceil((length - cap * 2) / 0.035));
  for (let k = 1; k < body; k += 1) add(bottom + cap + ((length - cap * 2) * k) / body, RADIUS);
  for (let k = CAP_STEPS; k >= 0; k -= 1) {
    const angle = (k / CAP_STEPS) * (Math.PI / 2);
    add(top - cap * (1 - Math.cos(angle)), RADIUS * Math.sin(angle));
  }

  const geometry = new LatheGeometry(points, 40);

  // p arm, q arm and the centromere each get their own tone.
  const position = geometry.getAttribute("position");
  const colours = new Float32Array(position.count * 3);
  const p = new Color(PORCELAIN_P);
  const q = new Color(PORCELAIN_Q);
  const cen = new Color(CENTROMERE);
  const tone = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    tone.copy(y > 0 ? p : q).lerp(cen, Math.exp(-((y / (RADIUS * 0.7)) ** 2)) * 0.85);
    tone.toArray(colours, i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
  return geometry;
}

interface ChromosomeView {
  chromosome: Chromosome;
  group: Group;
  material: MeshPhysicalMaterial;
  carrier: boolean;
  /** 0…1, eased: how strongly it is tinted as holding shown variants. */
  tint: number;
  label: Vector3;
}

interface FindingView {
  finding: GenomeFinding;
  chromosome: ChromosomeView;
  head: Mesh<SphereGeometry, MeshStandardMaterial>;
  stalk: Mesh<CylinderGeometry, MeshBasicMaterial>;
  halo: Sprite;
  ring: Mesh<TorusGeometry, MeshStandardMaterial> | null;
  /** Height of the locus on its chromosome, in the chromosome's own frame. */
  y: number;
  /** Eased 0…1 values. */
  shown: number;
  emphasis: number;
}

export function mountGenome(stageHost: HTMLElement, interactive: HTMLElement, options: GenomeOptions): GenomeController {
  const stage = createStage(stageHost, { fov: FOV, onLost: options.onLost });
  const { scene, camera } = stage;
  const locus = options.mode === "locus";

  scene.fog = new Fog(BONE, 10, 40);
  scene.environmentIntensity = 0.55;
  scene.add(new HemisphereLight("#FFFAF4", "#E4D6CC", 1.1));
  const key = new DirectionalLight("#FFF2E6", 1.7);
  key.position.set(-4, 6, 9);
  scene.add(key);
  const rim = new DirectionalLight("#F0BAC6", 0.9);
  rim.position.set(5, 2, -6);
  scene.add(rim);

  // root: pointer and drag · figure: the arrangement (laid on its side in locus mode)
  const root = new Group();
  const figure = new Group();
  root.add(figure);
  scene.add(root);

  const focus = options.findings.find((f) => f.key === options.focusKey) ?? null;
  const carriers = new Set(options.findings.map((f) => f.chromosome));

  /* -- Chromosomes -- */

  const chromosomes = new Map<string, ChromosomeView>();
  const drawn = locus
    ? GRCH38.filter((c) => c.name === (focus?.chromosome ?? options.findings[0]?.chromosome))
    : GRCH38;

  for (const chromosome of drawn) {
    const material = new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.48,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      sheen: 0.35,
      sheenColor: new Color("#F6D8DF"),
    });
    const group = new Group();
    group.add(new Mesh(chromosomeGeometry(chromosome), material));
    figure.add(group);
    const bottom = -(chromosome.length - chromosome.centromere) * SCALE;
    chromosomes.set(chromosome.name, {
      chromosome,
      group,
      material,
      carrier: carriers.has(chromosome.name),
      tint: 0,
      label: new Vector3(0, bottom - 0.3, 0),
    });
  }

  if (locus) figure.rotation.z = Math.PI / 2;

  // Locus mode names the two arms beneath the laid-down chromosome (local -x is down once turned).
  const armLabels: { id: string; text: string; group: Group; at: Vector3 }[] = [];
  if (locus) {
    const only = [...chromosomes.values()][0];
    if (only) {
      const { length, centromere } = only.chromosome;
      const below = -(RADIUS + 0.11);
      armLabels.push(
        { id: "p", text: "p arm", group: only.group, at: new Vector3(below, (centromere * SCALE) / 2, 0) },
        { id: "q", text: "q arm", group: only.group, at: new Vector3(below, (-(length - centromere) * SCALE) / 2, 0) },
      );
    }
  }

  /* -- Variants -- */

  const headGeometry = new SphereGeometry(HEAD, 20, 14);
  const stalkGeometry = new CylinderGeometry(0.011, 0.011, 1, 6);
  stalkGeometry.translate(0, 0.5, 0);
  stalkGeometry.rotateX(Math.PI / 2);
  const ringTexture = softTexture({ ring: true });

  const findings: FindingView[] = [];
  const byChromosome = new Map<string, GenomeFinding[]>();
  for (const finding of options.findings) {
    if (!chromosomes.has(finding.chromosome)) continue;
    byChromosome.set(finding.chromosome, [...(byChromosome.get(finding.chromosome) ?? []), finding]);
  }

  for (const [name, list] of byChromosome) {
    const view = chromosomes.get(name)!;
    const sorted = [...list].sort((a, b) => a.position - b.position);
    // Group loci that sit on the same spot at this scale.
    const clusters: GenomeFinding[][] = [];
    for (const finding of sorted) {
      const last = clusters.at(-1);
      const y = (view.chromosome.centromere - finding.position) * SCALE;
      if (last && Math.abs((view.chromosome.centromere - last[0].position) * SCALE - y) < CLUSTER) last.push(finding);
      else clusters.push([finding]);
    }

    for (const cluster of clusters) {
      const y = (view.chromosome.centromere - cluster[0].position) * SCALE;
      const ring = new Mesh(
        new TorusGeometry(RADIUS * 1.04, 0.014, 8, 48),
        new MeshStandardMaterial({ color: RING, roughness: 0.4, transparent: true }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      view.group.add(ring);

      cluster.forEach((finding, index) => {
        // Out toward the reader and leaning to one side (upward once the chromosome is
        // laid down in locus mode). Variants sharing a locus fan along the chromosome.
        const lean = STALK_LEAN[options.mode];
        // Sorted by position, so the first sits nearest the p end, which is +y.
        const elevation = ((cluster.length - 1) / 2 - index) * FAN;
        const direction = new Vector3(
          Math.sin(lean) * Math.cos(elevation),
          Math.sin(elevation),
          Math.cos(lean) * Math.cos(elevation),
        );
        const length = STALK_LENGTH[options.mode];
        const colour = new Color(SIGNALS[finding.signal].color);

        const stalk = new Mesh(
          stalkGeometry,
          new MeshBasicMaterial({ color: "#B98E99", transparent: true }),
        );
        stalk.position.copy(direction).multiplyScalar(RADIUS);
        stalk.position.y += y;
        stalk.lookAt(stalk.position.clone().add(direction));
        stalk.scale.set(1, 1, length);

        const head = new Mesh(
          headGeometry,
          new MeshStandardMaterial({
            color: colour,
            emissive: colour,
            emissiveIntensity: finding.signal === "quiet" ? 0.08 : 0.3,
            roughness: 0.3,
            transparent: true,
          }),
        );
        head.position.copy(direction).multiplyScalar(RADIUS + length);
        head.position.y += y;

        const halo = new Sprite(
          new SpriteMaterial({ map: ringTexture, color: colour, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
        );
        halo.renderOrder = 10;
        halo.position.copy(head.position);
        halo.visible = false;

        view.group.add(stalk, head, halo);
        findings.push({
          finding,
          chromosome: view,
          head,
          stalk,
          halo,
          ring: index === 0 ? ring : null,
          y,
          shown: 1,
          emphasis: 0,
        });
      });
    }
  }

  /* -- Layout -- */

  let compact = false;

  const layout = () => {
    if (locus) {
      const only = [...chromosomes.values()][0];
      if (only) {
        // Centre the chromosome's length on the origin before it is laid down.
        const { length, centromere } = only.chromosome;
        only.group.position.y = (length / 2 - centromere) * SCALE;
      }
      return;
    }
    const row = [...chromosomes.values()].filter((c) => !compact || c.carrier);
    const middle = (row.length - 1) / 2;
    const spacing = compact ? SPACING * 1.25 : SPACING;
    for (const view of chromosomes.values()) view.group.visible = false;
    row.forEach((view, index) => {
      const x = (index - middle) * spacing;
      view.group.visible = true;
      view.group.position.set(x, 0, -(x * x) / (2 * ARC));
      // Each chromosome turns to face the middle of the arc.
      view.group.rotation.y = -Math.atan2(x, ARC);
    });
  };

  /* -- Framing -- */

  let framed = false;

  const frame = (width: number, height: number) => {
    const nextCompact = !locus && width < COMPACT_BELOW;
    if (nextCompact !== compact || !framed) {
      compact = nextCompact;
      layout();
    }
    framed = true;

    const aspect = width / height;
    const tan = Math.tan((FOV * Math.PI) / 360);
    // Frame the rest pose, then give back the reader's turn and tilt.
    const pose = root.rotation.clone();
    root.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);

    // Frame every visible chromosome end, head and label anchor.
    const corners: Vector3[] = [];
    const p = new Vector3();
    for (const view of chromosomes.values()) {
      if (!view.group.visible) continue;
      const { length, centromere } = view.chromosome;
      for (const y of [centromere * SCALE + RADIUS, -(length - centromere) * SCALE - RADIUS - (locus ? 0 : 0.34)]) {
        for (const x of [-RADIUS * 1.2, RADIUS * 1.2]) corners.push(p.set(x, y, 0).applyMatrix4(view.group.matrixWorld).clone());
      }
    }
    for (const view of findings) {
      if (!view.head.parent?.visible) continue;
      const head = view.head.getWorldPosition(p).clone();
      corners.push(head);
      // Room above each marker for its halo, and in locus mode for the band tag.
      corners.push(head.clone().add(new Vector3(0, locus ? 0.32 : 0.12, 0)));
    }

    const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const c of corners) {
      box.minX = Math.min(box.minX, c.x);
      box.maxX = Math.max(box.maxX, c.x);
      box.minY = Math.min(box.minY, c.y);
      box.maxY = Math.max(box.maxY, c.y);
    }
    const centre = new Vector3((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, 0);
    figure.position.x -= centre.x;
    figure.position.y -= centre.y;
    root.updateMatrixWorld(true);

    const fill = locus ? 0.8 : 0.92;
    let distance = 0;
    for (const c of corners) {
      const x = c.x - centre.x;
      const y = c.y - centre.y;
      distance = Math.max(distance, c.z + Math.abs(x) / (fill * tan * aspect), c.z + Math.abs(y) / (fill * tan));
    }
    camera.position.set(0, locus ? 0.3 : 0.6, distance);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(0.1, distance - 10);
    camera.far = distance + 30;
    camera.updateProjectionMatrix();
    (scene.fog as Fog).near = distance;
    (scene.fog as Fog).far = distance + 9;
    root.rotation.copy(pose);
    root.updateMatrixWorld(true);
  };

  /* -- Interaction -- */

  let visible: ReadonlySet<string> | null = null;
  let activeKey: string | null = locus ? options.focusKey : null;
  let yaw = 0;
  let pitch = 0;
  let hovering = false;
  const pointer = { x: 0, y: 0 };
  let dragging = false;

  const detachPointer = attachPointer(interactive, {
    hover(x, y) {
      pointer.x = x;
      pointer.y = y;
      hovering = true;
      stage.invalidate();
    },
    leave() {
      hovering = false;
      pointer.x = 0;
      pointer.y = 0;
      stage.invalidate();
    },
    drag(dx, dy) {
      const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
      yaw = clamp(yaw + (dx / Math.max(stage.width, 1)) * 2.2, YAW_LIMIT);
      pitch = clamp(pitch + (dy / Math.max(stage.height, 1)) * 1.2, PITCH_LIMIT);
      stage.invalidate();
    },
    dragChange(next) {
      dragging = next;
      options.onDragChange(next);
      stage.invalidate();
    },
  });

  /* -- Loop -- */

  const world = new Vector3();
  const white = new Color("#FFFFFF");
  const carrierColour = new Color(CARRIER);
  const shownOn = new Set<string>();
  const camSpace = new Vector3();
  const axisSpace = new Vector3();
  let ready = false;
  let swayTime = 0;

  stage.run({
    resize: frame,
    update(delta) {
      const still = stage.reducedMotion;
      let moved = dragging;

      // Pose: the reader's drag, a pointer tilt and, at rest, a slow sway.
      if (!still && !dragging && !hovering) swayTime += delta;
      const sway = still ? 0 : Math.sin(swayTime * 0.35) * SWAY;
      const targetYaw = yaw + (still ? 0 : pointer.x * 0.08) + sway;
      const targetPitch = pitch + (still ? 0 : pointer.y * 0.05) + (locus ? 0 : 0.06);
      const nextYaw = still ? targetYaw : approach(root.rotation.y, targetYaw, 5, delta);
      const nextPitch = still ? targetPitch : approach(root.rotation.x, targetPitch, 5, delta);
      if (Math.abs(nextYaw - root.rotation.y) > 1e-4 || Math.abs(nextPitch - root.rotation.x) > 1e-4) moved = true;
      if (!still && !hovering && !dragging) moved = true;
      root.rotation.y = nextYaw;
      root.rotation.x = nextPitch;

      // Chromosomes holding a shown variant take a blush tint, the active one most.
      shownOn.clear();
      for (const view of findings) {
        if (!visible || visible.has(view.finding.key)) shownOn.add(view.finding.chromosome);
      }
      const activeChromosome = findings.find((f) => f.finding.key === activeKey)?.finding.chromosome;
      for (const view of chromosomes.values()) {
        const name = view.chromosome.name;
        const target = locus ? 0.4 : name === activeChromosome ? 1 : shownOn.has(name) ? 0.55 : 0;
        const next = still ? target : approach(view.tint, target, 8, delta);
        if (Math.abs(next - view.tint) > 1e-3) moved = true;
        view.tint = next;
        view.material.color.copy(white).lerp(carrierColour, view.tint);
      }

      for (const view of findings) {
        const shown = !visible || visible.has(view.finding.key) ? 1 : 0;
        const active = view.finding.key === activeKey ? 1 : 0;
        const nextShown = still ? shown : approach(view.shown, shown, 9, delta);
        const nextEmphasis = still ? active : approach(view.emphasis, active, 10, delta);
        if (Math.abs(nextShown - view.shown) > 1e-3 || Math.abs(nextEmphasis - view.emphasis) > 1e-3) moved = true;
        view.shown = nextShown;
        view.emphasis = nextEmphasis;

        view.head.scale.setScalar((0.5 + 0.5 * view.shown) * (1 + 0.65 * view.emphasis) * (locus && active ? 1.25 : 1));
        view.head.material.opacity = 0.18 + 0.82 * view.shown;
        view.stalk.material.opacity = 0.15 + 0.85 * view.shown;
        if (view.ring) view.ring.material.opacity = 0.2 + 0.8 * view.shown;

        view.halo.visible = view.emphasis > 0.02;
        view.halo.scale.setScalar(HEAD * 6);
        view.halo.material.opacity = 0.6 * view.emphasis;
      }
      return moved;
    },
    afterRender() {
      const inverse = camera.matrixWorldInverse;
      const points = findings.map((view) => {
        view.head.getWorldPosition(world);
        camSpace.copy(world).applyMatrix4(inverse);
        // The axis at the marker's own locus: a tilted chromosome's ends sit at other depths.
        axisSpace.set(0, view.y, 0).applyMatrix4(view.chromosome.group.matrixWorld).applyMatrix4(inverse);
        const { x, y } = toScreen(stage, world);
        return {
          key: view.finding.key,
          x,
          y,
          front: camSpace.z > axisSpace.z - RADIUS,
          shown: view.chromosome.group.visible && (!visible || visible.has(view.finding.key)),
        };
      });
      const labels: GenomeLabel[] = locus
        ? armLabels.map((arm) => {
            const { x, y } = toScreen(stage, arm.group.localToWorld(world.copy(arm.at)));
            return { id: arm.id, text: arm.text, x, y, shown: true, carrier: false };
          })
        : [...chromosomes.values()].map((view) => {
            const { x, y } = toScreen(stage, view.group.localToWorld(world.copy(view.label)));
            return {
              id: view.chromosome.name,
              text: view.chromosome.name,
              x,
              y,
              shown: view.group.visible,
              carrier: view.carrier,
            };
          });
      options.onProject(points, labels);
      if (!ready) {
        ready = true;
        options.onReady();
      }
    },
  });

  return {
    setVisible(keys) {
      visible = keys;
      stage.invalidate();
    },
    setActive(key) {
      activeKey = key ?? (locus ? options.focusKey : null);
      stage.invalidate();
    },
    dispose() {
      detachPointer();
      ringTexture.dispose();
      stage.dispose();
    },
  };
}

