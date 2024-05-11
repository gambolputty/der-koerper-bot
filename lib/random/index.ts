const buffer = new ArrayBuffer(8);
const ints = new Int8Array(buffer);
const view = new DataView(buffer);

// Reimplementing aimless.js, because build is broken
// https://github.com/ChrisCavs/aimless.js

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
  nums: T[],
  weights: number[]
): T {
  if (nums.length !== weights.length) {
    throw new Error("Every provided number must have a corresponding weight.");
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const rand = engine() * totalWeight;

  let cumulativeWeight = 0;
  let selectedIndex = 0;

  for (let i = 0; i < nums.length; i++) {
    cumulativeWeight += weights[i];

    if (rand < cumulativeWeight) {
      selectedIndex = i;
      break;
    }
  }

  return nums[selectedIndex];
}

export const randomFromRange = (start: number, end: number): number => {
  const min = Math.ceil(start);
  const max = Math.floor(end);

  return Math.floor(engine() * (max - min + 1)) + min;
};

const generateListFromRange = (min: number, max: number): number[] => {
  const result: number[] = [];

  for (let i = min; i <= max; i++) {
    result.push(i);
  }

  return result;
};

const randIntRange = (i: number, j: number): number => {
  const min = Math.ceil(i);
  const max = Math.floor(j);

  return Math.floor(engine() * (max - min + 1)) + min;
};

const sliceOut = <T>(arr: T[], i: number): T[] => {
  return arr.slice(0, i).concat(arr.slice(i + 1));
};

const sequence = <T>(arr: T[]): T[] => {
  const result: T[] = [];

  let tempArr: T[] = arr;
  let i: number;

  while (result.length < arr.length) {
    i = randIntRange(0, tempArr.length - 1);
    result.push(tempArr[i]);
    tempArr = sliceOut(tempArr, i);
  }

  return result;
};

export const intSequence = (min: number, max: number): number[] => {
  return sequence(generateListFromRange(min, max));
};
