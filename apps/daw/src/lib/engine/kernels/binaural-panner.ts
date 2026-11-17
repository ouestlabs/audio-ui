export const BINAURAL_PANNER_KERNELS = `const binaural = (() => {
/**
 * Structural binaural panner — spherical-head ITD + head-shadow ILD synthesis.
 * Collapses the input to mono (mid), places it in space, writes L/R in place.
 * No HRIR data: azimuth cues only (elevation/pinna is out of scope, see README).
 *
 * C. P. Brown & R. O. Duda, "A Structural Model for Binaural Sound Synthesis,"
 * IEEE Trans. Speech and Audio Processing, 6(5), pp. 476-488, 1998.
 *  - ITD: eq. (2) (p. 477), the Woodworth/Schlosberg two-branch delay.
 *  - ILD: eq. (3)-(5) (p. 477), the one-pole-one-zero head-shadow filter and
 *    its alpha(theta) sweep — alpha_min=0.1, theta_min=150 deg, confirmed
 *    against the published equations (not the task-supplied guess: verified
 *    directly against the paper's text/figures).
 *  - Each ear's incidence angle is measured from the geometric interaural
 *    axis (+-90 deg from front) — the convention eq. (2)-(5) are stated in.
 *    The paper's fuller eq. (6) instead anchors ears at the measured ear-
 *    canal entrance (+-100 deg) when combining with their pinna model; that
 *    refinement is skipped along with elevation (below).
 *  - Elevation (pinna echoes): Brown-Duda eq. (8) + Table I give a 6-tap
 *    reflection model, but its scaling factor D_n was fit per-subject (only
 *    two listeners), not a general physical constant, and the paper itself
 *    flags the fit as failing near 90 deg elevation ("needs further
 *    investigation and verification"). Baking someone else's individual
 *    calibration in as a fake default would misrepresent it as physics, so
 *    this atom stays azimuth-only (v1) rather than invent a generic D_n.
 */

let { cos, PI, abs, min, max, exp, ceil } = Math

const C_SOUND = 343       // speed of sound, m/s
const ALPHA_MIN = 0.1     // eq. (5)
const THETA_MIN = 150     // eq. (5), degrees
const AZ_SMOOTH_TAU = 0.005   // s — one-pole time constant smoothing azimuth jumps

// Shortest angular distance on a circle, degrees, folded into incidence-angle range [0, 180].
function angDist (a, b) {
	let d = abs(a - b) % 360
	return d > 180 ? 360 - d : d
}

// Woodworth/Brown-Duda per-ear delay, eq. (2). thetaDeg = angle of incidence at this ear, [0,180].
function itd (thetaDeg, headRadius) {
	let th = thetaDeg * PI / 180
	return th < PI / 2 ? -(headRadius / C_SOUND) * cos(th) : (headRadius / C_SOUND) * (th - PI / 2)
}

// Brown-Duda eq. (5): head-shadow shelf amount, sweeps 2 (ipsilateral boost) -> alpha_min (contralateral cut).
function alpha (thetaDeg) {
	return (1 + ALPHA_MIN / 2) + (1 - ALPHA_MIN / 2) * cos(thetaDeg / THETA_MIN * PI)
}

/**
 * One-pole-one-zero head-shadow filter (eq. 3), discretized by direct
 * bilinear transform s = 2fs(1-z^-1)/(1+z^-1) (no frequency prewarp: the
 * pole/zero base omega0 sits well below Nyquist at audio rates, so the warp
 * error is negligible for a perceptual model). With K = 2*omega0 = 2c/a and
 * kappa = 2fs:
 *   H(s) = (1 + alpha*s/(2*omega0)) / (1 + s/(2*omega0))
 *   (K + alpha*s)/(K + s), substitute s, multiply num/denom by (1+z^-1):
 *   => b0 = (K + alpha*kappa)/(K + kappa)
 *      b1 = (K - alpha*kappa)/(K + kappa)
 *      a1 = (K - kappa)/(K + kappa)
 *   y[n] = b0*x[n] + b1*x[n-1] - a1*y[n-1]
 * DC gain is exactly 1 (no shadow at 0 Hz, for any alpha); gain at Nyquist
 * -> alpha, matching the continuous filter's high-frequency asymptote.
 */
function headShadow (x, a, K, kappa, st) {
	let b0 = (K + a * kappa) / (K + kappa)
	let b1 = (K - a * kappa) / (K + kappa)
	let a1 = (K - kappa) / (K + kappa)
	let y = b0 * x + b1 * st.x1 - a1 * st.y1
	st.x1 = x; st.y1 = y
	return y
}

/**
 * @param {Float64Array} left - modified in place
 * @param {Float64Array} right - modified in place
 * @param {object} params - { azimuth: deg -180..180 (0 front, +right) default 0,
 *   distance: m default 1, headRadius: m default 0.0875, mix: 0..1 default 1, fs }
 */
function binaural (left, right, params) {
	let azimuth = params.azimuth ?? 0
	let distance = params.distance ?? 1
	let headRadius = params.headRadius ?? 0.0875
	let mix = params.mix ?? 1
	let fs = params.fs || 44100

	if (mix <= 0) return [left, right]   // identity — skip the wet path entirely (bit-exact)

	// Delay ring sized from the physics: max |ITD| = (a/c)(1 + pi/2), plus headroom.
	let ringSize = max(8, ceil((headRadius / C_SOUND) * (1 + PI / 2) * fs) + 4)
	if (!params._ring || params._ring.length < ringSize) {
		params._ring = new Float64Array(ringSize)
		params._wp = 0
	}
	let ring = params._ring, n = ring.length, wp = params._wp
	let filtL = params._filtL ?? (params._filtL = { x1: 0, y1: 0 })
	let filtR = params._filtR ?? (params._filtR = { x1: 0, y1: 0 })
	if (params._az == null) params._az = azimuth   // snap on first use — nothing to smooth from yet
	let az = params._az
	let azK = 1 - exp(-1 / (AZ_SMOOTH_TAU * fs))    // one-pole coefficient, click-free azimuth jumps

	let K = 2 * C_SOUND / headRadius   // head-shadow base frequency * 2 (eq. 4: omega0 = c/a)
	let kappa = 2 * fs                 // bilinear-transform constant
	let distGain = 1 / (distance || 1)

	for (let i = 0, l = left.length; i < l; i++) {
		let dryL = left[i], dryR = right[i]
		let mid = (dryL + dryR) * 0.5 * distGain

		az += (azimuth - az) * azK   // smoothed azimuth — everything below tracks this, not the raw target

		let thR = angDist(az, 90), thL = angDist(az, -90)
		let tR = itd(thR, headRadius), tL = itd(thL, headRadius)
		let tMin = min(tR, tL)                  // nearer ear normalized to zero added latency
		let dR = (tR - tMin) * fs, dL = (tL - tMin) * fs

		ring[wp] = mid

		let readR = ((wp - dR) % n + n) % n
		let readL = ((wp - dL) % n + n) % n
		let r0 = readR | 0, rf = readR - r0, r1 = (r0 + 1) % n
		let l0 = readL | 0, lf = readL - l0, l1 = (l0 + 1) % n
		let xR = ring[r0] * (1 - rf) + ring[r1] * rf
		let xL = ring[l0] * (1 - lf) + ring[l1] * lf

		let wetR = headShadow(xR, alpha(thR), K, kappa, filtR)
		let wetL = headShadow(xL, alpha(thL), K, kappa, filtL)

		left[i] = dryL * (1 - mix) + wetL * mix
		right[i] = dryR * (1 - mix) + wetR * mix

		wp = (wp + 1) % n
	}

	params._az = az
	params._wp = wp
	return [left, right]
}

return binaural;
})();
`;