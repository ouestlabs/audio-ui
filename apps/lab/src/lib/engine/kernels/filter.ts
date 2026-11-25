export const FILTER_KERNELS = `const moogLadder = (() => {
/**
 * Moog 4-pole transistor ladder filter (-24 dB/oct lowpass with resonance).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 6.
 *      Välimäki & Smith, "Discrete-Time Synthesis of the Moog VCF" (2006).
 *
 * 4 cascaded one-pole trapezoidal integrators with implicit feedback solving.
 * No unit delay in feedback path — resonance tracks cutoff accurately to Nyquist.
 *
 * Modes mix the ladder's taps: y0 the saturated input, y1..y4 its stages. A stage is a one-pole
 * lowpass L, so (1 − L)ⁿ is highpass and Lⁿ(1 − L)ⁿ bandpass, their binomials the weights
 * (Zavalishin 2012, §5.5; the same as JUCE's dsp::LadderFilter modes, which Pedalboard exposes).
 *
 * @module  audio-filter/analog/moog-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 * @param {string} [params.type='lowpass'] - lowpass, highpass or bandpass
 * @param {number} [params.poles=4] - 4 (-24 dB/oct; bandpass ±12) or 2 (-12 dB/oct; bandpass ±6)
 */

let {tan, tanh, PI, min} = Math

// weights of y0..y4 for each type and pole count
const MODES = {
	lowpass:  { 2: [0, 0, 1, 0, 0],  4: [0, 0, 0, 0, 1] },
	highpass: { 2: [1, -2, 1, 0, 0], 4: [1, -4, 6, -4, 1] },
	bandpass: { 2: [0, 1, -1, 0, 0], 4: [0, 0, 1, -2, 1] },
}

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

function moogLadder (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1
	let type = params.type || 'lowpass', poles = params.poles ?? 4
	if (!MODES[type]?.[poles]) throw new RangeError(\`moogLadder: type is lowpass, highpass or bandpass, poles 2 or 4 (got \${params.type}, \${params.poles})\`)

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	return moogBlock(data, params._s, SET, type, poles)
}

/**
 * One block in place, allocating nothing: \`s\` the 4 integrator states (a Float64Array kept from call to call), \`set\` a
 * Float64Array of fc, resonance, drive and fs, \`type\` lowpass, highpass or bandpass, \`poles\` 2 or 4. \`fade\`, when given
 * and under way (moogFade starts one), moves the output from the taps it had to this type's over its course
 */
function moogBlock (data, s, set, type, poles, fade) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]
	let A = MODES[type][poles], F = fade && fade[0] < 1 ? fade : null

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)            // one-pole gain factor
	let G2 = G * G, G3 = G2 * G, G4 = G3 * G
	let k = res * 4                // feedback coefficient: 0–4, self-oscillation at 4

	for (let i = 0, n = data.length; i < n; i++) {
		// Estimate output from current state (zero-input response of cascade): a stage outputs
		// y = G·v + s/(1+g), so y4 = G⁴·u + S with S its states propagated through the cascade
		let S = (G3 * s[0] + G2 * s[1] + G * s[2] + s[3]) * (1 - G)

		// Implicit feedback solve: u*(1 + k*G^4) = input - k*S
		let u = (data[i] - k * S) / (1 + k * G4)

		// Nonlinear saturation at input (transistor ladder characteristic)
		u = tanh(u * drive)

		// 4 cascaded trapezoidal one-pole lowpass stages
		let v = u, out = A[0] * u
		Y[0] = u
		for (let j = 0; j < 4; j++) {
			let y = G * (v - s[j]) + s[j]   // trapezoidal integrator output
			s[j] = 2 * y - s[j]             // state update (2y - s for trapezoidal rule)
			v = y
			out += A[j + 1] * y
			Y[j + 1] = y
		}
		if (F !== null && F[0] < 1) out = faded(F, A, Y, 5)

		data[i] = out
	}

	return data
}

const Y = new Float64Array(5)   // this sample's taps y0..y4

// A fade from one set of tap weights to another: \`fade\` a Float64Array of where it is (0 to 1), its step a sample, and
// the weights the output had when it began. This sample's output, the weights moving along t²(3 − 2t), which sets off
// and arrives with no slope: no corner for the ear to hear. Then one step on. The same lines
// are in the moog ladder, korg35 and oberheim, none of which depends on another
function faded (F, A, Y, n) {
	let t = F[0], e = t * t * (3 - 2 * t), out = 0
	for (let k = 0; k < n; k++) out += (F[2 + k] + e * (A[k] - F[2 + k])) * Y[k]
	F[0] = t + F[1] < 1 ? t + F[1] : 1
	return out
}

/**
 * Starts a fade, or restarts one under way, toward the taps moogBlock is next given, from the taps the output has: those
 * of \`type\` and \`poles\` (the last given), or the blend of a fade under way. \`fade\` a Float64Array(7) of where it is, its
 * step a sample (1 / the samples it lasts) and the weights it begins from
 */
function moogFade (fade, type, poles) {
	let A = MODES[type][poles], t = fade[0], e = t * t * (3 - 2 * t)
	for (let k = 0; k < 5; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (A[k] - fade[2 + k]) : A[k]
	fade[0] = 0
	return fade
}

return moogLadder;
})();

const diodeLadder = (() => {
/**
 * Diode ladder filter (Roland TB-303 / EMS VCS3 style).
 * Zero-delay feedback (ZDF) via a tridiagonal solve of the 4 stages.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), §5.10 (unbuffered/
 *      loaded ladder networks).
 *      Pirkle, "Designing Audio Effect Plugins in C++" (2019), Ch. 10.
 *
 * Unlike the Moog transistor ladder — 4 stages isolated by unity-gain buffers,
 * so each stage's output depends only on the stage before it — the diode
 * ladder has no buffers: neighboring stages load each other, so each stage's
 * drive depends on both its predecessor's output AND its successor's state.
 * This couples all 4 stages into one tridiagonal system, solved once per
 * sample (Thomas algorithm) instead of Moog's simple forward cascade. Each
 * stage also carries its own tanh nonlinearity (the diode's I–V curve),
 * closed by one global zero-delay resonance path around the whole chain.
 *
 * @module  audio-filter/analog/diode-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation ≈1.15–1.2, higher than moog-ladder's 1 — the per-stage tanh damps more; see readme)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 */

let {tan, tanh, PI, min} = Math

// Inter-stage loading: diode stages have no buffers, so a fraction of each
// neighbor's signal bleeds across the stage boundary (unlike moog-ladder's 0).
let C = 0.1

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

function diodeLadder (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	return diodeBlock(data, params._s, SET)
}

/**
 * One block in place, allocating nothing: \`s\` the 4 integrator states (a Float64Array kept from call to call), \`set\` a
 * Float64Array of fc, resonance, drive and fs
 */
function diodeBlock (data, s, set) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)
	let k = res * 4               // feedback coefficient, same convention as moog-ladder

	// Tridiagonal system for the 4 bidirectionally-coupled stages:
	//   (1+a)y1 - a*y2         = d1
	//   -G*y1 + (1+a)y2 - a*y3 = d2
	//   -G*y2 + (1+a)y3 - a*y4 = d3
	//   -G*y3 + y4             = d4
	// a = G*C couples each stage to its neighbor. Elimination coefficients
	// (Thomas algorithm) depend only on G, C — precomputed once per block.
	let a = G * C
	let den1 = 1 + a
	let cp1 = -a / den1
	let den2 = den1 + G * cp1
	let cp2 = -a / den2
	let den3 = den1 + G * cp2
	let cp3 = -a / den3
	let den4 = 1 + G * cp3

	// The solve of (d1..d4) -> [y1,y2,y3,y4], written out where it is used: forward sweep dp1..dp4, then
	// y4 = dp4, y3 = dp3 − cp3·y4, y2 = dp2 − cp2·y3, y1 = dp1 − cp1·y2. Used for the zero-delay estimate
	// (from old state, y4 alone) and the final post-feedback pass.

	// Sensitivity of y4 to a unit change in the post-feedback drive (constant per block): the solve of (G, 0, 0, 0)
	let e1 = G / den1
	let e2 = (0 + G * e1) / den2
	let e3 = (0 + G * e2) / den3
	let sens = (0 + G * e3) / den4

	for (let i = 0, n = data.length; i < n; i++) {
		let t0 = tanh(s[0]), t1 = tanh(s[1]), t2 = tanh(s[2]), t3 = tanh(s[3])
		let d0 = (1 - G) * t0, d1 = (1 - G) * t1, d2 = (1 - G) * t2, d3 = (1 - G) * t3

		// Zero-input estimate (S) of stage-4 output, from old state only
		let p1 = d0 / den1
		let p2 = (d1 + G * p1) / den2
		let p3 = (d2 + G * p2) / den3
		let S = (d3 + G * p3) / den4

		// Implicit feedback solve, then input drive/saturation
		let u = (data[i] - k * S) / (1 + k * sens)
		u = tanh(u * drive)

		// Final coupled solve with the resolved drive
		let q1 = (d0 + G * u) / den1
		let q2 = (d1 + G * q1) / den2
		let q3 = (d2 + G * q2) / den3
		let y4 = (d3 + G * q3) / den4
		let y3 = q3 - cp3 * y4
		let y2 = q2 - cp2 * y3
		let y1 = q1 - cp1 * y2
		s[0] = 2 * y1 - s[0]
		s[1] = 2 * y2 - s[1]
		s[2] = 2 * y3 - s[2]
		s[3] = 2 * y4 - s[3]

		data[i] = y4
	}

	return data
}

return diodeLadder;
})();

const korg35 = (() => {
/**
 * Korg MS-20 style filter (Korg35).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 5.
 *      Stilson & Smith, "Analyzing the Korg MS-20 Filter" (1996).
 *
 * The Korg35 is a 2-pole filter with nonlinear feedback. Unlike SVF, it uses two
 * cascaded one-pole sections with the output fed back to the input. The nonlinear
 * saturation in the feedback path gives the aggressive MS-20 character.
 *
 * Lowpass: output from second stage.
 * Highpass: input minus lowpass output — exactly complementary only at
 * resonance=0; the feedback term in the HP tap makes LP+HP diverge from the
 * input as resonance increases (see readme).
 *
 * Only 2 real poles feed the resonance loop (vs. moog-ladder's 4), so the
 * loop phase never reaches -180° at any audible, non-negligible-gain
 * frequency: resonance adds damping/saturation character but no resonant
 * peak and no sustained self-oscillation at any resonance setting (see readme).
 *
 * @module  audio-filter/analog/korg35
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (aggressive damping/saturation; no self-oscillation — see readme)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 * @param {string} [params.type='lowpass'] - 'lowpass' or 'highpass'
 */

let {tan, tanh, PI, min} = Math

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

function korg35 (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1

	// State: 2 one-pole integrator states
	if (!params._s) params._s = new Float64Array(2)
	return korg35Block(data, params._s, SET, params.type === 'highpass')
}

/**
 * One block in place, allocating nothing: \`s\` the 2 integrator states (a Float64Array kept from call to call), \`set\` a
 * Float64Array of fc, resonance, drive and fs, \`hp\` the highpass tap. \`fade\`, when given and under way (korg35Fade
 * starts one), moves the output from the taps it had to this one's over its course
 */
function korg35Block (data, s, set, hp, fade) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]
	let F = fade && fade[0] < 1 ? fade : null

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)         // one-pole gain
	let G2 = G * G              // two-pole gain
	let k = res * 2             // feedback coefficient: 0–2
	taps(W, hp, k)

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]
		// Estimate 2-pole output from state (zero-input cascade response)
		let S = G * s[0] + s[1]

		// Implicit feedback solve
		let u = (data[i] - k * S) / (1 + k * G2)

		// Nonlinear saturation in feedback path (MS-20 character)
		u = tanh(u * drive)

		// Two cascaded trapezoidal one-pole lowpass stages
		let y1 = G * (u - s[0]) + s[0]
		s[0] = 2 * y1 - s[0]

		let y2 = G * (y1 - s[1]) + s[1]
		s[1] = 2 * y2 - s[1]

		let out = hp ? data[i] - y2 - k * y2 : y2
		if (F !== null && F[0] < 1) { Y[0] = x; Y[1] = y2; out = faded(F, W, Y, 2) }
		data[i] = out
	}

	return data
}

const W = new Float64Array(2), Y = new Float64Array(2)   // a block's tap weights, a sample's taps: the input and y2

// The highpass tap is x − y2 − k·y2, the lowpass y2: their weights on x and y2
function taps (W, hp, k) { W[0] = hp ? 1 : 0; W[1] = hp ? -1 - k : 1; return W }

// A fade from one set of tap weights to another: \`fade\` a Float64Array of where it is (0 to 1), its step a sample, and
// the weights the output had when it began. This sample's output, the weights moving along t²(3 − 2t), which sets off
// and arrives with no slope: no corner for the ear to hear. Then one step on. The same lines
// are in the moog ladder, korg35 and oberheim, none of which depends on another
function faded (F, A, Y, n) {
	let t = F[0], e = t * t * (3 - 2 * t), out = 0
	for (let k = 0; k < n; k++) out += (F[2 + k] + e * (A[k] - F[2 + k])) * Y[k]
	F[0] = t + F[1] < 1 ? t + F[1] : 1
	return out
}

/**
 * Starts a fade, or restarts one under way, toward the tap korg35Block is next given, from the taps the output has:
 * those of \`hp\` (the last given) at \`set\`'s resonance, or the blend of a fade under way. \`fade\` a Float64Array(4) of
 * where it is, its step a sample (1 / the samples it lasts) and the weights it begins from
 */
function korg35Fade (fade, hp, set) {
	let t = fade[0], e = t * t * (3 - 2 * t)
	taps(W, hp, set[1] * 2)
	for (let k = 0; k < 2; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (W[k] - fade[2 + k]) : W[k]
	fade[0] = 0
	return fade
}

return korg35;
})();

const oberheim = (() => {
/**
 * Oberheim SEM state-variable filter (–12 dB/oct multimode).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 4–5.
 *
 * 2-pole SVF with continuous mode selection (lowpass, highpass, bandpass, notch).
 * Two trapezoidal integrators with tanh saturation in the feedback path
 * give the warm, musical character of the original SEM hardware.
 *
 * @module  audio-filter/analog/oberheim
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (max resonance at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {string} [params.type='lowpass'] - 'lowpass'|'highpass'|'bandpass'|'notch'
 */

let {tan, tanh, PI, min} = Math

const SET = new Float64Array(3)   // a direct call's fc, resonance, fs

function oberheim (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[2] = params.fs || 44100

	// State: 2 integrator states (bandpass, lowpass)
	if (!params._s) params._s = new Float64Array(2)
	return oberheimBlock(data, params._s, SET, params.type || 'lowpass')
}

/**
 * One block in place, allocating nothing: \`s\` the 2 integrator states (a Float64Array kept from call to call), \`set\` a
 * Float64Array of fc, resonance and fs, \`type\` lowpass, highpass, bandpass or notch. \`fade\`, when given and under way
 * (oberheimFade starts one), moves the output from the taps it had to this type's over its course
 */
function oberheimBlock (data, s, set, type, fade) {
	let fc = set[0], res = set[1], fs = set[2]
	let F = fade && fade[0] < 1 ? fade : null, W = TAPS[type]

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let R = 1 - res               // damping: 1 = no resonance, 0 = max resonance

	for (let i = 0, n = data.length; i < n; i++) {
		// Implicit solve for highpass (ZDF: no unit delay in feedback)
		let hp = (data[i] - 2 * R * s[0] - g * s[0] - s[1]) / (1 + 2 * R * g + g * g)

		// Bandpass integrator (trapezoidal)
		let bp = g * hp + s[0]
		s[0] = g * hp + bp

		// Lowpass integrator (trapezoidal)
		let lp = g * bp + s[1]
		s[1] = g * bp + lp

		// Saturate feedback states (analog character)
		s[0] = tanh(s[0])
		s[1] = tanh(s[1])

		// Mode select
		let out = type === 'bandpass' ? bp
			: type === 'highpass' ? hp
			: type === 'notch' ? hp + lp
			: lp
		if (F !== null && F[0] < 1) { Y[0] = hp; Y[1] = bp; Y[2] = lp; out = faded(F, W, Y, 3) }
		data[i] = out
	}

	return data
}

// each type's weights on the taps hp, bp, lp; a sample's taps
const TAPS = { lowpass: [0, 0, 1], highpass: [1, 0, 0], bandpass: [0, 1, 0], notch: [1, 0, 1] }, Y = new Float64Array(3)

// A fade from one set of tap weights to another: \`fade\` a Float64Array of where it is (0 to 1), its step a sample, and
// the weights the output had when it began. This sample's output, the weights moving along t²(3 − 2t), which sets off
// and arrives with no slope: no corner for the ear to hear. Then one step on. The same lines
// are in the moog ladder, korg35 and oberheim, none of which depends on another
function faded (F, A, Y, n) {
	let t = F[0], e = t * t * (3 - 2 * t), out = 0
	for (let k = 0; k < n; k++) out += (F[2 + k] + e * (A[k] - F[2 + k])) * Y[k]
	F[0] = t + F[1] < 1 ? t + F[1] : 1
	return out
}

/**
 * Starts a fade, or restarts one under way, toward the type oberheimBlock is next given, from the taps the output has:
 * those of \`type\` (the last given), or the blend of a fade under way. \`fade\` a Float64Array(5) of where it is, its step
 * a sample (1 / the samples it lasts) and the weights it begins from
 */
function oberheimFade (fade, type) {
	let W = TAPS[type], t = fade[0], e = t * t * (3 - 2 * t)
	for (let k = 0; k < 3; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (W[k] - fade[2 + k]) : W[k]
	fade[0] = 0
	return fade
}

return oberheim;
})();
`;