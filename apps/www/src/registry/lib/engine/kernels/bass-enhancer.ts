/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-subbass` 1.2.0 (MIT, Dmitry Iv.): `subbass`
 */
export const BASS_ENHANCER_KERNELS = `const subbass = (() => {
/**
 * Psychoacoustic bass enhancer (MaxxBass/RBass class) — extract the band below cutoff,
 * generate its harmonic series with an even/odd waveshaper, band-limit the harmonics to
 * the audible low-mids, and mix against dry. Small speakers reproduce the harmonics; the
 * ear reconstructs the missing fundamental.
 */

let { sin, tanh, PI } = Math

// state-variable filter tick: returns [lp, bp, hp], mutates s = {l, b}
function svf (s, x, f, q) {
	s.l += f * s.b
	let h = x - s.l - q * s.b
	s.b += f * h
	return [s.l, s.b, h]
}

function subbass (data, params = {}) {
	let fc = params.fc ?? params.freq ?? 80  // sub cutoff, Hz — harmonics built from below here (\`freq\`: former name)
	let amount = params.amount ?? 0.5        // harmonic level 0..1
	let drive = params.drive ?? 0.5          // waveshaper intensity 0..1
	let keep = params.keep ?? 1              // how much original sub to keep (0 = replace)
	let fs = params.fs || 44100

	if (!params._sub) {
		params._sub = { l: 0, b: 0 }           // sub extraction LP
		params._out = { l: 0, b: 0 }           // harmonic band BP
		params._dc = 0
	}
	let f1 = 2 * sin(PI * Math.min(fc, fs / 4) / fs)
	let f2 = 2 * sin(PI * Math.min(fc * 2.5, fs / 4) / fs)
	let g = 1 + drive * 6
	let aDc = 1 - Math.exp(-2 * PI * 10 / fs)

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let [sub] = svf(params._sub, x, f1, 1.2)
		// even harmonics from |x| rectification + odd from tanh — full series
		let h = tanh(sub * g) * 0.6 + Math.abs(sub) * g * 0.4
		params._dc += aDc * (h - params._dc)   // DC-block the rectifier output
		h -= params._dc
		// keep harmonics in the speaker-friendly band around 2–5× fc
		svf(params._out, h, f2, 0.8)
		let harm = params._out.b               // bandpass output
		data[i] = x - (1 - keep) * sub + amount * 2 * harm
	}
	return data
}

return subbass;
})();
`;
