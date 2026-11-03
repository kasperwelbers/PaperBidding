import { FeatureVector } from "@/types";

export function compressVector(vector: Float32Array): FeatureVector {
  const asNumber: number[] = [...vector];
  const compressed = asNumber.map((v) => {
    return Math.round((v + Number.EPSILON) * 100000) / 100000;
  });

  return compressed;
}
