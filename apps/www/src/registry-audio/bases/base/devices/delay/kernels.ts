/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-pingpong` 1.1.5 (MIT, Dmitry Iv.): `pingPong`
 * - `@audio/effect-multitap` 1.1.6 (MIT, Dmitry Iv.): `multitap`
 * - `@audio/effect-graindelay` 1.1.6 (MIT, Dmitry Iv.): `graindelay`
 */
export const DELAY_KERNELS = `const pingPong = (() => {
/**
 * Ping-pong delay — stereo: left and right delays alternate.
 * Takes two channel buffers, modifies both in-place.
 */

function pingPong (left, right, params = {}) {
	if (left.length !== right.length) throw new RangeError('channel lengths must match')
	let time = params.time ?? 0.25
	let feedback = params.feedback ?? 0.4
	let mix = params.mix ?? 0.5
	let fs = params.fs ?? 44100

	if (!Number.isFinite(time) || time < 0) throw new RangeError('time must be a finite non-negative number of seconds')
	if (!Number.isFinite(fs) || fs <= 0) throw new RangeError('fs must be a finite positive sample rate')
	let delaySamples = Math.max(1, Math.floor(time * fs))
	if (!Number.isSafeInteger(delaySamples)) throw new RangeError('delay length must be a safe integer')
	if (!left.length) return [left, right]

	if (!params._bufL || params._bufL.length !== delaySamples) {
		params._bufL = new Float64Array(delaySamples)
		params._bufR = new Float64Array(delaySamples)
		params._ptr = 0
	}
	let bufL = params._bufL, bufR = params._bufR, ptr = params._ptr

	for (let i = 0, l = left.length; i < l; i++) {
		let dL = bufL[ptr]
		let dR = bufR[ptr]

		// Cross-feed: left delay feeds right, right feeds left
		bufL[ptr] = left[i] + feedback * dR
		bufR[ptr] = right[i] + feedback * dL

		left[i] = left[i] * (1 - mix) + dL * mix
		right[i] = right[i] * (1 - mix) + dR * mix

		ptr = (ptr + 1) % delaySamples
	}

	params._ptr = ptr

	return [left, right]
}

return pingPong;
})();

const multitap = (() => {
/**
 * Multi-tap delay — multiple delay taps at different times and gains.
 */

const defaults = [{ time: 0.25, gain: 0.5 }, { time: 0.5, gain: 0.3 }]

function multitap (data, params = {}) {
	let taps = params.taps || defaults
	let feedback = params.feedback ?? 0
	let fs = params.fs || 44100

	// recompute tap offsets only when params change — steady-state calls allocate nothing.
	// Tracked by reference: replace the taps array to change taps (in-place mutation isn't seen).
	if (params._taps !== taps || params._fs !== fs) {
		let maxDelay = 1  // ≥1 so the ring buffer is never zero-length (taps at time 0)
		params._tapSamples = taps.map(t => {
			let d = (t.time * fs) | 0
			if (d > maxDelay) maxDelay = d
			return { d, gain: t.gain ?? 0.5 }
		})
		params._maxDelay = maxDelay
		params._taps = taps
		params._fs = fs
	}
	let tapSamples = params._tapSamples

	if (!params.buffer || params.buffer.length < params._maxDelay) {
		params.buffer = new Float64Array(params._maxDelay)
		params.ptr = 0
	}
	let buf = params.buffer, ptr = params.ptr

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let wet = 0
		for (let t of tapSamples) {
			let idx = (ptr - t.d + buf.length) % buf.length
			wet += buf[idx] * t.gain
		}
		buf[ptr] = x + feedback * wet
		ptr = (ptr + 1) % buf.length
		data[i] = x + wet
	}

	params.ptr = ptr

	return data
}

return multitap;
})();

const graindelay = (() => {
/**
 * Granular delay — grains read from the delay line with per-grain delay scatter and
 * pitch transposition (Ableton Grain Delay class). Two staggered Hann-windowed heads
 * retrigger every half grain; feedback writes the wet grain stream back into the line.
 */

let { sin, cos, PI } = Math

function graindelay (data, params = {}) {
	let time = params.time ?? 0.25           // base delay, s
	let spray = params.spray ?? 0.02         // random extra delay per grain, s
	let pitch = params.pitch ?? 0            // semitones, per-grain transposition
	let jitter = params.jitter ?? 0          // random pitch scatter, semitones
	let grain = params.grain ?? 0.08         // grain length, s
	let feedback = params.feedback ?? 0.3
	let mix = params.mix ?? 0.5
	let fs = params.fs || 44100

	let gN = Math.max(32, (grain * fs) | 0)
	let size = Math.ceil((time + spray + grain) * fs * 2 ** Math.max(0, (pitch + jitter) / 12)) + gN + 2
	if (!params._buf || params._buf.length < size) {
		params._buf = new Float64Array(size)
		params._w = 0
		params._rnd = params.seed ?? 0x9e3779b9
		// two heads, staggered by half a grain
		params._heads = [{ n: 0 }, { n: -(gN >> 1) }].map(h => ({ ...h, start: 0, off: time * fs, rate: 1 }))
	}
	let buf = params._buf, w = params._w, heads = params._heads
	let N = buf.length
	let rnd = () => ((params._rnd = (params._rnd * 1664525 + 1013904223) >>> 0) / 4294967296)

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let wet = 0
		for (let h of heads) {
			if (h.n < 0) { h.n++; continue }       // stagger warmup
			if (h.n === 0) {                       // retrigger: new scatter + rate
				h.start = w
				h.off = (time + spray * rnd()) * fs
				h.rate = 2 ** ((pitch + jitter * (rnd() * 2 - 1)) / 12)
			}
			let pos = h.start - h.off + h.n * h.rate
			let base = Math.floor(pos), frac = pos - base
			let a = buf[((base % N) + N) % N], b = buf[(((base + 1) % N) + N) % N]
			let win = 0.5 - 0.5 * cos(2 * PI * h.n / gN)
			wet += (a + frac * (b - a)) * win
			if (++h.n >= gN) h.n = 0               // grain done → retrigger next sample
		}
		buf[w] = x + feedback * wet
		w = (w + 1) % N
		data[i] = x * (1 - mix) + wet * mix
	}
	params._w = w
	return data
}

return graindelay;
})();
`;
