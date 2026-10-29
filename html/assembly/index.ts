
export * from "./camera_raw";
export * from "./filters";
export * from "./vector";
export * from "./vectorize";
export * from "./pdn_effects";

/**
 * Memory management helpers
 */
export const ALPHA_ARRAY_ID = idof<Uint8Array>();

export function createBuffer(size: i32): Uint8Array {
    return new Uint8Array(size);
}
