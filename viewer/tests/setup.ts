import { vi } from "vitest";

vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
