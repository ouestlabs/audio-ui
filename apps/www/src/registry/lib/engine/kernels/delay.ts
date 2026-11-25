/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-pingpong` 1.2.1 (MIT, Dmitry Iv.): `pingPong`
 * - `@audio/effect-multitap` 1.1.8 (MIT, Dmitry Iv.): `multitap`
 * - `@audio/effect-graindelay` 1.2.1 (MIT, Dmitry Iv.): `graindelay`
 */
export const DELAY_KERNELS = `const pingPong = (() => {
/**
 * Ping-pong delay — stereo: left and right delays alternate.
 * Takes two channel buffers, modifies both in-place.
 */

// The delay in samples a time asks for, at least one so the feedback loop stays causal. A host passes a time as a
// Float32: 10 ms arrives as 0.009999999776, 479.99999 frames at 48 kHz. Within a Float32 step (2^-23 of it) of a whole
// frame it is that frame, so such a time reads one sample, bit for bit as a line of whole frames read it; any other
// time reads between two samples
function delaySamples (time, fs) {
	let d = time * fs, r = Math.round(d)
	if (Math.abs(d - r) <= r * 2 ** -23) d = r
	return Math.max(1, d)
}

// How far the reads may move in a frame, as a tape delay's head runs no slower than half speed and no faster than
// double while its time moves: the echoes bend an octave at most, down while the time grows (by at most half a frame a
// frame, so a move takes twice the increase) and up while it shrinks (a frame a frame, as long as the decrease)
const GROW = 0.5, SHRINK = 1

function pingPong (left, right, params = {}) {
	pingPongInPlace(left, right, params)
	return [left, right]
}

// ping-pong without the pair it returns: what a host's block loop calls, as it may allocate nothing. \`mixes\`, when
// given, holds the mix for each frame (the /audio manifest's glide of a moving mix), in place of params.mix
function pingPongInPlace (left, right, params = {}, mixes) {
	if (left.length !== right.length) throw new RangeError('channel lengths must match')
	let time = params.time ?? 0.25
	let feedback = params.feedback ?? 0.4
	let mix = params.mix ?? 0.5
	let fs = params.fs ?? 44100

	if (!Number.isFinite(time) || time < 0) throw new RangeError('time must be a finite non-negative number of seconds')
	if (!Number.isFinite(fs) || fs <= 0) throw new RangeError('fs must be a finite positive sample rate')
	let d = delaySamples(time, fs)
	if (!(Math.floor(d) + 2 <= Number.MAX_SAFE_INTEGER)) throw new RangeError('delay length must be a safe integer')
	if (!left.length) return

	// a read d samples back takes the samples floor(d) and floor(d) + 1 back. Rings made for a longer time hold this
	// one, so a shorter time keeps every sample at its age; rings too short for it are made anew, empty. Where the last
	// call ended: the time it asked for, and where its reads were (NaN before the first call)
	let ended = params._glide ??= new Float64Array(2).fill(NaN)
	if (!params._bufL || params._bufL.length < Math.floor(d) + 2) {
		params._bufL = new Float64Array(Math.floor(d) + 2)
		params._bufR = new Float64Array(Math.floor(d) + 2)
		params._ptr = 0
		ended[0] = ended[1] = NaN
	}
	let bufL = params._bufL, bufR = params._bufR, N = bufL.length, ptr = params._ptr
	// a new time is reached across this call from the one the last call ended on, so the reads glide (a tape delay's
	// bend) instead of jumping; a host ramps a smoothed \`time\` in short calls, and this joins its steps into one line.
	// The reads follow that line at the speed it asks, up to GROW and SHRINK; a farther move goes on at that speed
	// across the calls that follow, until the reads are on the time
	let from = ended[0] === ended[0] ? ended[0] : d, glide = d - from, at = ended[1] >= 1 ? ended[1] : from

	for (let i = 0, l = left.length; i < l; i++) {
		let want = from + glide * (i + 1) / l
		at = want > at + GROW ? at + GROW : want < at - SHRINK ? at - SHRINK : want
		let D = Math.floor(at), f = at - D
		let r = ptr - D
		if (r < 0) r += N
		let dL = bufL[r]
		let dR = bufR[r]
		if (f) {
			let s = r ? r - 1 : N - 1
			dL += f * (bufL[s] - dL)
			dR += f * (bufR[s] - dR)
		}

		// Cross-feed: left delay feeds right, right feeds left
		bufL[ptr] = left[i] + feedback * dR
		bufR[ptr] = right[i] + feedback * dL

		let m = mixes ? mixes[i] : mix
		left[i] = left[i] * (1 - m) + dL * m
		right[i] = right[i] * (1 - m) + dR * m

		if (++ptr === N) ptr = 0
	}

	params._ptr = ptr
	ended[0] = d
	ended[1] = at
}

return pingPong;
})();

const multitap = (() => {
/**
 * Multi-tap delay — multiple delay taps at different times and gains.
 */

const defaults = [{ time: 0.25, gain: 0.5 }, { time: 0.5, gain: 0.3 }]

// the summed reads of the taps from the ring buf, of N samples, written next at ptr. A function of its own: as a loop
// inside the sample loop it had V8 allocate at every block
function tapsAt (buf, N, ptr, taps) {
	let wet = 0
	for (let k = 0; k < taps.length; k++) {
		let t = taps[k]
		wet += buf[(ptr - t.d + N) % N] * t.gain
	}
	return wet
}

function multitap (data, params = {}) {
	let taps = params.taps || defaults
	let feedback = params.feedback ?? 0
	let fs = params.fs || 44100

	// recompute tap offsets only when params change — steady-state calls allocate nothing.
	// Tracked by reference: replace the taps array to change taps (in-place mutation isn't seen).
	if (params._taps !== taps || params._fs !== fs) {
		let maxDelay = 1  // ≥1 so the ring buffer is never zero-length (taps at time 0)
		params._tapSamples = taps.map(t => {
			let d = Math.round(t.time * fs) | 0  // nearest frame: a Float32 time truncated lands a frame early
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
	let buf = params.buffer, N = buf.length, ptr = params.ptr

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let wet = tapsAt(buf, N, ptr, tapSamples)
		buf[ptr] = x + feedback * wet
		ptr = (ptr + 1) % N
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

let { cos, PI } = Math

// The two heads' sum at sample i of a call of l, at the line's write position w, from the line buf of N samples, left
// in H[8]. Head o of H holds its window position, the samples since its grain began, its delay and its rate; G the
// settings the last call ended on and this call's (time, spray, pitch, jitter at 0–3 and 5–8) and the sample rate (9);
// R the generator. A grain takes its delay and rate where it begins, from the settings glided to that sample. A
// function of its own, as a loop inside the sample loop had V8 allocate at every block; too long for V8 to inline, so
// no fractional number crosses its call (V8 would box it)
function grainsAt (buf, N, w, H, G, R, gN, i, l) {
	let wet = 0, u = (i + 1) / l, fs = G[9]
	for (let o = 0; o < 8; o += 4) {
		let n = H[o]
		if (n < 0) { H[o] = n + 1; continue }  // stagger warmup
		if (H[o + 1] === 0) {                  // retrigger: new scatter + rate
			let time = G[0] + (G[5] - G[0]) * u, spray = G[1] + (G[6] - G[1]) * u
			let pitch = G[2] + (G[7] - G[2]) * u, jitter = G[3] + (G[8] - G[3]) * u
			let off = (time + spray * ((R[0] = (R[0] * 1664525 + 1013904223) >>> 0) / 4294967296)) * fs
			let rate = 2 ** ((pitch + jitter * (((R[0] = (R[0] * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1)) / 12)
			// a grain that reads faster than the line runs begins far enough back that its read never passes the write
			if (rate > 1) off = Math.max(off, 1 + (gN - 1) * (rate - 1))
			H[o + 2] = off; H[o + 3] = rate
		}
		// the read, back from the write: the grain's delay, less what its rate gained on the line since it began
		let k = H[o + 1], back = H[o + 2] - k * (H[o + 3] - 1)
		back = back < 1 ? 1 : back > N - 1 ? N - 1 : back
		let D = Math.floor(back), f = back - D, r = w - D
		if (r < 0) r += N
		let a = buf[r], b = buf[r ? r - 1 : N - 1]
		let win = 0.5 - 0.5 * cos(2 * PI * n / gN)
		wet += (a + f * (b - a)) * win
		if (++n >= gN) { n -= gN; k = -1 }     // grain done → retrigger next sample
		H[o] = n; H[o + 1] = k + 1
	}
	H[8] = wet
}

// \`mixes\`, when given, holds the mix for each sample of \`data\` (the /audio manifest's glide of a moving mix), in place
// of params.mix
function graindelay (data, params = {}, mixes) {
	let time = params.time ?? 0.25           // base delay, s
	let spray = params.spray ?? 0.02         // random extra delay per grain, s
	let pitch = params.pitch ?? 0            // semitones, per-grain transposition
	let jitter = params.jitter ?? 0          // random pitch scatter, semitones
	let grain = params.grain ?? 0.08         // grain length, s
	let feedback = params.feedback ?? 0.3
	let mix = params.mix ?? 0.5
	let fs = params.fs || 44100

	let gN = Math.max(32, (grain * fs) | 0)
	// the farthest read: a grain's delay with its spray and, reading slower than the line runs, a grain more; or as far
	// back as a grain reading faster begins. A line made for longer holds it (the /audio factory makes it for every
	// param's max); one too short is made anew, empty, and the heads start again
	let size = Math.ceil(Math.max((time + spray) * fs + gN, 1 + (gN - 1) * (2 ** (Math.max(0, pitch + jitter) / 12) - 1))) + 2
	if (!params._buf || params._buf.length < size) {
		params._buf = new Float64Array(size)
		params._heads = null
	}
	if (!params._heads) {
		params._w = 0
		params._rnd = Float64Array.of(params.seed ?? 0x9e3779b9)
		// two heads, staggered by half a grain, and their sum
		params._heads = Float64Array.of(0, 0, 0, 1, -(gN >> 1), 0, 0, 1, 0)
		params._glide = Float64Array.of(NaN, NaN, NaN, NaN, gN, 0, 0, 0, 0, fs)
	}
	if (!data.length) return data
	let buf = params._buf, w = params._w, H = params._heads, G = params._glide, R = params._rnd
	let N = buf.length
	G[9] = fs

	// a new grain length stretches both windows from where they are: each head keeps its place in its grain, so the two
	// windows stay half a grain apart and sum to one, and none jumps
	if (G[4] !== gN) { H[0] *= gN / G[4]; H[4] *= gN / G[4]; G[4] = gN }
	// the settings a grain takes glide across the call from those the last call ended on (only finite ones are kept)
	G[5] = time; G[6] = spray; G[7] = pitch; G[8] = jitter
	for (let k = 0; k < 4; k++) if (G[k] !== G[k]) G[k] = G[k + 5]

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		grainsAt(buf, N, w, H, G, R, gN, i, l)
		let wet = H[8]
		buf[w] = x + feedback * wet
		if (++w === N) w = 0
		let m = mixes ? mixes[i] : mix
		data[i] = x * (1 - m) + wet * m
	}
	params._w = w
	for (let k = 0; k < 4; k++) if (Number.isFinite(G[k + 5])) G[k] = G[k + 5]
	return data
}

return graindelay;
})();
`;
