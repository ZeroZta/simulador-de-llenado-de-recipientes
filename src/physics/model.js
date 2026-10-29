/**
 * Physics for the canonical, constant-depth extruded VesselProfile.
 * Coordinates are metres, volume m³, flow m³/s, and time seconds.
 * No geometry is copied here: every cross-section is read from profile.area(y).
 */

const DEFAULT_TOLERANCE = 1e-10; // absolute volume error, m³
const DEFAULT_MAX_DEPTH = 24;

export class PhysicsDomainError extends Error {
  constructor(message, code = 'PHYSICS_DOMAIN') {
    super(message);
    this.name = 'PhysicsDomainError';
    this.code = code;
  }
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PhysicsDomainError(`${label} must be a finite number.`, 'NON_FINITE');
  }
  return value;
}

function checkProfile(profile) {
  if (!profile || typeof profile.area !== 'function' ||
      typeof profile.volumeTo !== 'function' ||
      typeof profile.heightAtVolume !== 'function') {
    throw new TypeError('Expected a VesselProfile implementing the geometry contract.');
  }
  finiteNumber(profile.yMin, 'yMin');
  finiteNumber(profile.yMax, 'yMax');
  finiteNumber(profile.depth, 'depth');
  finiteNumber(profile.capacity, 'capacity');
  if (!(profile.yMin < profile.yMax) || !(profile.depth > 0) || !(profile.capacity > 0)) {
    throw new PhysicsDomainError('Vessel profile has an empty domain, invalid depth, or zero capacity.', 'INVALID_PROFILE');
  }
  if (typeof profile.validate === 'function') {
    const result = profile.validate();
    if (result === false || (result && result.valid === false)) {
      throw new PhysicsDomainError(result?.message || 'Vessel profile is invalid.', 'INVALID_PROFILE');
    }
  }
}

function sampleArea(profile, y) {
  const area = finiteNumber(profile.area(y), `area(${y})`);
  // A zero area is legitimate only at the base or mouth of a vessel ending in an apex (triangle, cone).
  const atBoundary = y === profile.yMin || y === profile.yMax;
  if (area < 0 || (area === 0 && !atBoundary)) {
    throw new PhysicsDomainError(`Cross-sectional area must be positive at y=${y}.`, 'DEGENERATE_AREA');
  }
  return area;
}

function checkedTolerance(tolerance) {
  finiteNumber(tolerance, 'tolerance');
  if (!(tolerance > 0)) throw new RangeError('tolerance must be positive (m³).');
  return tolerance;
}

/**
 * The profile supplies the exact piecewise polynomial antiderivative. Its
 * floating point error is estimated conservatively from the number of summed
 * segments and the scale of the accumulated result. If that estimate exceeds
 * the caller's absolute error budget, use quadrature instead.
 */
function analyticVolume(profile, y, tolerance) {
  const value = finiteNumber(profile.volumeTo(y), `volumeTo(${y})`);
  if (value < 0) throw new PhysicsDomainError('Profile returned a negative volume.', 'INVALID_VOLUME');
  const segmentCount = Array.isArray(profile.segments) ? profile.segments.length : 1;
  const scale = Math.max(Math.abs(value), Math.abs(profile.capacity), Number.MIN_VALUE);
  const estimatedError = Number.EPSILON * (16 * segmentCount + 8) * scale;
  if (estimatedError <= tolerance) {
    return { value, estimatedError, tolerance, method: 'piecewise-polynomial-antiderivative' };
  }
  return null;
}

/** Adaptive Simpson quadrature. Error estimate is absolute in m³. */
function integrate(profile, endY, tolerance = DEFAULT_TOLERANCE) {
  finiteNumber(endY, 'height');
  checkedTolerance(tolerance);
  if (endY < profile.yMin || endY > profile.yMax) {
    throw new PhysicsDomainError('Height is outside the vessel domain.', 'HEIGHT_OUT_OF_RANGE');
  }
  if (endY === profile.yMin) return { value: 0, estimatedError: 0, tolerance, method: 'piecewise-polynomial-antiderivative' };

  const exact = analyticVolume(profile, endY, tolerance);
  if (exact) return exact;

  const a = profile.yMin;
  const b = endY;
  const m = (a + b) / 2;
  const fa = sampleArea(profile, a);
  const fm = sampleArea(profile, m);
  const fb = sampleArea(profile, b);
  const whole = (b - a) * (fa + 4 * fm + fb) / 6;
  let errorSum = 0;
  function recurse(left, right, fLeft, fMid, fRight, estimate, tol, depth) {
    const mid = (left + right) / 2;
    const lm = (left + mid) / 2;
    const rm = (mid + right) / 2;
    const fLm = sampleArea(profile, lm);
    const fRm = sampleArea(profile, rm);
    const first = (mid - left) * (fLeft + 4 * fLm + fMid) / 6;
    const second = (right - mid) * (fMid + 4 * fRm + fRight) / 6;
    const delta = first + second - estimate;
    const estimated = Math.abs(delta) / 15;
    if (estimated <= tol || depth >= DEFAULT_MAX_DEPTH) {
      errorSum += estimated;
      return first + second + delta / 15;
    }
    return recurse(left, mid, fLeft, fLm, fMid, first, tol / 2, depth + 1) +
      recurse(mid, right, fMid, fRm, fRight, second, tol / 2, depth + 1);
  }
  const value = recurse(a, b, fa, fm, fb, whole, tolerance, 0);
  if (!Number.isFinite(value) || value < 0) throw new PhysicsDomainError('Volume integration failed.', 'INTEGRATION_FAILURE');
  return { value, estimatedError: errorSum, tolerance, method: 'adaptive-simpson' };
}

/** Returns volume and its declared numerical accuracy at height h. */
export function volumeAtHeight(profile, h, { tolerance = DEFAULT_TOLERANCE } = {}) {
  checkProfile(profile);
  return integrate(profile, h, tolerance);
}

/** Returns A(h)=d·w(h), taken from the canonical profile. */
export function areaAtHeight(profile, h) {
  checkProfile(profile);
  if (h < profile.yMin || h > profile.yMax) throw new PhysicsDomainError('Height is outside the vessel domain.', 'HEIGHT_OUT_OF_RANGE');
  return sampleArea(profile, h);
}

/** Inverts the accumulated volume by bisection; volume error is bounded by tolerance. */
export function heightAtVolume(profile, volume, { tolerance = DEFAULT_TOLERANCE, maxIterations = 100 } = {}) {
  checkProfile(profile);
  checkedTolerance(tolerance);
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError('maxIterations must be a positive integer.');
  finiteNumber(volume, 'volume');
  if (volume < 0 || volume > profile.capacity) throw new PhysicsDomainError('Volume must be between zero and vessel capacity.', 'VOLUME_OUT_OF_RANGE');
  if (volume === 0) return { value: profile.yMin, estimatedError: 0, tolerance, method: 'piecewise-polynomial-antiderivative+bisection' };
  if (volume === profile.capacity) return { value: profile.yMax, estimatedError: 0, tolerance, method: 'piecewise-polynomial-antiderivative+bisection' };
  let low = profile.yMin;
  let high = profile.yMax;
  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (low + high) / 2;
    const measured = integrate(profile, mid, tolerance / 4);
    const inverseError = measured.estimatedError + Math.abs(measured.value - volume);
    if (inverseError <= tolerance) {
      return { value: mid, estimatedError: inverseError, tolerance, method: `${measured.method}+bisection` };
    }
    if (measured.value < volume) low = mid;
    else high = mid;
  }
  const value = (low + high) / 2;
  const measured = integrate(profile, value, tolerance / 4);
  return { value, estimatedError: measured.estimatedError + Math.abs(measured.value - volume), tolerance, method: `${measured.method}+bisection` };
}

/**
 * State of constant-Q filling. Q=0 is a valid paused/stationary state.
 * Initial volume is measured above yMin. At/after capacity, overflow is reported
 * as excess inflow volume; vessel volume and height remain capped.
 */
export function fillState(profile, { flowRate, initialVolume = 0, time = 0, tolerance = DEFAULT_TOLERANCE }) {
  checkProfile(profile);
  finiteNumber(flowRate, 'flowRate');
  finiteNumber(initialVolume, 'initialVolume');
  finiteNumber(time, 'time');
  if (flowRate < 0) throw new PhysicsDomainError('Flow rate cannot be negative.', 'INVALID_FLOW');
  if (time < 0) throw new PhysicsDomainError('Time cannot be negative.', 'INVALID_TIME');
  if (initialVolume < 0 || initialVolume > profile.capacity) throw new PhysicsDomainError('Initial volume is outside vessel capacity.', 'INVALID_INITIAL_VOLUME');
  const requested = initialVolume + flowRate * time;
  if (!Number.isFinite(requested)) throw new PhysicsDomainError('Requested volume overflowed numeric range.', 'NON_FINITE');
  const volume = Math.min(requested, profile.capacity);
  const overflowVolume = Math.max(0, requested - profile.capacity);
  const height = heightAtVolume(profile, volume, { tolerance });
  const area = volume >= profile.capacity ? areaAtHeight(profile, profile.yMax) : areaAtHeight(profile, height.value);
  const timeToFull = flowRate > 0 ? Math.max(0, (profile.capacity - initialVolume) / flowRate) : (initialVolume === profile.capacity ? 0 : Infinity);
  return {
    time,
    flowRate,
    initialVolume,
    requestedVolume: requested,
    volume,
    overflowVolume,
    height: height.value,
    area,
    heightRate: flowRate > 0 && volume < profile.capacity ? (area > 0 ? flowRate / area : Infinity) : 0,
    capacity: profile.capacity,
    timeToFull,
    isFull: volume >= profile.capacity,
    isOverflowing: overflowVolume > 0,
    accuracy: { method: height.method, estimatedVolumeError: height.estimatedError, tolerance, unit: 'm³' },
  };
}

/** Seconds to reach the top from an initial volume; Infinity when Q=0 and not full. */
export function timeToFill(profile, flowRate, initialVolume = 0) {
  checkProfile(profile);
  finiteNumber(flowRate, 'flowRate');
  finiteNumber(initialVolume, 'initialVolume');
  if (flowRate < 0 || initialVolume < 0 || initialVolume > profile.capacity) throw new PhysicsDomainError('Invalid flow rate or initial volume.', 'INVALID_FILL_PARAMETERS');
  return flowRate === 0 ? (initialVolume === profile.capacity ? 0 : Infinity) : (profile.capacity - initialVolume) / flowRate;
}

