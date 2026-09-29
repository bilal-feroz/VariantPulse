"use client";

import * as React from "react";

/**
 * True once the element has been laid out with a size.
 *
 * A 3D view hidden by a breakpoint (the home helix on a phone) still mounts,
 * and without this it would download three.js and open a WebGL context for a
 * box nobody can see. The observer also catches a view that appears later, on
 * a rotated tablet or a widened window.
 */
export function useDisplayed(ref: React.RefObject<HTMLElement | null>): boolean {
  const [displayed, setDisplayed] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || displayed) return;
    const check = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setDisplayed(true);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, displayed]);

  return displayed;
}
