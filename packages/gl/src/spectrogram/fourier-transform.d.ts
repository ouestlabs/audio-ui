/** The one function of `fourier-transform` the spectra use: the DFT of a real signal, its bins from DC to Nyquist, unnormalized. */
declare module "fourier-transform" {
  export function fft(
    input: ArrayLike<number>,
    output?: [Float64Array, Float64Array]
  ): [Float64Array, Float64Array];
}
