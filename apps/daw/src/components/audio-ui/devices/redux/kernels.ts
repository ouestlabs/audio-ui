export const REDUX_KERNELS = `const bitcrusher = (() => {
/**
 * Bitcrusher — sample-rate reduction + bit-depth quantization.
 */

let {round, pow} = Math

function bitcrusher (data, params = {}) {
	let bits = params.bits ?? 8        // target bit depth (1–24)
	let rate = params.rate ?? 0.25     // sample rate ratio: 1 = full, 0.25 = quarter rate
	let fs = params.fs || 44100

	let step = 1 / rate                // hold length in samples
	let levels = pow(2, bits - 1)      // quantization levels per polarity

	if (params._held == null) {
		params._held = 0
		params._phase = 0
	}
	let held = params._held, phase = params._phase

	for (let i = 0, l = data.length; i < l; i++) {
		phase += 1
		if (phase >= step) {
			phase -= step
			held = round(data[i] * levels) / levels
		}
		data[i] = held
	}

	params._held = held
	params._phase = phase

	return data
}

return bitcrusher;
})();

const noiseShaping = (() => {
/**
 * Noise shaping — error-feedback dithering for bit-depth reduction.
 */

function noiseShaping (data, params = {}) {
	let bits = params.bits || 16
	let scale = Math.pow(2, bits - 1)

	if (!params._fb) params._fb = 0
	let fb = params._fb

	for (let i = 0; i < data.length; i++) {
		let x = data[i] + fb
		let q = Math.round(x * scale) / scale
		// feed back the quantizer's own error: the output error is then e[n] − e[n−1],
		// bounded by one step and shaped toward Nyquist (measuring it against the input
		// fed the correction back into itself: it random-walked, 19× full scale at 1 bit)
		fb = x - q
		data[i] = q
	}

	params._fb = fb
	return data
}

return noiseShaping;
})();
`;