export const ROTARY_KERNELS = `const polesSos = (() => {
/**
 * Analog ↔ digital filter transforms
 *
 * Pipeline: prototype poles → analog transform → bilinear → digital SOS
 *
 * @module  digital-filter/transform
 */

let {tan, cos, sin, sqrt, PI, atan2, abs} = Math

/**
 * Convert normalized analog LP prototype poles to digital SOS.
 *
 * @param {Array} poles - [[sigma, omega], ...] normalized prototype (cutoff 1 rad/s)
 *   omega > 0 means conjugate pair, omega = 0 means real pole.
 * @param {number|Array} fc - cutoff Hz, or [fLow, fHigh] for BP/BS
 * @param {number} fs - sample rate
 * @param {string} type - 'lowpass','highpass','bandpass','bandstop'
 * @returns {Array} [{b0,b1,b2,a1,a2}, ...]
 */
function polesSos (poles, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	let edge = edgeSections(fc, fs, type)
	if (edge) return edge

	if (type === 'lowpass' || type === 'highpass') {
		let K = tan(PI * fc / fs)
		let C = 1 / K
		let hp = type === 'highpass'
		return lpHpSos(poles, C, hp)
	}

	if (type === 'bandpass') {
		return bpSos(poles, fc[0], fc[1], fs)
	}

	if (type === 'bandstop') {
		return bsSos(poles, fc[0], fc[1], fs)
	}

	throw Error('Unknown type: ' + type)
}

/**
 * Convert prototype poles + zeros to digital SOS.
 * For filters with finite zeros (Chebyshev Type II, Elliptic).
 */
function poleZerosSos (poles, zeros, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	let edge = edgeSections(fc, fs, type)
	if (edge) return edge

	if (type === 'lowpass' || type === 'highpass') {
		let K = tan(PI * fc / fs)
		let C = 1 / K
		let hp = type === 'highpass'
		return lpHpZerosSos(poles, zeros, C, hp)
	}

	if (type === 'bandpass') {
		return bpZerosSos(poles, zeros, fc[0], fc[1], fs)
	}

	if (type === 'bandstop') {
		return bsZerosSos(poles, zeros, fc[0], fc[1], fs)
	}

	throw Error('Unknown type: ' + type)
}

// Degenerate cutoffs resolve to silence/pass sections (same edge semantics as
// iir/biquad.js) instead of NaN coefficients from tan() blowing up.
const SILENCE = () => [{b0: 0, b1: 0, b2: 0, a1: 0, a2: 0}]
const PASS = () => [{b0: 1, b1: 0, b2: 0, a1: 0, a2: 0}]

function edgeSections (fc, fs, type) {
	let nyq = fs / 2
	// NaN/undefined would sail through the <=/>= guards into tan() and produce
	// silently-NaN coefficients — reject loudly instead
	if (type === 'lowpass' || type === 'highpass') {
		if (!Number.isFinite(fc)) throw Error(\`transform: fc must be a finite number (got \${fc})\`)
	} else if (!Array.isArray(fc) || !Number.isFinite(fc[0]) || !Number.isFinite(fc[1])) {
		throw Error(\`transform: \${type} needs fc = [fLow, fHigh] (got \${fc})\`)
	}
	if (type === 'lowpass') {
		if (fc <= 0) return SILENCE()
		if (fc >= nyq) return PASS()
	} else if (type === 'highpass') {
		if (fc <= 0) return PASS()
		if (fc >= nyq) return SILENCE()
	} else if (type === 'bandpass') {
		let [lo, hi] = fc
		if (!(lo > 0 && hi > lo && hi < nyq)) return SILENCE()
	} else if (type === 'bandstop') {
		let [lo, hi] = fc
		if (!(lo > 0 && hi > lo && hi < nyq)) return PASS()
	}
	return null
}

// ────── LP / HP (proven formulas, matches existing code exactly) ──────

function lpHpSos (poles, C, hp) {
	let sections = []

	for (let i = 0; i < poles.length; i++) {
		let sigma = poles[i][0], omega = poles[i][1]

		if (omega === 0) {
			sections.push(firstOrderSection(sigma, C, hp))
		} else {
			sections.push(secondOrderSection(sigma, omega, C, hp))
		}
	}

	return sections
}

function secondOrderSection (sigma, omega, C, hp) {
	let pmag2 = sigma * sigma + omega * omega
	let bs = -2 * sigma

	if (hp) {
		// LP→HP: s→1/s transforms prototype section
		// H(s) = s² / (s² + (bs/pmag2)*s + 1/pmag2)
		let B1 = bs / pmag2, B0 = 1 / pmag2
		let A = C * C + B1 * C + B0
		return {
			b0: C * C / A,
			b1: -2 * C * C / A,
			b2: C * C / A,
			a1: 2 * (B0 - C * C) / A,
			a2: (C * C - B1 * C + B0) / A
		}
	}

	// LP: H(s) = pmag2 / (s² + bs*s + pmag2)
	let A = C * C + bs * C + pmag2
	return {
		b0: pmag2 / A,
		b1: 2 * pmag2 / A,
		b2: pmag2 / A,
		a1: 2 * (pmag2 - C * C) / A,
		a2: (C * C - bs * C + pmag2) / A
	}
}

function firstOrderSection (sigma, C, hp) {
	let absS = -sigma

	if (hp) {
		// HP first-order: s / (s + 1/|p|)
		let B0 = 1 / absS
		let A = C + B0
		return {
			b0: C / A,
			b1: -C / A,
			b2: 0,
			a1: (B0 - C) / A,
			a2: 0
		}
	}

	// LP first-order: |p| / (s + |p|)
	let A = C + absS
	return {
		b0: absS / A,
		b1: absS / A,
		b2: 0,
		a1: (absS - C) / A,
		a2: 0
	}
}

// ────── LP / HP with zeros (Elliptic, Chebyshev Type II) ──────

function lpHpZerosSos (poles, zeros, C, hp) {
	let sections = []
	let zIdx = 0

	for (let i = 0; i < poles.length; i++) {
		let sigma = poles[i][0], omega = poles[i][1]

		if (omega === 0) {
			// Real pole — first order, no zero pairing for now
			sections.push(firstOrderSection(sigma, C, hp))
		} else {
			// Conjugate pair — pair with zero if available
			let zp = zIdx < zeros.length ? zeros[zIdx++] : null
			sections.push(secondOrderZerosSection(sigma, omega, zp, C, hp))
		}
	}

	return sections
}

function secondOrderZerosSection (sigma, omega, zero, C, hp) {
	let pmag2 = sigma * sigma + omega * omega
	let bs = -2 * sigma

	// Denominator: bilinear of (s² + bs*s + pmag2) or HP-transformed version
	// Numerator: bilinear of (s² + zmag2) for zero pair on jω axis, or constant

	if (hp) {
		let B1 = bs / pmag2, B0 = 1 / pmag2
		let A = C * C + B1 * C + B0

		if (zero) {
			// HP zero: jω zero pair on imaginary axis → transform to s² + zmag2/zero...
			// For elliptic/chebII, zeros are on jω axis: zero = [0, ωz]
			let zmag2 = zero[0] * zero[0] + zero[1] * zero[1]
			let Z0 = 1 / zmag2
			let An = C * C + Z0
			return {
				b0: An / A,
				b1: (-2 * C * C + 2 * Z0) / A,
				b2: An / A,
				a1: 2 * (B0 - C * C) / A,
				a2: (C * C - B1 * C + B0) / A
			}
		}

		return {
			b0: C * C / A,
			b1: -2 * C * C / A,
			b2: C * C / A,
			a1: 2 * (B0 - C * C) / A,
			a2: (C * C - B1 * C + B0) / A
		}
	}

	// LP
	let A = C * C + bs * C + pmag2

	if (zero) {
		// Zero pair on jω axis: H(s) has numerator (s² + zmag2)
		let zmag2 = zero[0] * zero[0] + zero[1] * zero[1]
		let An = C * C + zmag2
		return {
			b0: An / A,
			b1: (-2 * C * C + 2 * zmag2) / A,
			b2: An / A,
			a1: 2 * (pmag2 - C * C) / A,
			a2: (C * C - bs * C + pmag2) / A
		}
	}

	return {
		b0: pmag2 / A,
		b1: 2 * pmag2 / A,
		b2: pmag2 / A,
		a1: 2 * (pmag2 - C * C) / A,
		a2: (C * C - bs * C + pmag2) / A
	}
}

// ────── Bandpass via analog LP→BP transform ──────

function bpSos (poles, fLow, fHigh, fs) {
	// All-pole prototype: every mapped pole pair gets one zero at s=0
	return bpZerosSos(poles, [], fLow, fHigh, fs)
}

function bpZerosSos (poles, zeros, fLow, fHigh, fs) {
	// LP→BP on both poles and finite zeros (scipy lp2bp_zpk): each prototype
	// point q maps through s² - B·q·s + w0² = 0; the degree deficit becomes
	// zeros at s=0. Without this, elliptic/Type-II bandpass loses its stopband.
	let wL = prewarp(fLow, fs), wH = prewarp(fHigh, fs)
	let w0 = sqrt(wL * wH)
	let B = wH - wL
	let Cs = 2 * fs

	let polePairs = mapPrototypePairs(poles, q => lpToBpPole(q, w0, B))
	let zeroPairs = mapPrototypePairs(zeros, q => lpToBpPole(q, w0, B))

	let sections = []
	for (let i = 0; i < polePairs.length; i++) {
		let pp = polePairs[i]
		let zp = i < zeroPairs.length ? zeroPairs[i] : null
		// Leftover pole pairs carry the LP prototype's degree deficit: one zero at s=0
		sections.push(zp
			? biquadFromComplexPoles(pp[0], pp[1], zp[0], zp[1], 1, Cs)
			: biquadWithOriginZero(pp[0], pp[1], Cs))
	}

	normalizeAtFreq(sections, sqrt(fLow * fHigh), fs)
	return sections
}

// Map prototype [sigma, omega] entries (omega>0 = conjugate pair) through an
// analog point transform returning 2 mapped points each; group results into
// conjugate pairs → one biquad section per pair.
function mapPrototypePairs (protos, mapPoint) {
	let pairs = []
	for (let i = 0; i < protos.length; i++) {
		let sigma = protos[i][0], omega = protos[i][1]
		if (omega === 0) {
			pairs.push(mapPoint({re: sigma, im: 0}))
		} else {
			let m1 = mapPoint({re: sigma, im: omega})
			let m2 = mapPoint({re: sigma, im: -omega})
			pairs.push(...groupConjugatePairs([m1[0], m1[1], m2[0], m2[1]]))
		}
	}
	return pairs
}

// ────── Bandstop via analog LP→BS transform ──────

function bsSos (poles, fLow, fHigh, fs) {
	// All-pole prototype: every mapped pole pair gets zeros at ±j·w0
	return bsZerosSos(poles, [], fLow, fHigh, fs)
}

function bsZerosSos (poles, zeros, fLow, fHigh, fs) {
	// LP→BS on both poles and finite zeros (scipy lp2bs_zpk): each prototype
	// point q maps through s² - (B/q)·s + w0² = 0; the degree deficit becomes
	// zero pairs at ±j·w0.
	let wL = prewarp(fLow, fs), wH = prewarp(fHigh, fs)
	let w0 = sqrt(wL * wH)
	let B = wH - wL
	let Cs = 2 * fs

	let polePairs = mapPrototypePairs(poles, q => lpToBsPole(q, w0, B))
	let zeroPairs = mapPrototypePairs(zeros, q => lpToBsPole(q, w0, B))

	let sections = []
	for (let i = 0; i < polePairs.length; i++) {
		let pp = polePairs[i]
		let zp = i < zeroPairs.length ? zeroPairs[i] : [{re: 0, im: w0}, {re: 0, im: -w0}]
		sections.push(biquadFromComplexPoles(pp[0], pp[1], zp[0], zp[1], 1, Cs))
	}

	normalizeAtFreq(sections, 0, fs)
	return sections
}

// ────── Bilinear helpers for BP/BS ──────

// Bilinear transform a second-order analog polynomial as^2 + bs + c
function bilinearPoly (a, b, c, Cs) {
	let C2 = Cs * Cs
	return [
		a * C2 + b * Cs + c,
		-2 * a * C2 + 2 * c,
		a * C2 - b * Cs + c
	]
}

// Build biquad from conjugate pole pair with one zero at s=0 (for bandpass)
// H(s) = s / ((s-p1)(s-p2))  — one zero at origin
function biquadWithOriginZero (p1, p2, Cs) {
	let denB = -(p1.re + p2.re)
	let denC = p1.re * p2.re - p1.im * p2.im
	let den = bilinearPoly(1, denB, denC, Cs)
	// s → bilinear: s*(1+z^-1)^2 / (1+z^-1)^2 → C(1-z^-1)(1+z^-1) = C(1-z^-2)
	// So numerator = [C, 0, -C]
	return {
		b0: Cs / den[0],
		b1: 0,
		b2: -Cs / den[0],
		a1: den[1] / den[0],
		a2: den[2] / den[0]
	}
}

// Build biquad from two complex poles (which should be conjugates) and optional two zeros
function biquadFromComplexPoles (p1, p2, z1, z2, gain, Cs) {
	// Denominator: (s - p1)(s - p2) = s² - (p1+p2)s + p1*p2
	let denB = -(p1.re + p2.re)    // -(sigma1+sigma2) for conjugates = -2*sigma
	let denC = p1.re * p2.re - p1.im * p2.im  // real part of p1*p2

	// For conjugate pair: denB = -2*sigma, denC = sigma²+omega² = |p|²
	let den = bilinearPoly(1, denB, denC, Cs)

	let num
	if (z1 && z2) {
		let numB = -(z1.re + z2.re)
		let numC = z1.re * z2.re - z1.im * z2.im
		num = bilinearPoly(1, numB, numC, Cs)
	} else {
		// All-pole: constant numerator → (1+z^-1)² after bilinear
		num = [1, 2, 1]
	}

	return {
		b0: gain * num[0] / den[0],
		b1: gain * num[1] / den[0],
		b2: gain * num[2] / den[0],
		a1: den[1] / den[0],
		a2: den[2] / den[0]
	}
}

// Group 4 poles into 2 conjugate pairs
function groupConjugatePairs (poles) {
	let used = [false, false, false, false]
	let pairs = []

	for (let i = 0; i < poles.length; i++) {
		if (used[i]) continue
		used[i] = true
		// Find conjugate: same real part, negated imaginary part
		let best = -1, bestDist = Infinity
		for (let j = i + 1; j < poles.length; j++) {
			if (used[j]) continue
			let dist = abs(poles[i].re - poles[j].re) + abs(poles[i].im + poles[j].im)
			if (dist < bestDist) { bestDist = dist; best = j }
		}
		if (best >= 0) {
			used[best] = true
			pairs.push([poles[i], poles[best]])
		}
	}

	return pairs
}

// Normalize sections so combined gain = 1 at given frequency.
// Exported for designers that must renormalize at their passband reference
// (DC for lowpass, Nyquist for highpass — bp/bs are normalized here already).
function normalizeAtFreq (sections, freq, fs) {
	let w = 2 * PI * freq / fs
	let cosw = cos(w), sinw = sin(w)
	let cos2w = cos(2 * w), sin2w = sin(2 * w)
	let mag = 1

	for (let i = 0; i < sections.length; i++) {
		let c = sections[i]
		let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
		let bi = -c.b1 * sinw - c.b2 * sin2w
		let ar = 1 + c.a1 * cosw + c.a2 * cos2w
		let ai = -c.a1 * sinw - c.a2 * sin2w
		mag *= sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
	}

	if (mag > 0 && mag !== 1) {
		let scale = 1 / mag
		sections[0].b0 *= scale
		sections[0].b1 *= scale
		sections[0].b2 *= scale
	}
}

// ────── Analog transform pole mappings ──────

// LP → BP: solve s² - B*p*s + w0² = 0
function lpToBpPole (p, w0, B) {
	let bp = cScale2(p, B)
	let disc = cSub2(cMul2(bp, bp), {re: 4 * w0 * w0, im: 0})
	let sq = cSqrt2(disc)
	return [
		cScale2(cAdd2(bp, sq), 0.5),
		cScale2(cSub2(bp, sq), 0.5)
	]
}

// LP → BS: solve s² - (B/p)*s + w0² = 0
function lpToBsPole (p, w0, B) {
	let bOverP = cDiv2({re: B, im: 0}, p)
	let disc = cSub2(cMul2(bOverP, bOverP), {re: 4 * w0 * w0, im: 0})
	let sq = cSqrt2(disc)
	return [
		cScale2(cAdd2(bOverP, sq), 0.5),
		cScale2(cSub2(bOverP, sq), 0.5)
	]
}

function prewarp (f, fs) {
	return 2 * fs * tan(PI * f / fs)
}

// ────── Complex arithmetic ──────

function cMul2 (a, b) { return {re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re} }
function cDiv2 (a, b) { let d = b.re * b.re + b.im * b.im; return {re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d} }
function cAdd2 (a, b) { return {re: a.re + b.re, im: a.im + b.im} }
function cSub2 (a, b) { return {re: a.re - b.re, im: a.im - b.im} }
function cScale2 (a, s) { return {re: a.re * s, im: a.im * s} }
function cSqrt2 (a) {
	let r = sqrt(a.re * a.re + a.im * a.im)
	let theta = atan2(a.im, a.re)
	let sr = sqrt(r)
	return {re: sr * cos(theta / 2), im: sr * sin(theta / 2)}
}

return polesSos;
})();

const butterworth = (() => {
/**
 * Nth-order Butterworth filter → cascaded SOS
 * Maximally flat magnitude response
 *
 * @module  digital-filter/butterworth
 */

let {sin, floor, PI} = Math

/**
 * Design Nth-order Butterworth filter as cascaded second-order sections.
 *
 * @param {number} order - Filter order
 * @param {number} fc - Cutoff frequency in Hz
 * @param {number} [fs=44100] - Sample rate in Hz
 * @param {string} [type='lowpass'] - Filter type: 'lowpass', 'highpass', 'bandpass', 'bandstop'
 * @returns {Array<{b0:number,b1:number,b2:number,a1:number,a2:number}>} SOS sections
 */
function butterworth (order, fc, fs, type) {
	if (!type) type = 'lowpass'
	if (!fs) fs = 44100

	return polesSos(butterworthPoles(order), fc, fs, type)
}

// Butterworth prototype poles (normalized LP at 1 rad/s, unit circle)
// pre-2.4 subpath export kept
function butterworthPoles (N) {
	let poles = []
	for (let m = 0; m < floor(N / 2); m++) {
		let theta = PI * (2 * m + 1) / (2 * N)
		poles.push([-sin(theta), Math.cos(theta)])
	}
	if (N % 2 === 1) poles.push([-1, 0])
	return poles
}

return butterworth;
})();

const linkwitzRiley = (() => {
/**
 * Linkwitz-Riley crossover filter — two cascaded Butterworth filters.
 * LP + HP sum to flat (allpass). LR-N = 2× Butterworth(N/2).
 *
 * @module  digital-filter/linkwitz-riley
 */

function linkwitzRiley(order, fc, fs) {
	if (!fs) fs = 44100
	if (order % 2) throw Error('Linkwitz-Riley order must be even')

	let halfOrder = order / 2

	// Two cascaded Butterworth of half order
	let lpSections = butterworth(halfOrder, fc, fs, 'lowpass')
	let hpSections = butterworth(halfOrder, fc, fs, 'highpass')

	// LR = two cascaded, so duplicate the sections
	return {
		low: lpSections.concat(lpSections.map(s => ({...s}))),
		high: hpSections.concat(hpSections.map(s => ({...s})))
	}
}

return linkwitzRiley;
})();

const crossover = (() => {
/**
 * N-way crossover network using Linkwitz-Riley filters.
 *
 * @module  audio-filter/eq/crossover
 */

/**
 * @param {Array} frequencies - Crossover frequencies [f1, f2, ...] (N-1 frequencies for N bands)
 * @param {number} order - LR order (2, 4, or 8)
 * @param {number} fs - Sample rate
 * @returns {Array<Array<{b0,b1,b2,a1,a2}>>} Array of SOS arrays, one per band
 */
function crossover (frequencies, order, fs) {
	if (!order) order = 4
	if (!fs) fs = 44100

	let bands = []

	for (let i = 0; i <= frequencies.length; i++) {
		if (i === 0) {
			// First band: lowpass at first crossover
			bands.push(linkwitzRiley(order, frequencies[0], fs).low)
		} else if (i === frequencies.length) {
			// Last band: highpass at last crossover
			bands.push(linkwitzRiley(order, frequencies[i - 1], fs).high)
		} else {
			// Middle band: highpass at lower + lowpass at upper
			let hp = linkwitzRiley(order, frequencies[i - 1], fs).high
			let lp = linkwitzRiley(order, frequencies[i], fs).low
			bands.push(hp.concat(lp))
		}
	}

	// LR order ≡ 2 (mod 4) — LR2, LR6, ... — sums flat only with one output inverted
	// per crossover; order ≡ 0 (mod 4) — LR4, LR8, ... — sums in-phase already.
	// Linkwitz, S. & Riley, R. (1976), JAES 24(1)
	if ((order / 2) % 2) {
		for (let i = 1; i < bands.length; i += 2) {
			let sos = bands[i].slice()
			let c = sos[0]
			sos[0] = { ...c, b0: -c.b0, b1: -c.b1, b2: -c.b2 }
			bands[i] = sos
		}
	}

	return bands
}

return crossover;
})();

const { step, state } = (() => {
// Shared biquad kernel — RBJ Audio-EQ-Cookbook coefficients (normalized a0 = 1) +
// transposed direct-form-II processing with persistent per-channel state. The one
// coefficient/kernel source for @audio family cores (dedupe target).

const PI2 = Math.PI * 2

function base (fc, Q, fs) {
	let w = PI2 * fc / fs
	return { cw: Math.cos(w), sw: Math.sin(w), alpha: Math.sin(w) / (2 * Q) }
}
const norm = (b0, b1, b2, a0, a1, a2) => ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 })

function lowpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function highpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function bandpass (fc, Q = 1, fs = 44100) {  // constant 0 dB peak gain
	let { cw, alpha } = base(fc, Q, fs)
	return norm(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function notch (fc, Q = 1, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1, -2 * cw, 1, 1 + alpha, -2 * cw, 1 - alpha)
}
function allpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1 - alpha, -2 * cw, 1 + alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function peaking (fc, Q = 1, fs = 44100, dB = 0) {
	let { cw, alpha } = base(fc, Q, fs)
	let A = 10 ** (dB / 40)
	return norm(1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A)
}
function lowshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s),
		(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s)
}
function highshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s),
		(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s)
}

/** Fresh section state (transposed DF-II: two accumulators). */
const state = () => new Float64Array(2)

/** Process in place through one section; state persists across chunks. */
function process (data, c, s = state()) {
	let b0 = c.b0, b1 = c.b1, b2 = c.b2, a1 = c.a1, a2 = c.a2
	let z1 = s[0], z2 = s[1]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + z1
		z1 = b1 * x - a1 * y + z2
		z2 = b2 * x - a2 * y
		data[i] = y
	}
	s[0] = z1; s[1] = z2
	return data
}

// Two sections in one pass. Each section's recursion is a serial dependency chain; the
// second section's chain is independent of the first's, so interleaving them lets both run
// at once (~2× a section-per-pass cascade). The store/reload between sections keeps the
// element type's rounding, so the output is bit-identical to two process() passes.
function process2 (data, c, s, d, t) {
	let b0 = c.b0, b1 = c.b1, b2 = c.b2, a1 = c.a1, a2 = c.a2
	let e0 = d.b0, e1 = d.b1, e2 = d.b2, f1 = d.a1, f2 = d.a2
	let z1 = s[0], z2 = s[1], w1 = t[0], w2 = t[1]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + z1
		z1 = b1 * x - a1 * y + z2
		z2 = b2 * x - a2 * y
		data[i] = y
		x = data[i]
		y = e0 * x + w1
		w1 = e1 * x - f1 * y + w2
		w2 = e2 * x - f2 * y
		data[i] = y
	}
	s[0] = z1; s[1] = z2; t[0] = w1; t[1] = w2
}

/** One sample through one section — sidechain/per-sample use. */
function step (c, s, x) {
	let y = c.b0 * x + s[0]
	s[0] = c.b1 * x - c.a1 * y + s[1]
	s[1] = c.b2 * x - c.a2 * y
	return y
}

/** Cascade of sections. states: array of state() per section (created if absent). */
function cascade (data, coefs, states) {
	states ??= coefs.map(() => state())
	let i = 0
	for (; i + 1 < coefs.length; i += 2) process2(data, coefs[i], states[i], coefs[i + 1], states[i + 1])
	if (i < coefs.length) process(data, coefs[i], states[i])
	return data
}

/**
 * Params-convention kernel: coefs (section or array) + state persisted on params —
 * the ecosystem's streaming convention (drop-in for digital-filter/core/filter.js).
 */
function filter (data, params) {
	let coefs = Array.isArray(params.coefs) ? params.coefs : [params.coefs]
	if (coefs[0] == null || coefs[0].b0 == null) throw Error('filter: params.coefs must be SOS section(s) {b0,b1,b2,a1,a2}')
	params.state ??= coefs.map(() => state())
	return cascade(data, coefs, params.state)
}

/** |H(f)| at frequency f — analysis/plotting support. */
function magnitude (c, f, fs = 44100) {
	let w = PI2 * f / fs
	let cos1 = Math.cos(w), cos2 = Math.cos(2 * w), sin1 = Math.sin(w), sin2 = Math.sin(2 * w)
	let nr = c.b0 + c.b1 * cos1 + c.b2 * cos2, ni = -(c.b1 * sin1 + c.b2 * sin2)
	let dr = 1 + c.a1 * cos1 + c.a2 * cos2, di = -(c.a1 * sin1 + c.a2 * sin2)
	return Math.hypot(nr, ni) / Math.hypot(dr, di)
}

/** |H(f)| of a cascade (array of SOS sections) — product of each section's magnitude. */
function cascadeMagnitude (sos, f, fs = 44100) {
	let mag = 1
	for (let c of sos) mag *= magnitude(c, f, fs)
	return mag
}

return { step, state };
})();

const rotary = (() => {
const crossoverFn = crossover;
/**
 * Rotary speaker (Leslie) simulation — two independently-spinning rotors (treble horn,
 * bass drum) below a crossover split, each producing Doppler pitch modulation (FM, via
 * a modulated delay line) and directivity amplitude modulation (AM) as it turns past a
 * fixed virtual microphone. Stereo comes from two mics at different angles around the
 * same rotors, not from two separate delay lines.
 *
 * Reference: J.O. Smith, S. Serafin, J. Abel, D. Berners, "Doppler Simulation and the
 * Leslie," Proc. DAFx-02. Chorale/tremolo rotor rates follow the classic Leslie 122
 * horn/drum speeds documented there and in manufacturer service literature.
 *
 * Mono in, stereo out: caller pre-fills both \`left\` and \`right\` with the same dry mono
 * signal (mirrors the effect-pingpong in-place stereo shape); the kernel averages them
 * back to mono internally, then writes distinct L/R.
 */

let { cos, floor, exp, PI } = Math
let PI2 = 2 * PI

// Leslie 122 rotor rates (Hz) — DAFx-02 §2 / manufacturer lore.
let CHORALE = { horn: 0.8, drum: 0.7 }
let TREMOLO = { horn: 6.7, drum: 5.9 }
let C = 343 // speed of sound, m/s

function readDelay (buf, N, ptr, d) {
	let pos = ((ptr - d) % N + N) % N
	let i0 = floor(pos), frac = pos - i0
	let a = buf[i0], b = buf[(i0 + 1) % N]
	return a + frac * (b - a)
}

function rotary (left, right, params = {}) {
	if (left.length !== right.length) throw new RangeError('channel lengths must match')
	let mix = params.mix == null ? 1 : params.mix
	if (mix <= 0) return [left, right] // exact bypass — zero latency, nothing to compensate

	let fs = params.fs || 44100
	let xoFreq = params.crossover == null ? 800 : params.crossover
	let depth = params.depth == null ? 1 : params.depth
	depth = depth < 0 ? 0 : depth > 1 ? 1 : depth
	let hornInertia = Math.max(1e-3, params.hornInertia == null ? 0.6 : params.hornInertia)
	let drumInertia = Math.max(1e-3, params.drumInertia == null ? 2.5 : params.drumInertia)
	let micSpread = params.micSpread == null ? PI / 2 : params.micSpread
	let hornRadius = params.hornRadius == null ? 0.09 : params.hornRadius
	let drumRadius = params.drumRadius == null ? 0.05 : params.drumRadius
	let hornM = params.hornAM == null ? 0.5 : params.hornAM
	let drumM = params.drumAM == null ? 0.25 : params.drumAM

	// target speed resolution: explicit hornSpeed/drumSpeed (manifest form) wins;
	// else \`speed\` enum ('tremolo' | 'chorale' | 'off') or {horn, drum} object.
	let hornTarget, drumTarget
	if (params.hornSpeed != null || params.drumSpeed != null) {
		hornTarget = params.hornSpeed ?? CHORALE.horn
		drumTarget = params.drumSpeed ?? CHORALE.drum
	} else {
		let speed = params.speed ?? 'chorale'
		if (typeof speed === 'object') { hornTarget = speed.horn ?? CHORALE.horn; drumTarget = speed.drum ?? CHORALE.drum }
		else if (speed === 'tremolo') { hornTarget = TREMOLO.horn; drumTarget = TREMOLO.drum }
		else if (speed === 'off') { hornTarget = 0; drumTarget = 0 }
		else { hornTarget = CHORALE.horn; drumTarget = CHORALE.drum } // 'chorale' + fallback
	}

	let d0Horn = hornRadius / C // seconds — peak mic-axis path-length delay
	let d0Drum = drumRadius / C
	let d0HornN = d0Horn * fs   // samples
	let d0DrumN = d0Drum * fs

	// crossover coefficients — designed once and cached on params (per-block hosts call
	// this in the realtime path: no allocation there); redesigned only when the split
	// frequency or sample rate actually moves. LR4 section count is fixed for a single
	// split, so the persistent filter *state* (below) stays valid across a redesign.
	if (!params._sos || params._sosFreq !== xoFreq || params._sosFs !== fs) {
		params._sos = crossoverFn([xoFreq], 4, fs) // [low, high] = [drum band, horn band]
		params._sosFreq = xoFreq
		params._sosFs = fs
	}
	let [lowSOS, highSOS] = params._sos

	if (!params._hornBuf) {
		// sized once for depth ∈ [0,1] worst case (2·d0); independent of live depth/xoFreq.
		params._hornRingN = ((2 * d0HornN) | 0) + 4
		params._drumRingN = ((2 * d0DrumN) | 0) + 4
		params._hornBuf = new Float64Array(params._hornRingN)
		params._drumBuf = new Float64Array(params._drumRingN)
		params._hornPtr = 0
		params._drumPtr = 0
		params._hornPhase = 0
		params._drumPhase = 0
		params._hornF = 0 // rotors start at rest — spin up through inertia like the real thing
		params._drumF = 0
		params._lpState = lowSOS.map(() => state())
		params._hpState = highSOS.map(() => state())
	}
	let hornBuf = params._hornBuf, drumBuf = params._drumBuf
	let hornN = params._hornRingN, drumN = params._drumRingN
	let hornPtr = params._hornPtr, drumPtr = params._drumPtr
	let hornPhase = params._hornPhase, drumPhase = params._drumPhase
	let hornF = params._hornF, drumF = params._drumF
	let lpState = params._lpState, hpState = params._hpState

	// inertia glide: f += (target − f)·(1 − exp(−1/(τ·fs))) per sample (DAFx-02 §3.2 —
	// heavier drum spins up/down slower than the lighter horn).
	let hornCoef = 1 - exp(-1 / (hornInertia * fs))
	let drumCoef = 1 - exp(-1 / (drumInertia * fs))

	for (let i = 0, l = left.length; i < l; i++) {
		let mono = (left[i] + right[i]) * 0.5

		let lo = mono, hi = mono
		for (let s = 0; s < lowSOS.length; s++) lo = step(lowSOS[s], lpState[s], lo)
		for (let s = 0; s < highSOS.length; s++) hi = step(highSOS[s], hpState[s], hi)

		hornF += (hornTarget - hornF) * hornCoef
		drumF += (drumTarget - drumF) * drumCoef
		hornPhase += PI2 * hornF / fs
		if (hornPhase >= PI2) hornPhase -= PI2; else if (hornPhase < 0) hornPhase += PI2
		drumPhase += PI2 * drumF / fs
		if (drumPhase >= PI2) drumPhase -= PI2; else if (drumPhase < 0) drumPhase += PI2

		hornBuf[hornPtr] = hi
		drumBuf[drumPtr] = lo

		// mic L @ angle 0, mic R @ angle micSpread — same rotor phase, shifted per mic.
		let hAngleL = hornPhase, dAngleL = drumPhase
		let hAngleR = hornPhase + micSpread, dAngleR = drumPhase + micSpread

		let hDelL = d0HornN * (1 + depth * cos(hAngleL))
		let dDelL = d0DrumN * (1 + depth * cos(dAngleL))
		let hDelR = d0HornN * (1 + depth * cos(hAngleR))
		let dDelR = d0DrumN * (1 + depth * cos(dAngleR))

		let hGainL = 1 + depth * hornM * cos(hAngleL)
		let dGainL = 1 + depth * drumM * cos(dAngleL)
		let hGainR = 1 + depth * hornM * cos(hAngleR)
		let dGainR = 1 + depth * drumM * cos(dAngleR)

		let wetL = hGainL * readDelay(hornBuf, hornN, hornPtr, hDelL) + dGainL * readDelay(drumBuf, drumN, drumPtr, dDelL)
		let wetR = hGainR * readDelay(hornBuf, hornN, hornPtr, hDelR) + dGainR * readDelay(drumBuf, drumN, drumPtr, dDelR)

		left[i] = mono * (1 - mix) + wetL * mix
		right[i] = mono * (1 - mix) + wetR * mix

		hornPtr = (hornPtr + 1) % hornN
		drumPtr = (drumPtr + 1) % drumN
	}

	params._hornPtr = hornPtr; params._drumPtr = drumPtr
	params._hornPhase = hornPhase; params._drumPhase = drumPhase
	params._hornF = hornF; params._drumF = drumF

	return [left, right]
}

return rotary;
})();
`;