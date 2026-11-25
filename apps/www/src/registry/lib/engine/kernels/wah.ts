/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-autowah` 1.1.7 (MIT, Dmitry Iv.): `autoWah`
 * - `@audio/effect-wah` 1.2.1 (MIT, Dmitry Iv.): `wah`
 */
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
	// stereo, in mode 'auto': channel c's LFO runs c × \`phase\` degrees ahead of channel 0's; default 0 moves the channels
	// together, and 180 sweeps them opposite ways, as the LFO Phase of Ableton Live 12's Auto Filter: "The left and right
	// modulation channels can be offset in degrees using the LFO Phase control. At 180°, the channels are perfectly out of
	// phase, so that when one LFO reaches its peak, the other is at its minimum."
	let offset = params.phase == null ? 0 : params.phase
	let channel = params.channel || 0  // index of the channel this call processes
	let lead = channel ? channel * offset * PI / 180 : 0  // rad; 0 on channel 0, so a mono signal never depends on phase
	// a new lead is reached across this call from the one the last call ended on, so the sweep glides instead of jumping;
	// a host ramps a smoothed \`phase\` in short calls, and this joins its steps into one line
	// where the last call ended, for this one to glide from: NaN before the first call (only finite values are kept,
	// in a Float64Array: kept as numbers on the params object, they boxed in V8 once two instances had run)
	let ended = params._glide ??= new Float64Array(2).fill(NaN)
	let from = ended[0] === ended[0] ? ended[0] : lead, glide = lead - from
	// fc retunes the filter every sample, so a new fc glides across the call in the same way: a host ramps a smoothed fc
	// in short calls, and the filter follows it sample by sample instead of stepping at each call
	let fcFrom = ended[1] === ended[1] ? ended[1] : fc, fcGlide = fc - fcFrom

	if (params._lp == null) {
		params._lp = 0
		params._bp = 0
		params._phase = 0
	}
	let lp = params._lp, bp = params._bp, phase = params._phase
	let inc = 2 * PI * rate / fs
	let k = 1 / Q, top = 0.49 * fs

	for (let i = 0, l = data.length; i < l; i++) {
		let freq, f0 = fcFrom + fcGlide * (i + 1) / l
		if (mode === 'auto') {
			let lfo = sin(phase + from + glide * (i + 1) / l)
			phase += inc
			if (phase > 2 * PI) phase -= 2 * PI
			freq = f0 * pow(2, depth * lfo)
		} else {
			freq = f0
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
	// kept only when finite, so the next call never glides from a value that is not finite
	if (data.length && Number.isFinite(lead)) ended[0] = lead
	if (data.length && Number.isFinite(fc)) ended[1] = fc

	return data
}

return wah;
})();
`;
