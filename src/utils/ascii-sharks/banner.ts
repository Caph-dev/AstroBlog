import { OceanEngine } from "./engine";

export type AsciiOceanBannerState = "inactive" | "loading" | "ready" | "failed";

/** Fired on `window` whenever the canvas starts/stops covering the image. */
export const ASCII_OCEAN_COVER_EVENT = "asciiOceanCover";

const BANNER_MODE = "banner";

const IMMERSIVE_CLASS = "immersive-reading";
const IMMERSIVE_EVENT = "immersiveReadingChange";

const INTERACTIVE_SELECTOR = [
	"a",
	"button",
	"input",
	"select",
	"textarea",
	"summary",
	"label",
	"[contenteditable]",
	'[role="button"]',
	'[role="link"]',
	'[role="menuitem"]',
	'[role="tab"]',
	'[role="switch"]',
	'[role="checkbox"]',
	'[role="searchbox"]',
	"[data-fancybox]",
].join(",");

export interface AsciiOceanBannerController {
	/** Idempotent: starts, keeps or tears down the engine for the current DOM/mode. */
	sync: () => void;
	destroy: () => void;
}

function readState(wrapper: HTMLElement): AsciiOceanBannerState {
	const value = wrapper.dataset.asciiOcean;
	return value === "ready" || value === "failed" || value === "loading"
		? value
		: "inactive";
}

function isElement(target: EventTarget | null): target is Element {
	return target instanceof Element;
}

class BannerOcean implements AsciiOceanBannerController {
	private wrapper: HTMLElement;
	private canvas: HTMLCanvasElement;
	private engine: OceanEngine | null = null;
	private state: AsciiOceanBannerState = "inactive";
	private failed = false;
	private syncRaf = 0;
	private resizeObserver: ResizeObserver | null = null;

	constructor(wrapper: HTMLElement, canvas: HTMLCanvasElement) {
		this.wrapper = wrapper;
		this.canvas = canvas;
		this.state = readState(wrapper);

		window.addEventListener("wallpaperModeChange", this.onModeChange);
		window.addEventListener("resize", this.onResize);
		document.addEventListener(IMMERSIVE_EVENT, this.onImmersiveChange);
		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(this.onResize);
			this.resizeObserver.observe(wrapper);
		}
	}

	sync = (): void => {
		if (!this.canvas.isConnected || !this.wrapper.isConnected) {
			this.stopEngine();
			this.setState("inactive");
			return;
		}
		if (!this.shouldRun()) {
			this.stopEngine();
			this.setState(this.failed ? "failed" : "inactive");
			return;
		}
		if (this.engine) return;
		if (this.failed) {
			this.setState("failed");
			return;
		}
		this.startEngine();
	};

	destroy = (): void => {
		window.removeEventListener("wallpaperModeChange", this.onModeChange);
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener(IMMERSIVE_EVENT, this.onImmersiveChange);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.syncRaf) {
			cancelAnimationFrame(this.syncRaf);
			this.syncRaf = 0;
		}
		this.stopEngine();
		this.setState("inactive");
	};

	private onModeChange = (): void => {
		this.requestSync();
	};

	private onResize = (): void => {
		this.requestSync();
	};

	private onImmersiveChange = (): void => {
		this.requestSync();
	};

	private requestSync = (): void => {
		if (this.syncRaf) return;
		this.syncRaf = requestAnimationFrame(() => {
			this.syncRaf = 0;
			this.sync();
		});
	};

	private isBannerMode(): boolean {
		return (
			document.documentElement.getAttribute("data-wallpaper-mode") ===
			BANNER_MODE
		);
	}

	private shouldRun(): boolean {
		if (!this.isBannerMode()) return false;
		if (document.body.classList.contains(IMMERSIVE_CLASS)) return false;
		const rect = this.canvas.getBoundingClientRect();
		return rect.width >= 1 && rect.height >= 1;
	}

	private startEngine(): void {
		this.setState("loading");
		let engine: OceanEngine | null = null;
		try {
			engine = new OceanEngine(this.canvas, undefined, {
				acceptPointer: (event) => this.acceptPointer(event),
				onFirstFrame: () => {
					if (this.engine === engine) this.markReady();
				},
				onError: (error) => {
					if (this.engine === engine) this.handleRenderError(error);
				},
			});
			// start() can synchronously report a frame or failure.
			this.engine = engine;
			engine.start();
		} catch (error) {
			console.error("[ascii-ocean] engine failed to start", error);
			this.stopEngine();
			this.failed = true;
			this.setState("failed");
		}
	}

	private stopEngine(): void {
		const engine = this.engine;
		this.engine = null;
		if (engine) {
			try {
				engine.destroy();
			} catch (error) {
				console.error("[ascii-ocean] engine failed to tear down", error);
			}
		}
	}

	private handleRenderError(error: unknown): void {
		console.error("[ascii-ocean] render failed", error);
		this.failed = true;
		this.stopEngine();
		this.setState("failed");
	}

	private markReady(): void {
		if (this.failed || this.state === "ready") return;
		this.setState("ready");
	}

	private setState(next: AsciiOceanBannerState): void {
		if (this.state === next) return;
		const previous = this.state;
		this.state = next;
		this.wrapper.dataset.asciiOcean = next;
		if (next === "ready") this.dispatchCover(true);
		else if (previous === "ready") this.dispatchCover(false);
	}

	private dispatchCover(covered: boolean): void {
		window.dispatchEvent(
			new CustomEvent(ASCII_OCEAN_COVER_EVENT, { detail: { covered } }),
		);
	}

	private acceptPointer(event: PointerEvent): boolean {
		if (this.state !== "ready" || !this.engine) return false;
		if (!this.isBannerMode()) return false;
		if (event.pointerType === "touch") return false;
		const target = event.target;
		if (isElement(target) && target.closest(INTERACTIVE_SELECTOR)) return false;
		return this.isOverBanner(event);
	}

	private isOverBanner(event: PointerEvent): boolean {
		const rect = this.wrapper.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return false;
		return (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		);
	}
}

let controller: BannerOcean | null = null;
let controlledCanvas: HTMLCanvasElement | null = null;
let initialized = false;

/**
 * Idempotent entry point for the bundled script. Safe to call again after a
 * Swup navigation: it re-syncs, or rebuilds if the canvas was replaced.
 */
export function initAsciiOceanBanner(): void {
	const wrapper = document.getElementById("wallpaper-wrapper");
	const canvas = document.getElementById("ascii-ocean-canvas");
	if (
		!(wrapper instanceof HTMLElement) ||
		!(canvas instanceof HTMLCanvasElement)
	) {
		return;
	}

	if (controller && controlledCanvas === canvas && canvas.isConnected) {
		controller.sync();
		return;
	}

	controller?.destroy();
	controller = new BannerOcean(wrapper, canvas);
	controlledCanvas = canvas;
	controller.sync();

	if (initialized) return;
	initialized = true;
	document.addEventListener("swup:enable", syncFromEvent);
	document.addEventListener("swup:contentReplaced", syncFromEvent);
	document.addEventListener("swup:content:replace", syncFromEvent);
}

function syncFromEvent(): void {
	controller?.sync();
}
