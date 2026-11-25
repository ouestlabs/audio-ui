export const MID_SIDE_KERNELS = `const shifter = (() => {
// Micro-pitch stereo widener (Eventide H3000/MicroShift class) — L detuned up, R detuned
// down by a few cents via 2-head varispeed ring readers, blended with the dry signal.

function shifter (cents, size) {
	let ring = new Float32Array(size)
	let w = 0, r = 0
	let rate = 2 ** (cents / 1200)
	return x => {
		ring[w] = x
		let head = pos => {
			let p = pos % size; if (p < 0) p += size
			let i0 = p | 0, frac = p - i0
			return ring[i0] * (1 - frac) + ring[(i0 + 1) % size] * frac
		}
		let phase = (r % (size / 2)) / (size / 2)
		let g = 1 - Math.abs(2 * phase - 1)
		let y = head(r) * g + head(r + size / 2) * (1 - g)
		r = (r + rate) % size
		w = (w + 1) % size
		return y
	}
}

// The same reader as a block, for a host: its ring and its state, [write position, read position, rate, the sample
// read], in typed arrays made once (a number written to a closure variable per sample is a new object in V8). \`rate\`
// may change between blocks: the read position goes on from where it is, so the pitch moves and nothing jumps
const head = (cents, size) => ({ ring: new Float32Array(size), st: Float64Array.of(0, 0, 2 ** (cents / 1200), 0) })

// one sample x[i] into the head's ring, the two crossfaded heads' value into st[3]: \`shifter\`'s arithmetic
function tap (h, x, i) {
	let ring = h.ring, st = h.st, size = ring.length, r = st[1]
	ring[st[0]] = x[i]
	let p = r % size; if (p < 0) p += size
	let i0 = p | 0, frac = p - i0, a = ring[i0] * (1 - frac) + ring[(i0 + 1) % size] * frac
	p = (r + size / 2) % size; if (p < 0) p += size
	i0 = p | 0; frac = p - i0
	let b = ring[i0] * (1 - frac) + ring[(i0 + 1) % size] * frac
	let phase = (r % (size / 2)) / (size / 2)
	let g = 1 - Math.abs(2 * phase - 1)
	st[3] = a * g + b * (1 - g)
	st[1] = (r + st[2]) % size
	st[0] = (st[0] + 1) % size
}

/** x through head h into y (they may be the same memory), blended with the dry signal by the mix: y = x·(1 − mix) +
 *  shifted·mix, the mix mix[i] for sample i while \`moving\` (1), mix[0] throughout otherwise (an array, as a host hands
 *  a value) */
function shift (h, x, y, mix, moving) {
	let m = mix[0]
	for (let i = 0; i < x.length; i++) {
		if (moving) m = mix[i]
		let v = x[i]
		tap(h, x, i)
		y[i] = v * (1 - m) + h.st[3] * m
	}
}

/**
 * @param {Float32Array[]} [L, R] — modified in place
 * @param {object} opts — { cents=9, mix=0.5, fs=44100 }
 */
function microshift ([L, R], { cents = 9, mix = 0.5, fs = 44100 } = {}) {
	let size = Math.max(256, Math.round(fs * 0.05)), m = Float64Array.of(mix)
	shift(head(cents, size), L, L, m, 0)
	shift(head(-cents, size), R, R, m, 0)
	return [L, R]
}

return shifter;
})();
`;