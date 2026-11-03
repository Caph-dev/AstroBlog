import { AsciiRenderer } from "./renderer";
import { World, type SharkSpec } from "./world";

const STEP = 1 / 60;
const MAX_STEPS = 4;

/**
 * Firefly adaptation (not upstream): the engine is written for a full-page hero
 * where every pointer event is fair game. Embedded in a blog banner it has to
 * ignore events that start on an actionable element, stop painting while the
 * tab is hidden, and tell its host when the first frame has been painted.
 */
export interface OceanEngineOptions {
  /** Return false to drop a pointer event (e.g. it started on a link or button). */
  acceptPointer?: (event: PointerEvent) => boolean;
  /** Called once, after the first rendered frame. */
  onFirstFrame?: () => void;
  /** Called if a frame throws; the loop stops and the host can fall back. */
  onError?: (error: unknown) => void;
}

/**
 * Wires World + AsciiRenderer to a canvas: fixed-timestep loop, resize,
 * pointer input, pausing off-screen, and prefers-reduced-motion.
 *
 * Construction only allocates state; `start()` observes, draws and schedules,
 * so a host can assign the instance before anything can call back into it.
 */
export class OceanEngine {
  private world: World;
  private renderer: AsciiRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private visible = true;
  private reducedMotion: MediaQueryList;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private started = false;
  private failed = false;
  private disposed = false;
  private painted = false;

  constructor(
    private canvas: HTMLCanvasElement,
    sharks?: SharkSpec[],
    private options: OceanEngineOptions = {},
  ) {
    this.world = new World(sharks);
    this.renderer = new AsciiRenderer(canvas);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  /**
   * Second phase: register observers and listeners, size, draw the first frame
   * and schedule. Idempotent; a synchronous throw is reported and torn down, so
   * nothing paints or reports a first frame afterwards.
   */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    try {
      this.resizeObserver = new ResizeObserver(() => this.guardResize());
      this.resizeObserver.observe(this.canvas);
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        if (!entry) return;
        this.visible = entry.isIntersecting;
        this.schedule();
      });
      this.intersectionObserver.observe(this.canvas);

      this.reducedMotion.addEventListener("change", this.onMotionPreference);
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      window.addEventListener("pointermove", this.onPointerMove, { passive: true });
      window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
      document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
      window.addEventListener("blur", this.onPointerLeave);

      this.resize();
      // Canvas text can't trigger a webfont load; once the mono face is in, redraw.
      document.fonts?.load(`600 16px ${getComputedStyle(this.canvas).fontFamily}`).then(() => {
        if (this.disposed || this.failed || !this.reducedMotion.matches) return;
        this.drawStill();
      });
      this.schedule();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Idempotent; also the teardown path for a failed start. */
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onPointerLeave);
  }

  /** Stop for good, then let the host fall back. Runs at most once. */
  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.destroy();
    this.options.onError?.(error);
  }

  private guardResize() {
    if (this.disposed || this.failed) return;
    try {
      this.resize();
    } catch (error) {
      this.fail(error);
    }
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    if (this.reducedMotion.matches) this.drawStill();
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (
      this.disposed ||
      this.failed ||
      !this.visible ||
      document.hidden ||
      this.reducedMotion.matches
    )
      return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else this.schedule();
  };

  private markPainted() {
    if (this.painted || this.disposed || this.failed) return;
    this.painted = true;
    this.options.onFirstFrame?.();
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.failed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    try {
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) {
        this.world.step(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
    } catch (error) {
      this.fail(error);
      return;
    }
    if (!this.render(dt)) return;
    this.markPainted();
    if (this.disposed || this.failed) return;
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Draw one frame; a throw stops the loop instead of repeating every frame. */
  private render(dt: number) {
    if (this.disposed || this.failed) return false;
    try {
      this.renderer.render(this.world, dt);
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  /** Reduced motion: let the ecosystem settle, then show a single frame. */
  private drawStill() {
    if (this.disposed || this.failed) return;
    try {
      if (this.world.time < 4) {
        for (let i = 0; i < 240; i++) this.world.step(STEP);
      }
    } catch (error) {
      this.fail(error);
      return;
    }
    if (!this.render(STEP)) return;
    this.markPainted();
  }

  private onMotionPreference = () => {
    if (this.disposed || this.failed) return;
    if (this.reducedMotion.matches) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.drawStill();
    } else {
      this.schedule();
    }
  };

  private toLocal(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    return { x, y, inside };
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.world.pointer;
    // Leaving for a link/button must drop the previous attraction point, or the
    // fish keep following a stale cursor position.
    if (this.options.acceptPointer && !this.options.acceptPointer(e)) {
      p.active = false;
      return;
    }
    const { x, y, inside } = this.toLocal(e);
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== "touch";
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.options.acceptPointer && !this.options.acceptPointer(e)) return;
    const { x, y, inside } = this.toLocal(e);
    if (inside && !this.reducedMotion.matches) this.world.splash(x, y);
  };

  private onPointerLeave = () => {
    this.world.pointer.active = false;
  };
}
