/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-chorus` 2.0.2 (MIT, Dmitry Iv.): `chorus`
 */
export const CHORUS_KERNELS = `const chorus = (() => {
/**
 * Chorus — multiple detuned delay lines for ensemble thickening
 */

let {sin, floor, PI} = Math

function chorus (data, params = {}) {
	let rate = params.rate == null ? 1.5 : params.rate
	let depth = params.depth == null ? 0.5 : params.depth
	let delay = params.delay == null ? 0.02 : params.delay  // seconds
	let voices = Math.max(1, (params.voices || 3) | 0)  // integer ≥ 1 — wet/voices below
	let fs = params.fs || 44100

	let maxDelay = Math.max(1, Math.floor(delay * 2 * fs))
	let delaySamples = delay * fs

	if (!params.buffer || params.buffer.length < maxDelay) {
		params.buffer = new Float64Array(maxDelay)
		params.ptr = 0
	}
	// voices can change live — a short phase array would feed NaN into the LFOs
	if (!params._phases || params._phases.length !== voices) {
		params._phases = new Float64Array(voices)
		for (let v = 0; v < voices; v++) params._phases[v] = v / voices * 2 * PI
	}
	let buf = params.buffer, ptr = params.ptr, phases = params._phases
	if (ptr >= maxDelay) ptr = 0  // delay shrank live — re-enter the active ring
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		buf[ptr] = x

		let wet = 0
		for (let v = 0; v < voices; v++) {
			let d = delaySamples * (1 + depth * sin(phases[v]))
			phases[v] += inc
			if (phases[v] > 2 * PI) phases[v] -= 2 * PI

			// total wrap — d may reach/exceed maxDelay (depth ≈ 1 vs floored buffer size)
			let readPos = ((ptr - d) % maxDelay + maxDelay) % maxDelay

			let idx = floor(readPos)
			let frac = readPos - idx
			let a = buf[idx % maxDelay]
			let b = buf[(idx + 1) % maxDelay]
			wet += a + frac * (b - a)
		}

		ptr = (ptr + 1) % maxDelay
		data[i] = (x + wet / voices) * 0.5
	}

	params.ptr = ptr

	return data
}

return chorus;
})();
`;
