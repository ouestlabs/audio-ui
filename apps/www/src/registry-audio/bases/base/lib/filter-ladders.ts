/**
 * The ladder kernels of `@audio/filter-moog-ladder` 1.2.0, `@audio/filter-diode-ladder` 1.2.2 and `@audio/filter-korg35` 1.2.1
 * (MIT, Dmitry Iv.), each module as published, in its own scope, for an
 * `AudioWorklet`: a worklet cannot import them. It defines `moogLadder`,
 * `diodeLadder` and `korg35`.
 */
export const LADDER_KERNELS = `const moogLadder = (() => {
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

function moogLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive ?? 1
	let A = MODES[params.type || 'lowpass']?.[params.poles ?? 4]
	if (!A) throw new RangeError(\`moogLadder: type is lowpass, highpass or bandpass, poles 2 or 4 (got \${params.type}, \${params.poles})\`)

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)            // one-pole gain factor
	let G2 = G * G, G3 = G2 * G, G4 = G3 * G
	let k = res * 4                // feedback coefficient: 0–4, self-oscillation at 4

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

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
		for (let j = 0; j < 4; j++) {
			let y = G * (v - s[j]) + s[j]   // trapezoidal integrator output
			s[j] = 2 * y - s[j]             // state update (2y - s for trapezoidal rule)
			v = y
			out += A[j + 1] * y
		}

		data[i] = out
	}

	return data
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

function diodeLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive ?? 1

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

	// solve(d1..d4) -> [y1,y2,y3,y4]; reused for both the zero-delay estimate
	// (from old state) and the final post-feedback pass.
	let out = new Float64Array(4)
	function solve (d1, d2, d3, d4) {
		let dp1 = d1 / den1
		let dp2 = (d2 + G * dp1) / den2
		let dp3 = (d3 + G * dp2) / den3
		let dp4 = (d4 + G * dp3) / den4
		out[3] = dp4
		out[2] = dp3 - cp3 * out[3]
		out[1] = dp2 - cp2 * out[2]
		out[0] = dp1 - cp1 * out[1]
		return out
	}

	// Sensitivity of y4 to a unit change in the post-feedback drive (constant per block)
	let sens = solve(G, 0, 0, 0)[3]

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let t0 = tanh(s[0]), t1 = tanh(s[1]), t2 = tanh(s[2]), t3 = tanh(s[3])
		let d0 = (1 - G) * t0, d1 = (1 - G) * t1, d2 = (1 - G) * t2, d3 = (1 - G) * t3

		// Zero-input estimate (S) of stage-4 output, from old state only
		let S = solve(d0, d1, d2, d3)[3]

		// Implicit feedback solve, then input drive/saturation
		let u = (data[i] - k * S) / (1 + k * sens)
		u = tanh(u * drive)

		// Final coupled solve with the resolved drive
		let y = solve(d0 + G * u, d1, d2, d3)
		for (let j = 0; j < 4; j++) s[j] = 2 * y[j] - s[j]

		data[i] = y[3]
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

function korg35 (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive ?? 1
	let hp = params.type === 'highpass'

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)         // one-pole gain
	let G2 = G * G              // two-pole gain
	let k = res * 2             // feedback coefficient: 0–2

	// State: 2 one-pole integrator states
	if (!params._s) params._s = new Float64Array(2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
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

		data[i] = hp ? data[i] - y2 - k * y2 : y2
	}

	return data
}

return korg35;
})();
`;
