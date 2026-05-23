
/**
 * vector.ts - AssemblyScript vector math for MasterPaint
 */

export function pointDistance(x1: f32, y1: f32, x2: f32, y2: f32): f32 {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Mathf.sqrt(dx * dx + dy * dy);
}

/**
 * Ramer-Douglas-Peucker simplification helper
 */
export function perpendicularDistance(px: f32, py: f32, x1: f32, y1: f32, x2: f32, y2: f32): f32 {
  let dx = x2 - x1;
  let dy = y2 - y1;
  const mag = Mathf.sqrt(dx * dx + dy * dy);
  if (mag > 0.0) {
    dx /= mag;
    dy /= mag;
  }
  const pvx = px - x1;
  const pvy = py - y1;
  const pvdot = dx * pvx + dy * pvy;
  const ax = pvx - pvdot * dx;
  const ay = pvy - pvdot * dy;
  return Mathf.sqrt(ax * ax + ay * ay);
}

/**
 * Basic hit-test for a point vs a line segment with a tolerance
 */
export function isPointOnSegment(px: f32, py: f32, x1: f32, y1: f32, x2: f32, y2: f32, tol: f32): bool {
  const dist = perpendicularDistance(px, py, x1, y1, x2, y2);
  if (dist > tol) return false;
  
  const minX = Mathf.min(x1, x2) - tol;
  const maxX = Mathf.max(x1, x2) + tol;
  const minY = Mathf.min(y1, y2) - tol;
  const maxY = Mathf.max(y1, y2) + tol;
  
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/**
 * Cubic Bezier point evaluation
 */
export function getCubicBezierPoint(t: f32, x1: f32, y1: f32, cp1x: f32, cp1y: f32, cp2x: f32, cp2y: f32, x2: f32, y2: f32): f32 {
  const invT: f32 = 1.0 - t;
  const b0: f32 = invT * invT * invT;
  const b1: f32 = 3.0 * invT * invT * t;
  const b2: f32 = 3.0 * invT * t * t;
  const b3: f32 = t * t * t;
  return (b0 * x1 + b1 * cp1x + b2 * cp2x + b3 * x2) as f32;
}

// Memory sharing for complex path processing could be added here if needed.
