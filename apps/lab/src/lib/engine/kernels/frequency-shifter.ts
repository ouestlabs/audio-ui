export const FREQUENCY_SHIFTER_KERNELS = `const frequencyShifter = (() => {
/**
 * Frequency shifter — single-sideband shift via Hilbert transform.
 * Unlike ring-mod (which produces sum & difference), this shifts every
 * frequency by a fixed offset: y(t) = Re{(x + j·x̂) · e^{jωt}}.
 * Breaks harmonic relationships — inharmonic, non-transposing.
 */

let {sin, cos, PI} = Math

function hilbertCoefs (N) {
	// Windowed Hilbert FIR: odd taps = 2/(π·n), even taps = 0, Hamming window.
	let h = new Float64Array(N)
	let M = (N - 1) >> 1
	for (let i = 0; i < N; i++) {
		let n = i - M
		if (n !== 0 && (n & 1)) h[i] = 2 / (PI * n)
	}
	for (let i = 0; i < N; i++) {
		h[i] *= 0.54 - 0.46 * cos(2 * PI * i / (N - 1))
	}
	return h
}

function frequencyShifter (data, params = {}) {
	let shift = params.shift ?? 100      // Hz (+up, -down)
	let mix   = params.mix   ?? 1        // wet/dry
	let taps  = params.taps  || 65       // Hilbert FIR length (odd)
	let fs    = params.fs    || 44100

	if (!params._h || params._h.length !== taps) {
		params._h = hilbertCoefs(taps)
		params._buf = new Float64Array(taps)
		params._p = 0
		params._phase = 0
	}
	let h = params._h, buf = params._buf
	let N = taps, M = (N - 1) >> 1
	let p = params._p, phase = params._phase
	let inc = 2 * PI * shift / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		buf[p] = x

		// Convolve with Hilbert FIR → imaginary (90°-shifted) part
		let imag = 0, idx = p
		for (let k = 0; k < N; k++) {
			imag += buf[idx] * h[k]
			idx = idx === 0 ? N - 1 : idx - 1
		}
		// Delayed dry = real part (aligns with Hilbert group delay)
		let real = buf[(p - M + N) % N]

		let c = cos(phase), s = sin(phase)
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI
		else if (phase < 0) phase += 2 * PI

		// Upper-sideband shift: Re{(real + j·imag)(cos + j·sin)}
		let y = real * c - imag * s

		// Blend against the group-delay-aligned dry (\`real\`, M samples back) — an
		// undelayed dry would comb with the wet at mix < 1. Output delay is a
		// constant M at every mix, matching the declared atom latency.
		data[i] = real * (1 - mix) + y * mix
		p = (p + 1) % N
	}

	params._p = p
	params._phase = phase

	return data
}

return frequencyShifter;
})();

const ringMod = (() => {
/**
 * Ring modulator — multiplies signal by a carrier oscillator
 */

let {sin, PI} = Math

function ringMod (data, params = {}) {
	let fc = params.fc || 440
	let fs = params.fs || 44100
	let mix = params.mix == null ? 1 : params.mix

	if (params._phase == null) params._phase = 0
	let phase = params._phase
	let inc = 2 * PI * fc / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let carrier = sin(phase)
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI
		data[i] = data[i] * (1 - mix) + data[i] * carrier * mix
	}

	params._phase = phase

	return data
}

return ringMod;
})();
`;