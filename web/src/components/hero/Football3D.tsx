import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// The site's palette: near-black green bodies, lime details, off-white highlights.
const INK = new Color("#172010");
const LIME = new Color("#a8e23a");
// GK Lagbe's dark amber, for the keeper's glove strap and the cone.
const AMBER = new Color("#d4861f");
const CHALK = new Color("#e9eee2");

/** How much bigger the canvas is than the box it's centred on, so floating pieces never hit its edge. */
const BLEED = 1.5;

/** Every geometry and material made here, so unmount can free them all. */
type Bin = { geometries: BufferGeometry[]; materials: Material[] };

/**
 * A real football shape: the truncated icosahedron (12 pentagons, 20 hexagons).
 * Its 60 corners are the even permutations of (0, ±1, ±3φ), (±1, ±(2+φ), ±2φ)
 * and (±φ, ±2, ±φ³). Returns the hull split into pentagon and hexagon faces.
 */
function footballGeometries() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const seen = new Set<string>();
  const points: Vector3[] = [];
  for (const [a, b, c] of [
    [0, 1, 3 * phi],
    [1, 2 + phi, 2 * phi],
    [phi, 2, phi ** 3],
  ]) {
    for (const [x, y, z] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]) {
      for (const sx of [1, -1])
        for (const sy of [1, -1])
          for (const sz of [1, -1]) {
            const v = new Vector3(sx * x, sy * y, sz * z);
            const key = v.toArray().map((n) => n.toFixed(4)).join(",");
            if (!seen.has(key)) {
              seen.add(key);
              points.push(v);
            }
          }
    }
  }
  const radius = Math.sqrt(9 * phi + 10);
  const hull = new ConvexGeometry(points.map((p) => p.divideScalar(radius)));

  // Pentagons sit exactly under the 12 corners of the icosahedron the ball was
  // cut from: (0, ±1, ±φ) and its cyclic turns.
  const pentagons: Vector3[] = [];
  for (const [x, y, z] of [
    [0, 1, phi],
    [1, phi, 0],
    [phi, 0, 1],
  ]) {
    for (const sy of [1, -1]) for (const sz of [1, -1]) pentagons.push(new Vector3(x, y * sy, z * sz).normalize());
  }

  const position = hull.getAttribute("position");
  const pent: number[] = [];
  const hex: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t < position.count / 3; t++) {
    a.fromBufferAttribute(position, t * 3);
    b.fromBufferAttribute(position, t * 3 + 1);
    c.fromBufferAttribute(position, t * 3 + 2);
    const normal = new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
    const target = pentagons.some((p) => Math.abs(p.dot(normal)) > 0.999) ? pent : hex;
    target.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  }
  const toGeometry = (values: number[]) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(values, 3));
    g.computeVertexNormals();
    return g;
  };
  return { hull, pentagon: toGeometry(pent), hexagon: toGeometry(hex) };
}

// A soft round shadow drawn once onto a canvas.
function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0,0,0,0.7)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

// yaw: the angle it faces (three-quarter views read best); it sways around that.
type KitPiece = { object: Object3D; home: Vector3; bob: number; yaw: number; scale: number };

/** The miniature futsal kit that floats around the ball, built from primitives. */
function makeKit(bin: Bin): KitPiece[] {
  const keep = <T extends BufferGeometry>(g: T) => {
    bin.geometries.push(g);
    return g;
  };
  const ink = new MeshLambertMaterial({ color: INK, flatShading: true });
  const lime = new MeshLambertMaterial({ color: LIME, flatShading: true });
  const amber = new MeshLambertMaterial({ color: AMBER, flatShading: true });
  const chalk = new MeshLambertMaterial({ color: CHALK, flatShading: true });
  const limeLine = new LineBasicMaterial({ color: LIME, transparent: true, opacity: 0.85 });
  const chalkLine = new LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.35 });
  bin.materials.push(ink, lime, amber, chalk, limeLine, chalkLine);

  // A solid part, optionally outlined so dark shapes still read on a dark page.
  const part = (geometry: BufferGeometry, material: Material, line: LineBasicMaterial | null = limeLine) => {
    const mesh = new Mesh(keep(geometry), material);
    if (line) mesh.add(new LineSegments(keep(new EdgesGeometry(geometry, 25)), line));
    return mesh;
  };

  // Turf boot: an extruded side profile on a lime soleplate with chalk studs and laces.
  const boot = new Group();
  const profile = new Shape();
  profile.moveTo(-0.55, 0.04);
  profile.lineTo(0.5, 0.04);
  profile.quadraticCurveTo(0.74, 0.06, 0.68, 0.18);
  profile.quadraticCurveTo(0.5, 0.26, 0.14, 0.32);
  profile.lineTo(-0.16, 0.5);
  profile.lineTo(-0.44, 0.54);
  profile.quadraticCurveTo(-0.6, 0.46, -0.6, 0.2);
  profile.quadraticCurveTo(-0.6, 0.06, -0.55, 0.04);
  const upper = new ExtrudeGeometry(profile, {
    depth: 0.34,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 10,
  });
  upper.translate(0, 0, -0.17);
  boot.add(part(upper, ink));
  const sole = part(new BoxGeometry(1.3, 0.05, 0.4), lime, null);
  sole.position.set(0.04, 0, 0);
  boot.add(sole);
  for (const x of [-0.45, -0.2, 0.1, 0.35, 0.55]) {
    for (const z of [-0.12, 0.12]) {
      const stud = part(new CylinderGeometry(0.03, 0.035, 0.07, 8), chalk, null);
      stud.position.set(x, -0.055, z);
      boot.add(stud);
    }
  }
  for (const [x, y] of [
    [0.02, 0.37],
    [0.14, 0.33],
    [0.26, 0.29],
  ]) {
    const lace = part(new BoxGeometry(0.03, 0.02, 0.3), chalk, null);
    lace.position.set(x, y, 0);
    lace.rotation.z = -0.35;
    boot.add(lace);
  }

  // Goalkeeper glove: a padded chalk palm, fanned fingers and an angled thumb,
  // on a dark cuff with a lime strap. Smooth shading and no outlines, so it
  // reads as one soft glove rather than a stack of boxes.
  const glove = new Group();
  const soft = new MeshLambertMaterial({ color: CHALK });
  bin.materials.push(soft);
  const rounded = (w: number, h: number, r: number) => {
    const shape = new Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return shape;
  };
  const pad = (w: number, h: number, depth: number) => {
    const g = new ExtrudeGeometry(rounded(w, h, 0.09), {
      depth,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 4,
      curveSegments: 8,
    });
    g.translate(0, 0, -depth / 2);
    return keep(g);
  };
  const palm = new Mesh(pad(0.42, 0.44, 0.08), soft);
  palm.position.y = 0.06;
  glove.add(palm);
  // Little finger to index: lengths and a slight fan, like a real hand.
  [0.17, 0.24, 0.26, 0.22].forEach((length, i) => {
    const finger = new Mesh(keep(new CapsuleGeometry(0.058, length, 6, 12)), soft);
    const x = -0.165 + i * 0.11;
    finger.position.set(x, 0.3 + length / 2 + 0.04, 0);
    finger.rotation.z = (1.5 - i) * 0.07;
    glove.add(finger);
  });
  const thumb = new Mesh(keep(new CapsuleGeometry(0.065, 0.18, 6, 12)), soft);
  thumb.position.set(0.3, 0.1, 0.03);
  thumb.rotation.z = -0.85;
  glove.add(thumb);
  const cuff = new Mesh(pad(0.46, 0.18, 0.1), ink);
  cuff.position.y = -0.27;
  glove.add(cuff);
  const strap = new Mesh(keep(new BoxGeometry(0.56, 0.07, 0.26)), amber);
  strap.position.set(0, -0.27, 0);
  strap.rotation.z = 0.12;
  glove.add(strap);

  // Referee whistle: chalk barrel and mouthpiece, lime ring.
  const whistle = new Group();
  const barrelGeometry = new CylinderGeometry(0.13, 0.13, 0.2, 20);
  const barrel = part(barrelGeometry, chalk, null);
  barrel.rotation.x = Math.PI / 2;
  whistle.add(barrel);
  const mouth = part(new BoxGeometry(0.28, 0.08, 0.16), chalk, null);
  mouth.position.set(0.2, 0.05, 0);
  whistle.add(mouth);
  const ring = part(new TorusGeometry(0.07, 0.015, 8, 20), lime, null);
  ring.position.set(-0.16, 0.12, 0);
  whistle.add(ring);

  // Training cone on its square base.
  const cone = new Group();
  const body = part(new ConeGeometry(0.2, 0.46, 20, 1, true), amber, null);
  body.position.y = 0.25;
  cone.add(body);
  cone.add(part(new BoxGeometry(0.46, 0.04, 0.46), ink));
  const band = part(new CylinderGeometry(0.115, 0.14, 0.07, 20, 1, true), ink, null);
  band.position.y = 0.2;
  cone.add(band);

  // Futsal goal (3 m × 2 m): chalk frame and a faint net sloping back to the floor.
  const goal = new Group();
  const W = 0.9;
  const H = 0.6;
  const D = 0.35;
  const post = (length: number) => part(new CylinderGeometry(0.018, 0.018, length, 8), chalk, null);
  const left = post(H);
  left.position.set(-W / 2, H / 2, 0);
  const right = post(H);
  right.position.set(W / 2, H / 2, 0);
  const crossbar = post(W);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, H, 0);
  goal.add(left, right, crossbar);
  const net: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const x = -W / 2 + (W * i) / 8;
    net.push(x, H, 0, x, 0, -D);
  }
  for (let j = 0; j <= 5; j++) {
    const k = j / 5;
    net.push(-W / 2, H * (1 - k), -D * k, W / 2, H * (1 - k), -D * k);
  }
  for (const side of [-W / 2, W / 2]) {
    for (let j = 0; j <= 4; j++) net.push(side, (H * j) / 4, 0, side, 0, -D * (1 - j / 4));
  }
  const netGeometry = keep(new BufferGeometry());
  netGeometry.setAttribute("position", new Float32BufferAttribute(net, 3));
  goal.add(new LineSegments(netGeometry, chalkLine));
  goal.position.y = -H / 2;

  // Stopwatch: dark case, lime bezel, chalk crown and hand.
  const watch = new Group();
  const face = part(new CylinderGeometry(0.2, 0.2, 0.07, 28), ink);
  face.rotation.x = Math.PI / 2;
  watch.add(face);
  watch.add(part(new TorusGeometry(0.2, 0.022, 8, 28), lime, null));
  const crown = part(new CylinderGeometry(0.035, 0.035, 0.08, 10), chalk, null);
  crown.position.y = 0.26;
  watch.add(crown);
  const hand = part(new BoxGeometry(0.02, 0.15, 0.01), chalk, null);
  hand.position.set(0, 0.06, 0.045);
  watch.add(hand);

  // Where each piece floats around the ball.
  const piece = (object: Object3D, x: number, y: number, z: number, scale: number, bob: number, yaw: number) => {
    const wrapper = new Group(); // the wrapper moves; the piece inside keeps its own centring
    wrapper.add(object);
    return { object: wrapper, home: new Vector3(x, y, z), bob, yaw, scale };
  };
  return [
    piece(boot, -1.75, 0.9, -0.3, 0.8, 0.9, 0.6),
    piece(glove, 1.75, 0.95, -0.5, 0.9, 1.1, -0.3),
    piece(whistle, 1.8, -0.65, 0.5, 1.1, 1.3, 0.5),
    piece(cone, -1.55, -0.6, 0.4, 0.9, 1.0, 0),
    piece(goal, 0.25, -1.55, -1.3, 1, 0.7, -0.45),
    piece(watch, -0.35, 1.7, -1.0, 1, 1.2, 0.25),
  ];
}

/**
 * The hero: a glass football with a miniature futsal kit orbiting it. The ball
 * drops in with a bounce, the kit pops in after it, everything leans toward the
 * pointer and spreads out as the page scrolls, and the ball can be flicked by
 * hand. It stops drawing when it's off screen or the tab is hidden.
 */
export default function Football3D({ reduce, onFail }: { reduce: boolean; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const bin: Bin = { geometries: [], materials: [] };
    const scene = new Scene();
    const camera = new PerspectiveCamera(36, 1, 0.1, 50);
    // Far enough back that the kit sits well inside the frame (the canvas bleeds
    // past its box by the same factor, so nothing is clipped at the edges).
    camera.position.set(0, 0.2, 7.4 * BLEED);
    camera.lookAt(0, 0, 0);

    // Soft, even light and matte surfaces: no hotspots or coloured glare.
    scene.add(new AmbientLight(0xffffff, 1.2));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-3, 4, 5);
    scene.add(key);

    // The ball: solid near-black pentagons; the white panels are see-through glass.
    const { hull, pentagon, hexagon } = footballGeometries();
    const pentMaterial = new MeshLambertMaterial({ color: INK, flatShading: true, side: DoubleSide });
    const glassMaterial = new MeshLambertMaterial({
      color: CHALK,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: DoubleSide,
    });
    const seamGeometry = new EdgesGeometry(hull, 5);
    const seamMaterial = new LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.55 });
    bin.geometries.push(hull, pentagon, hexagon, seamGeometry);
    bin.materials.push(pentMaterial, glassMaterial, seamMaterial);
    const ball = new Group();
    const glass = new Mesh(hexagon, glassMaterial);
    glass.renderOrder = 1;
    ball.add(new Mesh(pentagon, pentMaterial), glass, new LineSegments(seamGeometry, seamMaterial));

    const spinner = new Group();
    spinner.add(ball);
    const lift = new Group();
    lift.add(spinner);
    scene.add(lift);

    const kit = makeKit(bin);
    const orbit = new Group();
    for (const piece of kit) {
      piece.object.position.copy(piece.home);
      piece.object.scale.setScalar(0.0001); // pops in after the ball lands
      orbit.add(piece.object);
    }
    scene.add(orbit);

    const shadowMap = shadowTexture();
    const shadowMaterial = new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
    const shadowGeometry = new PlaneGeometry(2.4, 2.4);
    bin.geometries.push(shadowGeometry);
    bin.materials.push(shadowMaterial);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.18;
    scene.add(shadow);

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);

    // Pointer lean, flick-to-spin and scroll spin all feed the ball's spin velocity.
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const spin = { x: 0.15, y: 0.35 };
    let drag: { x: number; y: number } | null = null;
    let lastScroll = window.scrollY;
    let spread = 0;

    const onWindowPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      lean.tx = (event.clientX / window.innerWidth - 0.5) * 0.6;
      lean.ty = (event.clientY / window.innerHeight - 0.5) * 0.4;
    };
    const onDown = (event: PointerEvent) => {
      drag = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onMove = (event: PointerEvent) => {
      if (!drag) return;
      spin.y += (event.clientX - drag.x) * 0.02;
      spin.x += (event.clientY - drag.y) * 0.02;
      drag = { x: event.clientX, y: event.clientY };
    };
    const onUp = () => {
      drag = null;
      renderer.domElement.style.cursor = "grab";
    };
    const onScroll = () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      spin.x += delta * 0.0025;
    };
    renderer.domElement.style.cursor = "grab";
    if (!reduce) {
      window.addEventListener("pointermove", onWindowPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);
    }

    let visible = true;
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersection.observe(el);

    const started = performance.now();
    let last = started;
    let frame = 0;
    // Overshoot a touch, then settle: the kit pops into place.
    const backOut = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - started) / 1000;

      // Drop in: a decaying bounce off the floor, then a gentle hover.
      const bounce = 2.4 * Math.exp(-3 * t) * Math.abs(Math.cos(5.2 * t));
      const hover = Math.sin(t * 1.6) * 0.05 * Math.min(1, t / 1.5);
      lift.position.y = bounce + hover;
      const height = lift.position.y + 1;
      shadow.scale.setScalar(0.55 + 0.35 / height);
      shadowMaterial.opacity = Math.min(0.9, 0.9 / height);

      lean.x += (lean.tx - lean.x) * 0.05;
      lean.y += (lean.ty - lean.y) * 0.05;
      lift.rotation.z = -lean.x * 0.4;
      lift.position.x = lean.x * 0.25;

      spin.x += (0.15 - spin.x) * 0.02;
      spin.y += (0.35 - spin.y) * 0.02;
      spinner.rotation.x += spin.x * dt + lean.y * 0.01;
      spinner.rotation.y += spin.y * dt;

      // The kit pops in one by one, bobs and turns, sways with the pointer, and
      // spreads outward as the hero scrolls away.
      const target = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
      spread += (target - spread) * 0.08;
      orbit.rotation.y = Math.sin(t * 0.15) * 0.3 + lean.x * 0.5;
      orbit.rotation.x = lean.y * 0.3;
      kit.forEach((piece, i) => {
        const appear = Math.min(1, Math.max(0, (t - 0.7 - i * 0.12) / 0.6));
        piece.object.scale.setScalar(Math.max(0.0001, piece.scale * backOut(appear)));
        const out = 1 + spread * 0.6;
        piece.object.position.set(piece.home.x * out, piece.home.y * out + Math.sin(t * piece.bob + i) * 0.08, piece.home.z);
        piece.object.rotation.y = piece.yaw + Math.sin(t * 0.5 * piece.bob + i * 1.7) * 0.5;
        piece.object.rotation.x = Math.sin(t * piece.bob * 0.7 + i) * 0.25;
      });

      renderer.render(scene, camera);
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      draw(now);
    };

    if (reduce) {
      // One still frame: ball resting, kit in place.
      spinner.rotation.set(0.5, 0.6, 0);
      draw(started + 60_000);
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onWindowPointer);
      window.removeEventListener("scroll", onScroll);
      for (const g of bin.geometries) g.dispose();
      for (const m of bin.materials) m.dispose();
      shadowMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduce, onFail]);

  return (
    <div
      ref={host}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: `${BLEED * 100}%`, height: `${BLEED * 100}%` }}
    />
  );
}
