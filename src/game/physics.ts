/* 2.5D movement collision: AABB circle-pushout + play-area clamping. */
import * as THREE from "three";
import type { AABB } from "./world";

/** Push a circle of radius r out of every solid AABB (XZ plane). */
export function resolveColliders(pos: THREE.Vector3, r: number, colliders: AABB[]) {
  for (const b of colliders) {
    const nx = Math.max(b.x1, Math.min(pos.x, b.x2));
    const nz = Math.max(b.z1, Math.min(pos.z, b.z2));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        const pl = pos.x - b.x1;
        const pr = b.x2 - pos.x;
        const pt = pos.z - b.z1;
        const pb = b.z2 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = b.x1 - r;
        else if (m === pr) pos.x = b.x2 + r;
        else if (m === pt) pos.z = b.z1 - r;
        else pos.z = b.z2 + r;
      }
    }
  }
}

/**
 * Keep the position inside the union of the play-area rects.
 * Free movement while inside any rect; otherwise pull toward the nearest
 * one (inset by the body radius) — this is what lets the deck and the
 * helipad connect seamlessly through the doorway.
 */
export function clampToBounds(pos: THREE.Vector3, r: number, rects: AABB[]) {
  for (const b of rects) {
    if (pos.x >= b.x1 && pos.x <= b.x2 && pos.z >= b.z1 && pos.z <= b.z2) return;
  }
  let best: { x: number; z: number; d: number } | null = null;
  for (const b of rects) {
    const cx = Math.max(b.x1 + r, Math.min(pos.x, b.x2 - r));
    const cz = Math.max(b.z1 + r, Math.min(pos.z, b.z2 - r));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d = dx * dx + dz * dz;
    if (!best || d < best.d) best = { x: cx, z: cz, d };
  }
  if (best) {
    pos.x = best.x;
    pos.z = best.z;
  }
}
