import { default as aimless } from "aimless.js";

const buffer = new ArrayBuffer(8);
const ints = new Int8Array(buffer);
const view = new DataView(buffer);

// From: https://github.com/ChrisCavs/aimless.js/blob/main/src/utils.ts
const engine = (): number => {
  try {
    // Credit @ Tamás Sallai
    globalThis.crypto.getRandomValues(ints);

    ints[7] = 63;
    ints[6] |= 0xf0;

    return view.getFloat64(0, true) - 1;
  } catch (e) {
    console.warn(
      "aimless.js: Using Math.random() as fallback for random number generation."
    );
    return Math.random();
  }
};

export function weightedRandom<T extends number>(
  items: T[],
  weights: number[]
): T {
  return aimless.weighted(items, weights, engine) as T;
}

export const randomFromRange = (start: number, end: number): number =>
  aimless.intRange(start, end, engine);
