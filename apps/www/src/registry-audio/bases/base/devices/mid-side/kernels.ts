/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/spatial-microshift` 1.1.3 (MIT, Dmitry Iv.): `shifter`
 */
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

/**
 * @param {Float32Array[]} [L, R] — modified in place
 * @param {object} opts — { cents=9, mix=0.5, fs=44100 }
 */
function microshift ([L, R], { cents = 9, mix = 0.5, fs = 44100 } = {}) {
	let size = Math.max(256, Math.round(fs * 0.05))
	let up = shifter(cents, size), down = shifter(-cents, size)
	for (let i = 0; i < L.length; i++) {
		L[i] = L[i] * (1 - mix) + up(L[i]) * mix
		R[i] = R[i] * (1 - mix) + down(R[i]) * mix
	}
	return [L, R]
}

return shifter;
})();
`;
