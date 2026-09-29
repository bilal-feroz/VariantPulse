/**
 * The evidence helix on the home page.
 *
 * A B-form double helix built from primitives: two backbones, a bead at every
 * nucleotide and a split rung for every base pair. The proportions are the
 * real ones (a turn every 10.5 base pairs, a rise of 0.34 against a radius of
 * 1, and the two backbones 150 degrees apart, which is what opens the major and
 * minor grooves), so it reads as DNA rather than as a twisted ladder.
 *
 * Each monitored finding is one nucleotide on the leading strand, in genome
 * order along the helix, coloured by what happened to its evidence (see
 * `lib/signal`), with its base pair tinted to match. The positions
 * are illustrative, not to scale: fifteen findings on six chromosomes cannot
 * sit on one short stretch of DNA, and the page says so.
 *
 * Interaction:
 * - dragging turns the helix about its own axis, with inertia;
 * - the pointer tilts the whole form slightly (parallax);
 * - an active finding (hovered or focused) swells and rings, and focusing one
 *   turns the helix until that nucleotide faces the reader;
 * - while an evidence sync runs, a ring scans along the axis and each finding
 *   pings as the scan passes it.
 *
 * Reduced motion: no idle spin, parallax, drift or pulsing; a focused finding
 * is brought round in one step. Dragging still works, since the reader is
 * moving it themselves.
 */

import {
  CapsuleGeometry,
  CircleGeometry,
  Color,
  Curve,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  BufferAttribute,
  BufferGeometry,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { SIGNALS, type Signal } from "@/lib/signal";

import { approach, attachPointer, createStage, softTexture, toScreen } from "./stage";

/* -- Geometry: B-DNA proportions ------------------------------------------ */

const RADIUS = 1;
const RISE = 0.34;
const TWIST = (Math.PI * 2) / 10.5;
/** Angle from strand A to strand B across one base pair: the minor groove. */
const GROOVE = (150 / 180) * Math.PI;
const PAIRS = 30;
const LENGTH = (PAIRS - 1) * RISE;
const TUBE = 0.085;
const BEAD = 0.14;
const BASE = 0.066;
/** Space left between the two halves of a pair, where the hydrogen bonds would be. */
const GAP = 0.045;
/** A finding's nucleotide, drawn larger than its neighbours. */
const NODE = 0.19;
/** The first and last base pair a finding may take, clear of the faded ends. */
const FIRST_FINDING = 3;
const LAST_FINDING = PAIRS - 4;

/* -- Composition ----------------------------------------------------------- */

/** Clockwise lean of the axis from vertical, so it rises gently to the right. */
const LEAN = (62 / 180) * Math.PI;
/** Tips the upper end away, so the rungs are seen slightly from above. */
const TIP = 0.32;
const FOV = 26;
/** How much of the view the helix may fill, edge to edge. */
const FILL = 1.08;

/* -- Motion ---------------------------------------------------------------- */

/** One turn every 40 seconds. */
const SPIN = (Math.PI * 2) / 40;
const PARALLAX_YAW = 0.16;
const PARALLAX_PITCH = 0.1;
/** How quickly a released drag coasts to a stop. */
const FRICTION = 2.6;
const SCAN_SECONDS = 1.7;
const LEAD_PERIOD = 2.8;
const PULSE_SECONDS = 1.1;

/* -- Colour ---------------------------------------------------------------- */

const GARNET = "#7A263A";
const ROSE = "#A24A60";
const PORCELAIN = "#F2E8DD";
const BLUSH = "#E8C3CC";
const BONE = "#F7F4ED";
const VERMILION = "#E85D4A";

export interface HelixFinding {
  key: string;
  signal: Signal;
}

export interface HelixPoint {
  key: string;
  /** CSS pixels from the stage's top left. */
  x: number;
  y: number;
  /** False while the nucleotide is round the back of the helix, where it cannot be picked. */
  front: boolean;
}

export interface HelixOptions {
  /** Already in genome order. */
  findings: HelixFinding[];
  leadKey: string | null;
  /** Receives every finding's screen position after each drawn frame. */
  onProject(points: HelixPoint[]): void;
  onReady(): void;
  onLost(): void;
  onDragChange(dragging: boolean): void;
}

export interface HelixController {
  setFindings(findings: HelixFinding[], leadKey: string | null): void;
  /** `face` turns the helix until the pair faces the reader (keyboard focus). */
  setActive(key: string | null, face: boolean): void;
  setScanning(scanning: boolean): void;
  dispose(): void;
}

class StrandCurve extends Curve<Vector3> {
  private readonly phase: number;

  constructor(phase: number) {
    super();
    this.phase = phase;
  }

  getPoint(t: number, target = new Vector3()): Vector3 {
    const pair = t * (PAIRS - 1);
    return strandPoint(pair, this.phase, target);
  }
}

function strandPoint(pair: number, phase: number, target = new Vector3()): Vector3 {
  const angle = pair * TWIST + phase;
  return target.set(RADIUS * Math.sin(angle), -LENGTH / 2 + pair * RISE, RADIUS * Math.cos(angle));
}

/** Spreads the findings evenly over the pairs between the faded ends. */
export function findingPairs(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round((FIRST_FINDING + LAST_FINDING) / 2)];
  const step = (LAST_FINDING - FIRST_FINDING) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(FIRST_FINDING + i * step));
}

interface FindingView {
  key: string;
  signal: Signal;
  pair: number;
  node: Mesh<SphereGeometry, MeshStandardMaterial>;
  halo: Sprite;
  /** 0…1, eased toward whether the finding is active. */
  emphasis: number;
  /** Seconds since the last ping (negative while one is scheduled), or Infinity. */
  since: number;
  /** The scan sweep that last pinged this finding. */
  swept: number;
}

export function mountHelix(stageHost: HTMLElement, interactive: HTMLElement, options: HelixOptions): HelixController {
  const stage = createStage(stageHost, { fov: FOV, onLost: options.onLost });
  const { scene, camera } = stage;

  scene.fog = new Fog(BONE, 10, 30);
  scene.environmentIntensity = 0.5;

  scene.add(new HemisphereLight("#FFF9F2", "#E6D6CD", 0.9));
  const key = new DirectionalLight("#FFF1E4", 1.9);
  key.position.set(-5, 7, 9);
  scene.add(key);
  const rim = new DirectionalLight("#F3B6C3", 1.3);
  rim.position.set(6, -3, -7);
  scene.add(rim);

  // root: parallax · lean: diagonal on screen · tip: seen from above · spin: about the axis
  const root = new Group();
  const lean = new Group();
  lean.rotation.z = -LEAN;
  const tip = new Group();
  tip.rotation.x = TIP;
  const spin = new Group();
  root.add(lean);
  lean.add(tip);
  tip.add(spin);
  scene.add(root);

  /* -- Backbones and nucleotides -- */

  const strandMaterial = (color: string) =>
    new MeshPhysicalMaterial({
      color,
      roughness: 0.36,
      clearcoat: 0.85,
      clearcoatRoughness: 0.3,
      sheen: 0.6,
      sheenColor: new Color("#F4CDD5"),
      sheenRoughness: 0.55,
    });
  const strandA = strandMaterial(GARNET);
  const strandB = strandMaterial(ROSE);

  spin.add(new Mesh(new TubeGeometry(new StrandCurve(0), PAIRS * 14, TUBE, 14, false), strandA));
  spin.add(new Mesh(new TubeGeometry(new StrandCurve(GROOVE), PAIRS * 14, TUBE, 14, false), strandB));

  const beadGeometry = new SphereGeometry(BEAD, 20, 14);
  const beadsA = new InstancedMesh(beadGeometry, strandA, PAIRS);
  const beadsB = new InstancedMesh(beadGeometry.clone(), strandB, PAIRS);

  const halfLength = strandPoint(0, 0).distanceTo(strandPoint(0, GROOVE)) / 2;
  const capsule = halfLength - GAP - BASE * 2;
  const baseMaterial = new MeshPhysicalMaterial({
    color: "#FFFFFF",
    roughness: 0.46,
    clearcoat: 0.5,
    clearcoatRoughness: 0.4,
  });
  const bases = new InstancedMesh(new CapsuleGeometry(BASE, capsule, 6, 12), baseMaterial, PAIRS * 2);

  const a = new Vector3();
  const b = new Vector3();
  const mid = new Vector3();
  const direction = new Vector3();
  const centre = new Vector3();
  const up = new Vector3(0, 1, 0);
  const rotation = new Quaternion();
  const unit = new Vector3(1, 1, 1);
  const matrix = new Matrix4();
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const leading: Vector3[] = [];

  for (let pair = 0; pair < PAIRS; pair += 1) {
    strandPoint(pair, 0, a);
    strandPoint(pair, GROOVE, b);
    beadsA.setMatrixAt(pair, matrix.makeTranslation(a.x, a.y, a.z));
    beadsB.setMatrixAt(pair, matrix.makeTranslation(b.x, b.y, b.z));

    leading.push(a.clone());
    mid.addVectors(a, b).multiplyScalar(0.5);

    // Each half runs from its backbone to just short of the middle.
    for (const [index, from, sign] of [
      [pair * 2, a, 1],
      [pair * 2 + 1, b, -1],
    ] as const) {
      direction.subVectors(b, a).normalize().multiplyScalar(sign);
      const end = mid.clone().addScaledVector(direction, -GAP);
      centre.addVectors(from, end).multiplyScalar(0.5);
      rotation.setFromUnitVectors(up, direction);
      bases.setMatrixAt(index, matrix.compose(centre, rotation, unit));
    }
  }
  spin.add(beadsA, beadsB, bases);

  /* -- Findings -- */

  const nodeGeometry = new SphereGeometry(NODE, 24, 16);
  const ringTexture = softTexture({ ring: true });
  let findings: FindingView[] = [];
  let leadKey: string | null = null;
  let activeKey: string | null = null;

  const porcelain = new Color(PORCELAIN);
  const blush = new Color(BLUSH);
  const tint = new Color();

  const signalColour = new Color();

  /** Tints each finding's base pair toward its signal and hands its nucleotide to the finding. */
  const paintBases = () => {
    const byPair = new Map(findings.map((f) => [f.pair, f]));
    for (let pair = 0; pair < PAIRS; pair += 1) {
      const finding = byPair.get(pair);
      if (finding) {
        signalColour.set(SIGNALS[finding.signal].color);
        bases.setColorAt(pair * 2, tint.copy(porcelain).lerp(signalColour, 0.6));
        bases.setColorAt(pair * 2 + 1, tint.copy(blush).lerp(signalColour, 0.3));
        beadsA.setMatrixAt(pair, hidden);
      } else {
        bases.setColorAt(pair * 2, porcelain);
        bases.setColorAt(pair * 2 + 1, blush);
        const at = leading[pair];
        beadsA.setMatrixAt(pair, matrix.makeTranslation(at.x, at.y, at.z));
      }
    }
    if (bases.instanceColor) bases.instanceColor.needsUpdate = true;
    beadsA.instanceMatrix.needsUpdate = true;
  };

  const buildFindings = (list: HelixFinding[]) => {
    for (const finding of findings) {
      spin.remove(finding.node, finding.halo);
      finding.node.material.dispose();
      finding.halo.material.dispose();
    }
    const pairs = findingPairs(list.length);
    findings = list.map((finding, index) => {
      const color = new Color(SIGNALS[finding.signal].color);
      const node = new Mesh(
        nodeGeometry,
        new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: finding.signal === "quiet" ? 0.05 : 0.32,
          roughness: 0.28,
        }),
      );
      node.position.copy(leading[pairs[index]]);
      const halo = new Sprite(
        new SpriteMaterial({
          map: ringTexture,
          color,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        }),
      );
      halo.renderOrder = 10;
      halo.position.copy(node.position);
      halo.visible = false;
      spin.add(node, halo);
      return { ...finding, pair: pairs[index], node, halo, emphasis: 0, since: Infinity, swept: -1 };
    });
    paintBases();
  };

  /* -- Scan ring, shown while an evidence sync runs -- */

  const scan = new Group();
  const scanRing = new Mesh(
    new TorusGeometry(RADIUS + 0.42, 0.014, 8, 128),
    new MeshBasicMaterial({ color: "#B55A70", transparent: true, opacity: 0, depthWrite: false }),
  );
  const scanGlow = new Mesh(
    new CircleGeometry(RADIUS + 0.9, 64),
    new MeshBasicMaterial({
      map: softTexture(),
      color: "#E8B4C0",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  scanRing.rotation.x = Math.PI / 2;
  scanGlow.rotation.x = Math.PI / 2;
  scan.add(scanGlow, scanRing);
  // In the tip frame, so it slides along the axis without turning.
  tip.add(scan);

  /* -- Dust, as on the illustrated hero -- */

  const DUST = 70;
  const dustPositions = new Float32Array(DUST * 3);
  const dustColors = new Float32Array(DUST * 3);
  const dustSeeds: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
  const vermilion = new Color(VERMILION);
  const rose = new Color("#C98C9C");
  let seed = 7;
  const random = () => {
    // Deterministic, so the dust never jumps between mounts.
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < DUST; i += 1) {
    dustSeeds.push({
      x: (random() - 0.5) * 14,
      y: (random() - 0.5) * 8,
      z: (random() - 0.5) * 6 - 1,
      phase: random() * Math.PI * 2,
      speed: 0.2 + random() * 0.35,
    });
    (random() > 0.35 ? vermilion : rose).toArray(dustColors, i * 3);
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new BufferAttribute(dustColors, 3));
  const dust = new Points(
    dustGeometry,
    new PointsMaterial({
      // Attenuated point size is in world units per unit of depth: about 4 px here.
      size: 1.1,
      map: softTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  root.add(dust);

  const placeDust = (time: number) => {
    for (let i = 0; i < DUST; i += 1) {
      const s = dustSeeds[i];
      dustPositions[i * 3] = s.x + Math.sin(time * s.speed * 0.6 + s.phase) * 0.25;
      dustPositions[i * 3 + 1] = s.y + Math.sin(time * s.speed + s.phase) * 0.35;
      dustPositions[i * 3 + 2] = s.z;
    }
    dustGeometry.attributes.position.needsUpdate = true;
  };
  placeDust(0);

  /* -- Framing -- */

  // The helix never leaves its bounding cylinder as it turns, so framing that
  // cylinder, leaned and tipped as it is on screen, frames every pose.
  const envelope: Vector3[] = [];
  for (const y of [-LENGTH / 2 - BEAD, LENGTH / 2 + BEAD]) {
    for (let k = 0; k < 24; k += 1) {
      const angle = (k / 24) * Math.PI * 2;
      envelope.push(new Vector3(Math.sin(angle) * (RADIUS + BEAD), y, Math.cos(angle) * (RADIUS + BEAD)));
    }
  }
  let pixelsPerUnit = 1;

  const frame = (width: number, height: number) => {
    const aspect = width / height;
    const tan = Math.tan((FOV * Math.PI) / 360);
    // Frame the rest pose, then give back whatever tilt the pointer had given it.
    const pose = root.rotation.clone();
    root.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);
    let distance = 0;
    const point = new Vector3();
    for (const corner of envelope) {
      point.copy(corner).applyMatrix4(tip.matrixWorld);
      // Solves |p| / (d - p.z) = FILL · tan (· aspect) for d, per axis.
      distance = Math.max(
        distance,
        point.z + Math.abs(point.x) / (FILL * tan * aspect),
        point.z + Math.abs(point.y) / (FILL * tan),
      );
    }
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(0.1, distance - 12);
    camera.far = distance + 20;
    camera.updateProjectionMatrix();
    // Far strands fade toward the page colour, as they do on the illustration.
    (scene.fog as Fog).near = distance - 0.5;
    (scene.fog as Fog).far = distance + 5.5;
    pixelsPerUnit = height / (2 * distance * tan);
    root.rotation.copy(pose);
    root.updateMatrixWorld(true);
  };

  /* -- Interaction -- */

  let angle = 0;
  let velocity = 0;
  let target: number | null = null;
  let scanning = false;
  let scanTime = 0;
  let scanFade = 0;
  let hovering = false;
  const pointer = { x: 0, y: 0 };
  let dragging = false;

  // Screen direction in which the near surface moves as the angle grows.
  const surfaceX = Math.cos(LEAN);
  const surfaceY = Math.sin(LEAN);

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
    drag(dx, dy, seconds) {
      // The near surface follows the pointer: the drag's component across the axis, in radians.
      const step = (dx * surfaceX + dy * surfaceY) / (RADIUS * pixelsPerUnit);
      angle += step;
      velocity = step / seconds;
      stage.invalidate();
    },
    dragChange(next, rested) {
      dragging = next;
      if (next) target = null;
      // Let go after holding still: the helix stays where it was put.
      else if (rested) velocity = 0;
      options.onDragChange(next);
      stage.invalidate();
    },
  });

  /* -- Loop -- */

  const world = new Vector3();
  const near = new Vector3();
  const axis = new Vector3();
  let ready = false;

  const faceAngle = (pair: number) => {
    // Brings the pair's leading nucleotide round to +z, toward the reader.
    const facing = -(pair * TWIST);
    const turns = Math.round((angle - facing) / (Math.PI * 2));
    return facing + turns * Math.PI * 2;
  };

  buildFindings(options.findings);
  leadKey = options.leadKey;
  const lead = findings.find((f) => f.key === leadKey);
  // Open on the lead finding, facing the reader.
  angle = lead ? faceAngle(lead.pair) + 0.5 : 0;

  stage.run({
    resize: frame,
    update(delta, time) {
      const still = stage.reducedMotion;
      let moved = false;

      // Turning.
      if (target !== null) {
        const next = still ? target : approach(angle, target, 5, delta);
        moved ||= Math.abs(next - angle) > 1e-4;
        angle = next;
        if (Math.abs(angle - target) < 1e-3) angle = target;
      } else if (!dragging) {
        if (Math.abs(velocity) > 1e-3) {
          angle += velocity * delta;
          velocity *= Math.exp(-FRICTION * delta);
          moved = true;
        } else {
          velocity = 0;
        }
        if (!still && activeKey === null) {
          angle += SPIN * (hovering ? 0.35 : 1) * delta;
          moved = true;
        }
      } else {
        moved = true;
      }
      spin.rotation.y = angle;

      // Parallax.
      const yaw = still ? 0 : pointer.x * PARALLAX_YAW;
      const pitch = still ? 0 : pointer.y * PARALLAX_PITCH;
      const nextYaw = approach(root.rotation.y, yaw, 4, delta);
      const nextPitch = approach(root.rotation.x, pitch, 4, delta);
      moved ||= Math.abs(nextYaw - root.rotation.y) > 1e-4 || Math.abs(nextPitch - root.rotation.x) > 1e-4;
      root.rotation.y = nextYaw;
      root.rotation.x = nextPitch;

      // Dust.
      if (!still) {
        placeDust(time);
        moved = true;
      }

      // Scan.
      const fadeTo = scanning ? 1 : 0;
      const nextFade = approach(scanFade, fadeTo, 6, delta);
      if (Math.abs(nextFade - scanFade) > 1e-3 || scanning) moved = true;
      scanFade = nextFade;
      if (scanFade > 0.01) {
        scanTime += still ? 0 : delta;
        const sweep = Math.floor(scanTime / SCAN_SECONDS);
        const y = -LENGTH / 2 - 0.6 + ((scanTime % SCAN_SECONDS) / SCAN_SECONDS) * (LENGTH + 1.2);
        scan.position.y = still ? 0 : y;
        scanRing.material.opacity = 0.75 * scanFade;
        scanGlow.material.opacity = 0.32 * scanFade;
        // Ping each finding once per sweep, the moment the ring reaches it.
        if (scanning && !still) {
          for (const finding of findings) {
            if (finding.swept !== sweep && y >= leading[finding.pair].y) {
              finding.swept = sweep;
              finding.since = 0;
            }
          }
        }
      } else {
        scanRing.material.opacity = 0;
        scanGlow.material.opacity = 0;
      }
      scan.visible = scanFade > 0.01;

      // Findings.
      for (const finding of findings) {
        const active = finding.key === activeKey;
        const nextEmphasis = still ? (active ? 1 : 0) : approach(finding.emphasis, active ? 1 : 0, 10, delta);
        if (Math.abs(nextEmphasis - finding.emphasis) > 1e-3) moved = true;
        finding.emphasis = nextEmphasis;

        finding.since += delta;
        const ping = finding.since >= 0 && finding.since < PULSE_SECONDS ? finding.since / PULSE_SECONDS : null;
        // A scheduled ping keeps the loop awake until it has played.
        if (finding.since < PULSE_SECONDS) moved = true;

        const bump = ping === null || still ? 0 : Math.sin(ping * Math.PI) * 0.45;
        finding.node.scale.setScalar(1 + finding.emphasis * 0.7 + bump);

        const material = finding.halo.material;
        if (ping !== null && !still) {
          finding.halo.visible = true;
          finding.halo.scale.setScalar(NODE * (3 + 9 * ping));
          material.opacity = 0.7 * Math.pow(1 - ping, 1.6);
        } else if (finding.emphasis > 0.02) {
          finding.halo.visible = true;
          finding.halo.scale.setScalar(NODE * 5.4);
          material.opacity = 0.62 * finding.emphasis;
        } else if (finding.key === leadKey) {
          finding.halo.visible = true;
          if (still) {
            finding.halo.scale.setScalar(NODE * 5);
            material.opacity = 0.35;
          } else {
            const phase = (time % LEAD_PERIOD) / LEAD_PERIOD;
            finding.halo.scale.setScalar(NODE * (3 + 8 * phase));
            material.opacity = 0.55 * Math.pow(1 - phase, 1.8);
            moved = true;
          }
        } else {
          finding.halo.visible = false;
        }
      }

      return moved;
    },
    afterRender() {
      options.onProject(
        findings.map((finding) => {
          finding.node.getWorldPosition(world);
          // Compare depth with the axis at the same height: nearer than it is the front half.
          axis.set(0, finding.node.position.y, 0).applyMatrix4(spin.matrixWorld);
          const front =
            near.copy(world).applyMatrix4(camera.matrixWorldInverse).z >
            axis.applyMatrix4(camera.matrixWorldInverse).z - RADIUS * 0.25;
          const { x, y } = toScreen(stage, world);
          return { key: finding.key, x, y, front };
        }),
      );
      if (!ready) {
        ready = true;
        options.onReady();
      }
    },
  });

  return {
    setFindings(list, nextLead) {
      // A resync usually returns the same findings; rebuilding them would cut short any ping in flight.
      const same =
        list.length === findings.length &&
        list.every((finding, index) => finding.key === findings[index].key && finding.signal === findings[index].signal);
      if (!same) buildFindings(list);
      leadKey = nextLead;
      stage.invalidate();
    },
    setActive(key, face) {
      activeKey = key;
      const finding = findings.find((f) => f.key === key);
      target = finding && face ? faceAngle(finding.pair) : null;
      if (target !== null) velocity = 0;
      stage.invalidate();
    },
    setScanning(next) {
      if (next === scanning) return;
      scanning = next;
      if (next) {
        scanTime = 0;
        for (const finding of findings) finding.swept = -1;
      } else {
        // The sync is over: every finding with something to review pings once, in order.
        findings.forEach((finding, index) => {
          if (finding.signal !== "quiet") finding.since = -index * 0.07;
        });
      }
      stage.invalidate();
    },
    dispose() {
      detachPointer();
      ringTexture.dispose();
      stage.dispose();
    },
  };
}
