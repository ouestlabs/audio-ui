export const EXCITER_KERNELS = `const exciter = (() => {
/**
 * Exciter — psychoacoustic harmonic synthesis for presence/air.
 * Highpass extracts high-band, soft saturation generates harmonics,
 * mixed back into dry signal. Aphex-style aural exciter.
 */

let {tan, tanh, min, PI} = Math

function exciter (data, params = {}) {
	let fc     = params.fc ?? params.freq ?? 3000   // highpass cutoff Hz (\`freq\`: former name)
	let drive  = params.drive  ?? 0.5    // saturation 0–1 → 1×–10× gain
	let amount = params.amount ?? 0.5    // exciter mix 0–1
	let fs     = params.fs     || 44100

	if (params._lp == null) {
		params._lp = 0
		params._bp = 0
	}
	let lp = params._lp, bp = params._bp
	let w = tan(PI * min(fc, 0.49 * fs) / fs)   // prewarped cutoff
	let k = 0.5                          // moderate damping (Q 2)
	let a = 1 / (1 + w * (w + k))
	let g = 1 + drive * 9                // 1×–10×

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		// trapezoidal state-variable filter (Zavalishin, The Art of VA Filter Design, ch. 3–4; Simper 2013),
		// highpass tap: stable at any fc below Nyquist, where Chamberlin's form diverged once f² + 2fk > 4
		let v1 = a * (bp + w * (x - lp)), v2 = lp + w * v1
		bp = 2 * v1 - bp
		lp = 2 * v2 - lp
		let hp = x - k * v1 - v2
		// Tanh saturation synthesizes harmonics above \`fc\`
		data[i] = x + amount * tanh(hp * g) * 0.5
	}

	params._lp = lp
	params._bp = bp

	return data
}

return exciter;
})();
`;