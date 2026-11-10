export const PHASER_KERNELS = `const phaser = (() => {
/**
 * Phaser — cascade of swept first-order allpass filters creating moving notches/peaks
 */

let {sin, tan, PI} = Math

function phaser (data, params = {}) {
	let rate = params.rate == null ? 0.5 : params.rate
	let depth = params.depth == null ? 0.7 : params.depth
	let stages = (params.stages || 4) | 0
	let feedback = params.feedback == null ? 0.5 : params.feedback
	let fc = params.fc || 1000
	let fs = params.fs || 44100

	// stages can change live — a short allpass-state array would feed NaN through the cascade
	if (!params._ap || params._ap.length !== stages * 2) {
		params._ap = new Float64Array(stages * 2)
		params._phase ??= 0
		params._fb ??= 0
	}
	let ap = params._ap, phase = params._phase, fb = params._fb
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let lfo = sin(phase)
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI

		let f = fc * (1 + depth * lfo)
		let t = tan(PI * f / fs)
		let a = (t - 1) / (t + 1)

		let x = data[i] + feedback * fb

		for (let s = 0; s < stages; s++) {
			let x1 = ap[s * 2], y1 = ap[s * 2 + 1]
			let y = a * x + x1 - a * y1
			ap[s * 2] = x
			ap[s * 2 + 1] = y
			x = y
		}

		fb = x
		data[i] = (data[i] + x) * 0.5
	}

	params._phase = phase
	params._fb = fb

	return data
}

return phaser;
})();
`;