import { afterEach, describe, expect, it, vi } from "vitest";

import { attachPointer, type PointerHandlers } from "@/components/three/stage";

type Listener = (event: never) => void;

/** Just enough of an element for the pointer rules: listeners, a box and capture. */
function fakeView() {
  const listeners = new Map<string, Set<Listener>>();
  const captured = new Set<number>();
  return {
    captured,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
    fire(type: string, init: Record<string, unknown> = {}) {
      const event = {
        pointerId: 1,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        timeStamp: 0,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
        ...init,
      };
      for (const listener of listeners.get(type) ?? []) (listener as (e: typeof event) => void)(event);
      return event;
    },
    count: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

function recorder() {
  const calls: string[] = [];
  const handlers: PointerHandlers = {
    hover: () => undefined,
    leave: () => calls.push("leave"),
    drag: (dx, dy) => calls.push(`drag ${dx},${dy}`),
    dragChange: (dragging, rested) => calls.push(dragging ? "start" : rested ? "end rested" : "end thrown"),
  };
  return { calls, handlers };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("pointer handling on a 3D view", () => {
  it("leaves a click alone when the press barely moves", () => {
    const view = fakeView();
    const { calls, handlers } = recorder();
    attachPointer(view as unknown as HTMLElement, handlers);

    view.fire("pointerdown", { clientX: 10, clientY: 10 });
    view.fire("pointermove", { clientX: 13, clientY: 11, timeStamp: 10 });
    view.fire("pointerup", { clientX: 13, clientY: 11, timeStamp: 20, buttons: 0 });
    const click = view.fire("click");

    expect(calls).toEqual([]);
    expect(view.captured.size).toBe(0);
    expect(click.defaultPrevented).toBe(false);
  });

  it("turns a moving press into a drag, captures it, and swallows the click that ends it", () => {
    vi.useFakeTimers();
    const view = fakeView();
    const { calls, handlers } = recorder();
    attachPointer(view as unknown as HTMLElement, handlers);

    view.fire("pointerdown", { clientX: 10, clientY: 10 });
    view.fire("pointermove", { clientX: 30, clientY: 10, timeStamp: 16 });
    expect(view.captured.has(1)).toBe(true);
    view.fire("pointerup", { clientX: 30, clientY: 10, timeStamp: 30, buttons: 0 });
    const click = view.fire("click");

    expect(calls).toEqual(["start", "drag 20,0", "end thrown"]);
    expect(click.defaultPrevented && click.propagationStopped).toBe(true);
    expect(view.captured.size).toBe(0);

    // The next click, after the drag, is a real one.
    vi.runAllTimers();
    expect(view.fire("click").defaultPrevented).toBe(false);
  });

  it("lets go without a throw when the pointer rested before release", () => {
    const view = fakeView();
    const { calls, handlers } = recorder();
    attachPointer(view as unknown as HTMLElement, handlers);

    view.fire("pointerdown", { clientX: 10, clientY: 10 });
    view.fire("pointermove", { clientX: 40, clientY: 10, timeStamp: 16 });
    view.fire("pointerup", { clientX: 40, clientY: 10, timeStamp: 400, buttons: 0 });

    expect(calls.at(-1)).toBe("end rested");
  });

  it("drops a press released outside the view instead of dragging with no button held", () => {
    const view = fakeView();
    const { calls, handlers } = recorder();
    attachPointer(view as unknown as HTMLElement, handlers);

    // Pressed near the edge and flicked out: the release never reached the view.
    view.fire("pointerdown", { clientX: 195, clientY: 50 });
    // Back over the view later with no button down.
    view.fire("pointermove", { clientX: 100, clientY: 50, timeStamp: 900, buttons: 0 });
    view.fire("pointermove", { clientX: 60, clientY: 50, timeStamp: 916, buttons: 0 });

    expect(calls).toEqual([]);
    expect(view.captured.size).toBe(0);
  });

  it("ends a drag whose capture is lost without a release", () => {
    const view = fakeView();
    const { calls, handlers } = recorder();
    attachPointer(view as unknown as HTMLElement, handlers);

    view.fire("pointerdown", { clientX: 10, clientY: 10 });
    view.fire("pointermove", { clientX: 40, clientY: 10, timeStamp: 16 });
    view.fire("lostpointercapture", { timeStamp: 20 });

    expect(calls).toEqual(["start", "drag 30,0", "end thrown"]);
  });

  it("removes every listener it added", () => {
    const view = fakeView();
    const detach = attachPointer(view as unknown as HTMLElement, recorder().handlers);
    expect(view.count()).toBeGreaterThan(0);
    detach();
    expect(view.count()).toBe(0);
  });
});
