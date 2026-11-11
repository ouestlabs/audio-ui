/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/biquad` 1.2.2 (MIT, Dmitry Iv.): `lowshelf`, `highshelf`, `filter`
 * - `@audio/eq-tilt` 1.2.3 (MIT, Dmitry Iv.): `tilt`
 */
export const TILT_EQ_KERNELS = `const { lowshelf, highshelf, filter } = (() => {
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

return { lowshelf, highshelf, filter };
})();

const tilt = (() => {
/**
 * Tilt EQ — see-saw around a pivot frequency.
 * One knob: positive tilts bass up / treble down, negative does the opposite.
 *
 * @module  audio-filter/eq/tilt
 */

function tilt (data, params) {
	let gain = params.gain ?? 0       // dB: positive = bass boost / treble cut
	let pivot = params.pivot || 1000  // Hz
	let fs = params.fs || 44100

	if (!params._lo) { params._lo = {}; params._hi = {} }

	if (params._gain !== gain || params._pivot !== pivot || params._fs !== fs) {
		params._lo.coefs = [lowshelf(pivot, 0.5, fs, gain)]
		params._hi.coefs = [highshelf(pivot, 0.5, fs, -gain)]
		params._gain = gain; params._pivot = pivot; params._fs = fs
	}

	filter(data, params._lo)
	filter(data, params._hi)

	return data
}

return tilt;
})();
`;
