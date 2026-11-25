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
 * Written out in \`block\` for each ear, its memory x1, y1 in the state's typed array.
 */

// Delay ring sized from the physics: max |ITD| = (a/c)(1 + pi/2), plus headroom.
const ringSize = (headRadius, fs) => max(8, ceil((headRadius / C_SOUND) * (1 + PI / 2) * fs) + 4)

/**
 * The state a host keeps for \`block\`, made once: the ring, long enough for the largest head radius it will be asked
 * for, and [write position, smoothed azimuth (NaN until the first block), the ring's length in use (0 until then), the
 * head radius the last block ended on, x1 and y1 of the left ear's shadow filter, then the right's], the values a
 * block reads, [azimuth, distance, headRadius, mix, fs], which the host writes before each block, and \`rows\` frames
 * of the distance (\`d\`) and the mix (\`m\`) for a block in which they move.
 */
const state = (maxRadius, fs, rows = 0) => ({ ring: new Float64Array(ringSize(maxRadius, fs)), st: Float64Array.of(0, NaN, 0, NaN, 0, 0, 0, 0), v: new Float64Array(5), d: new Float64Array(rows), m: new Float64Array(rows) })

/**
 * One block of \`left\`, \`right\` in place, at the values in s.v. A new head radius glides across the block from the one
 * the last block ended on (it moves the delay reads). The ring is used up to the length the larger radius needs, and
 * grows in place for a larger one, every sample keeping its age (the length enters the rounding of the read position,
 * so a ring of another length would move the output's last bits); past the ring \`state\` made, it is made anew, larger.
 * \`moving\`: 1 while the distance moves, then read from s.d a sample, 2 while the mix does (s.m), 3 while both do; the
 * values in s.v throughout otherwise.
 */
function block (s, left, right, moving = 0) {
	let v = s.v, st = s.st, azimuth = v[0], distance = v[1], mix = v[3], fs = v[4]
	if (mix <= 0 && !(moving & 2)) return   // identity — skip the wet path entirely (bit-exact)

	let to = v[2], from = st[3] === st[3] ? st[3] : to, glide = to - from
	let need = ringSize(max(from, to), fs), n = st[2], wp = st[0]
	if (need > n) {
		if (need > s.ring.length) { let r = new Float64Array(need); r.set(s.ring); s.ring = r }
		if (n) { s.ring.copyWithin(wp + need - n, wp, n); s.ring.fill(0, wp, wp + need - n) }
		n = need
	}
	let ring = s.ring
	if (st[1] !== st[1]) st[1] = azimuth   // snap on first use — nothing to smooth from yet
	let az = st[1]
	let azK = 1 - exp(-1 / (AZ_SMOOTH_TAU * fs))    // one-pole coefficient, click-free azimuth jumps

	let kappa = 2 * fs                 // bilinear-transform constant
	// the source's gain at its distance: the inverse distance law clamped at the reference distance of 1 m, 1/max(d, 1)
	// (OpenAL 1.1, §3.4.2 Inverse Distance Clamped Model; Web Audio API, §1.27 DistanceModelType "inverse", refDistance
	// 1), so no distance boosts the source: 1/d alone has a pole at 0, a gain of 100 at 1 cm. A NaN reads as 1 m
	let distGain = 1 / (distance > 1 ? distance : 1), dRow = s.d, mRow = s.m
	let x1L = st[4], y1L = st[5], x1R = st[6], y1R = st[7]

	for (let i = 0, l = left.length; i < l; i++) {
		let headRadius = from + glide * (i + 1) / l
		let K = 2 * C_SOUND / headRadius   // head-shadow base frequency * 2 (eq. 4: omega0 = c/a)
		let dryL = left[i], dryR = right[i]
		if (moving & 1) distGain = 1 / (dRow[i] > 1 ? dRow[i] : 1)
		if (moving & 2) mix = mRow[i]
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

		// the head-shadow filter (above), y = b0*x + b1*x1 - a1*y1, for each ear
		let aR = alpha(thR), aL = alpha(thL), a1 = (K - kappa) / (K + kappa)
		let wetR = (K + aR * kappa) / (K + kappa) * xR + (K - aR * kappa) / (K + kappa) * x1R - a1 * y1R
		x1R = xR; y1R = wetR
		let wetL = (K + aL * kappa) / (K + kappa) * xL + (K - aL * kappa) / (K + kappa) * x1L - a1 * y1L
		x1L = xL; y1L = wetL

		left[i] = dryL * (1 - mix) + wetL * mix
		right[i] = dryR * (1 - mix) + wetR * mix

		wp = (wp + 1) % n
	}

	st[0] = wp; st[1] = az; st[2] = n; st[3] = to
	st[4] = x1L; st[5] = y1L; st[6] = x1R; st[7] = y1R
}

/**
 * Seconds the output takes to fall 60 dB after the input stops: the farther ear's delay, (a/c)(1 + pi/2), then the
 * head-shadow pole's decay, ln(1000)/-ln|p| samples for a pole of radius |p| (J. O. Smith: its time constant
 * τ = -1/ln|p| samples, "Introduction to Digital Filters", Time Constant of One Pole; t60 = ln(1000)·τ, "Mathematics of
 * the DFT", Audio Decay Time), p = (K - kappa)/(K + kappa) as above.
 */
function tail (headRadius, fs) {
	let K = 2 * C_SOUND / headRadius, kappa = 2 * fs, p = abs((K - kappa) / (K + kappa))
	return (headRadius / C_SOUND) * (1 + PI / 2) + (p > 0 ? Math.log(1000) / -Math.log(p) / fs : 0)
}

/**
 * @param {Float64Array} left - modified in place
 * @param {Float64Array} right - modified in place
 * @param {object} params - { azimuth: deg -180..180 (0 front, +right) default 0,
 *   distance: m default 1 (gain 1/max(distance, 1)), headRadius: m default 0.0875, mix: 0..1 default 1, fs }
 */
function binaural (left, right, params) {
	let headRadius = params.headRadius ?? 0.0875, fs = params.fs || 44100
	let s = params._state ??= state(headRadius, fs), v = s.v
	v[0] = params.azimuth ?? 0
	v[1] = params.distance ?? 1
	v[2] = headRadius
	v[3] = params.mix ?? 1
	v[4] = fs
	block(s, left, right)
	return [left, right]
}

return binaural;
})();
`;