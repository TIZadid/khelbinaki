import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BufferAttribute,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

const LIME = new Color("#a6d421");
const PANEL = new Color("#e6ecdc");

/**
 * A real football shape: the truncated icosahedron (12 pentagons, 20 hexagons).
 * Its 60 corners are the even permutations of (0, ±1, ±3φ), (±1, ±(2+φ), ±2φ)
 * and (±φ, ±2, ±φ³); the convex hull of those points is the ball.
 */
function footballGeometry() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const seeds = [
    [0, 1, 3 * phi],
    [1, 2 + phi, 2 * phi],
    [phi, 2, phi ** 3],
  ];
  const seen = new Set<string>();
  const points: Vector3[] = [];
  for (const [a, b, c] of seeds) {
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
  const geometry = new ConvexGeometry(points.map((p) => p.divideScalar(radius)));

  // Pentagons sit exactly under the 12 corners of the icosahedron the ball was cut
  // from, (0, ±1, ±φ) and its cyclic turns, so a face pointing that way is lime.
  const pentagons: Vector3[] = [];
  for (const [x, y, z] of [
    [0, 1, phi],
    [1, phi, 0],
    [phi, 0, 1],
  ]) {
    for (const sy of [1, -1]) for (const sz of [1, -1]) pentagons.push(new Vector3(x, y * sy, z * sz).normalize());
  }

  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t < position.count / 3; t++) {
    a.fromBufferAttribute(position, t * 3);
    b.fromBufferAttribute(position, t * 3 + 1);
    c.fromBufferAttribute(position, t * 3 + 2);
    const normal = new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
    const color = pentagons.some((p) => Math.abs(p.dot(normal)) > 0.999) ? LIME : PANEL;
    for (let k = 0; k < 3; k++) color.toArray(colors, (t * 3 + k) * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// A soft round shadow drawn once onto a canvas.
function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0,0,0,0.75)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

/**
 * The hero ball. It drops in with a bounce, drifts, leans toward the pointer,
 * spins faster as the page scrolls, and can be flicked by hand. It stops
 * drawing when it's off screen or the tab is hidden.
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

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.35, 5.4);
    camera.lookAt(0, -0.1, 0);

    scene.add(new AmbientLight(0xffffff, 0.55));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new PointLight(LIME, 30, 12);
    rim.position.set(2.4, 1.2, -2.2);
    scene.add(rim);

    const ballGeometry = footballGeometry();
    const ballMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.42, metalness: 0.08 });
    const ball = new Mesh(ballGeometry, ballMaterial);
    const seamGeometry = new EdgesGeometry(ballGeometry, 5);
    const seamMaterial = new LineBasicMaterial({ color: 0x0a0c09, transparent: true, opacity: 0.55 });
    ball.add(new LineSegments(seamGeometry, seamMaterial));

    const spinner = new Group();
    spinner.add(ball);
    const lift = new Group();
    lift.add(spinner);
    scene.add(lift);

    // Two thin orbit rings, like a ball mid-trick.
    const ringGeometry = new TorusGeometry(1.45, 0.004, 6, 160);
    const ringMaterial = new MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.35 });
    const ringA = new Mesh(ringGeometry, ringMaterial);
    ringA.rotation.set(1.2, 0.3, 0);
    const ringB = new Mesh(ringGeometry, ringMaterial);
    ringB.rotation.set(1.9, -0.6, 0.4);
    ringB.scale.setScalar(1.12);
    lift.add(ringA, ringB);

    const shadowMap = shadowTexture();
    const shadowMaterial = new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
    const shadow = new Mesh(new PlaneGeometry(2.4, 2.4), shadowMaterial);
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

    // Pointer lean, flick-to-spin and scroll spin all feed the same spin velocity.
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const spin = { x: 0.15, y: 0.35 };
    let drag: { x: number; y: number } | null = null;
    let lastScroll = window.scrollY;

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

      // Spin decays back to a slow idle roll.
      spin.x += (0.15 - spin.x) * 0.02;
      spin.y += (0.35 - spin.y) * 0.02;
      spinner.rotation.x += spin.x * dt + lean.y * 0.01;
      spinner.rotation.y += spin.y * dt;
      ringA.rotation.z += dt * 0.25;
      ringB.rotation.z -= dt * 0.18;

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
      // One still frame, ball resting on its shadow.
      spinner.rotation.set(0.5, 0.6, 0);
      renderer.render(scene, camera);
      lift.position.y = 0;
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
      ballGeometry.dispose();
      ballMaterial.dispose();
      seamGeometry.dispose();
      seamMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      shadowMap.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduce, onFail]);

  return <div ref={host} className="size-full" />;
}
