export const WAH_KERNELS = `const autoWah = (() => {
/**
 * Auto-wah — envelope follower drives resonant bandpass cutoff.
 * Signal level controls filter sweep from base up through range.
 */

let {abs, exp, tan, min, PI} = Math

function autoWah (data, params = {}) {
	let base = params.base ?? 300       // minimum cutoff Hz
	let range = params.range ?? 3000    // sweep range Hz
	let Q = params.Q ?? 5               // filter resonance
	let attack = params.attack ?? 0.002 // envelope attack (seconds)
	let release = params.release ?? 0.1 // envelope release (seconds)
	let sens = params.sens ?? 2         // input sensitivity
	let fs = params.fs || 44100

	let aA = exp(-1 / (attack * fs))
	let aR = exp(-1 / (release * fs))

	if (params._env == null) {
		params._env = 0
		params._lp = 0
		params._bp = 0
	}
	let env = params._env, lp = params._lp, bp = params._bp
	let k = 1 / Q, top = 0.49 * fs

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let level = abs(x) * sens

		// Envelope follower with asymmetric attack/release
		if (level > env) env = aA * env + (1 - aA) * level
		else env = aR * env + (1 - aR) * level

		// Envelope → cutoff frequency
		let freq = base + range * min(1, env)

		// Trapezoidal state-variable bandpass (Zavalishin, The Art of VA Filter Design, ch. 3–4; Simper 2013):
		// stable at any Q, any freq below Nyquist, where Chamberlin's form diverged once f² + 2f/Q > 4
		let g = tan(PI * min(freq, top) / fs)
		let v1 = (bp + g * (x - lp)) / (1 + g * (g + k)), v2 = lp + g * v1
		bp = 2 * v1 - bp
		lp = 2 * v2 - lp
		data[i] = v1
	}

	params._env = env
	params._lp = lp
	params._bp = bp

	return data
}

return autoWah;
})();

const wah = (() => {
/**
 * Wah-wah — swept resonant bandpass filter
 */

let {sin, tan, pow, min, PI} = Math

function wah (data, params = {}) {
	let rate = params.rate == null ? 1.5 : params.rate
	let depth = params.depth == null ? 0.8 : params.depth
	let fc = params.fc || 1000
	let Q = params.Q == null ? 5 : params.Q
	let fs = params.fs || 44100
	let mode = params.mode || 'auto'

	if (params._lp == null) {
		params._lp = 0
		params._bp = 0
		params._phase = 0
	}
	let lp = params._lp, bp = params._bp, phase = params._phase
	let inc = 2 * PI * rate / fs
	let k = 1 / Q, top = 0.49 * fs

	for (let i = 0, l = data.length; i < l; i++) {
		let freq
		if (mode === 'auto') {
			let lfo = sin(phase)
			phase += inc
			if (phase > 2 * PI) phase -= 2 * PI
			freq = fc * pow(2, depth * lfo)
		} else {
			freq = fc
		}

		// trapezoidal state-variable bandpass (Zavalishin, The Art of VA Filter Design, ch. 3–4; Simper 2013):
		// the analog s/(s² + s/Q + 1) mapped bilinearly, prewarped to freq; stable at any Q, any freq below
		// Nyquist. Chamberlin's form (f = 2 sin(π freq/fs)) diverged wherever f² + 2f/Q > 4.
		let g = tan(PI * min(freq, top) / fs)
		let v1 = (bp + g * (data[i] - lp)) / (1 + g * (g + k)), v2 = lp + g * v1
		bp = 2 * v1 - bp
		lp = 2 * v2 - lp
		data[i] = v1
	}

	params._lp = lp
	params._bp = bp
	params._phase = phase

	return data
}

return wah;
})();
`;