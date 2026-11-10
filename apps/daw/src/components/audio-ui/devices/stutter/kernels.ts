export const STUTTER_KERNELS = `const stutter = (() => {
/**
 * Stutter / beat-repeat — every interval, capture a slice and retrigger it for the
 * rest of the interval (Ableton Beat Repeat class). Edge fades kill retrigger clicks;
 * decay attenuates successive repeats; mix blends against the uninterrupted dry.
 */

function stutter (data, params = {}) {
	let interval = params.interval ?? 0.5    // capture cycle, s
	let slice = params.slice ?? 0.125        // captured slice length, s
	let decay = params.decay ?? 0            // 0..1 amplitude loss per repeat
	let mix = params.mix ?? 1
	let fs = params.fs || 44100

	let iN = Math.max(1, (interval * fs) | 0)
	let sN = Math.max(32, Math.min((slice * fs) | 0, iN))
	let fade = Math.min(64, sN >> 2)

	if (!params._slice || params._slice.length < sN) {
		params._slice = new Float64Array(sN)
		params._pos = 0                        // position within the interval cycle
	}
	let buf = params._slice, pos = params._pos

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let wet
		if (pos < sN) {                        // capture phase — pass dry, record
			buf[pos] = x
			wet = x
		} else {                               // repeat phase
			let k = pos - sN
			let rep = 1 + ((k / sN) | 0)         // repeat number (1-based)
			let n = k % sN
			let g = (1 - decay) ** rep
			let win = Math.min(1, n / fade, (sN - 1 - n) / fade)
			wet = buf[n] * g * win
		}
		data[i] = x * (1 - mix) + wet * mix
		if (++pos >= iN) pos = 0
	}
	params._pos = pos
	return data
}

return stutter;
})();
`;