export const BASS_ENHANCER_KERNELS = `const subbass = (() => {
/**
 * Psychoacoustic bass enhancer (MaxxBass/RBass class) — extract the band below cutoff,
 * generate its harmonic series with an even/odd waveshaper, band-limit the harmonics to
 * the audible low-mids, and mix against dry. Small speakers reproduce the harmonics; the
 * ear reconstructs the missing fundamental.
 */

let { sin, tanh, PI } = Math

// state-variable filter tick: mutates s = [l, b], the lowpass and bandpass legs
function svf (s, x, f, q) {
	s[0] += f * s[1]
	let h = x - s[0] - q * s[1]
	s[1] += f * h
}

// \`lanes\`, when given, holds amount, drive and keep for each sample of \`data\`, M apart (the /audio manifest's glide of
// moving values), in place of the params'
function subbass (data, params = {}, lanes, M) {
	let fc = params.fc ?? params.freq ?? 80  // sub cutoff, Hz — harmonics built from below here (\`freq\`: former name)
	let amount = params.amount ?? 0.5        // harmonic level 0..1
	let drive = params.drive ?? 0.5          // waveshaper intensity 0..1
	let keep = params.keep ?? 1              // how much original sub to keep (0 = replace)
	let fs = params.fs || 44100

	if (!params._sub) {
		params._sub = new Float64Array(2)      // sub extraction LP
		params._out = new Float64Array(2)      // harmonic band BP
		params._dc = 0
	}
	let s = params._sub, o = params._out, dc = params._dc
	let f1 = 2 * sin(PI * Math.min(fc, fs / 4) / fs)
	let f2 = 2 * sin(PI * Math.min(fc * 2.5, fs / 4) / fs)
	let g = 1 + drive * 6
	let aDc = 1 - Math.exp(-2 * PI * 10 / fs)

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		svf(s, x, f1, 1.2)
		let sub = s[0]                         // lowpass output
		let gi = lanes ? 1 + lanes[M + i] * 6 : g
		// even harmonics from |x| rectification + odd from tanh — full series
		let h = tanh(sub * gi) * 0.6 + Math.abs(sub) * gi * 0.4
		dc += aDc * (h - dc)                   // DC-block the rectifier output
		h -= dc
		// keep harmonics in the speaker-friendly band around 2–5× fc
		svf(o, h, f2, 0.8)
		let harm = o[1]                        // bandpass output
		data[i] = x - (1 - (lanes ? lanes[2 * M + i] : keep)) * sub + (lanes ? lanes[i] : amount) * 2 * harm
	}
	params._dc = dc
	return data
}

return subbass;
})();
`;