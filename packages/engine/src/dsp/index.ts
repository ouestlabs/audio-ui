/**
 * The audio.js processors the registry's devices are built on, in one place:
 * a device's description takes its models, curves and offline processors
 * from here, so a project depends on the engine rather than on each atom.
 * They are the atoms' own, re-exported under the names the devices use.
 */

/** A shelf's cookbook coefficients at a frequency, Q, sample rate and gain, and a filter's magnitude at a frequency. */
export { highshelf, lowshelf, magnitude } from "@audio/biquad";
/** A compander over a stream: its transfer curve of points, applied block after block. */
export { compandStream } from "@audio/dynamics-compand";
/** The gain, in dB, a compressor applies at a level in dB: its threshold, ratio and knee. */
export { compressorGain } from "@audio/dynamics-compressor";
/** The smooth compressor's manifest: an AudioWorklet processor's parameters and state, as its package publishes them. */
export { compressor } from "@audio/dynamics-compressor/audio";
/** The de-esser's manifest: its processor's parameters and latency. */
export { deesser } from "@audio/dynamics-deesser/audio";
/** The gain of a downward and of an upward expander at a level in dB. */
export { expanderGain, upwardExpanderGain } from "@audio/dynamics-expander";
/** The expander's manifest: its processor's parameters and modes. */
export { expander } from "@audio/dynamics-expander/audio";
/** The FET compressor model's manifest. */
export { fet } from "@audio/dynamics-fet/audio";
/** How long the limiter's lookahead delays the sound. */
export { latency as limiterLatency } from "@audio/dynamics-limiter";
/** The opto compressor model's manifest. */
export { opto } from "@audio/dynamics-opto/audio";
/** The gain the de-limiter gives a peak by its size in dB, and against the crest the sound lost. */
export { unlimitDeficitGain, unlimitGain } from "@audio/dynamics-unlimit";
/** The de-limiter's manifest: its processor's parameters. */
export { unlimit } from "@audio/dynamics-unlimit/audio";
/** The vari-mu compressor model's manifest. */
export { varimu } from "@audio/dynamics-varimu/audio";
/** The VCA compressor model's manifest. */
export { vca } from "@audio/dynamics-vca/audio";
/** Waveshaping distortion of a buffer in place, by its curve. */
export { default as distortion } from "@audio/effect-distortion";
/** The diode ladder filter, run over a buffer in place. */
export { default as diodeLadder } from "@audio/filter-diode-ladder";
/** The Korg35 filter, run over a buffer in place. */
export { default as korg35 } from "@audio/filter-korg35";
/** The Moog ladder filter, two or four poles, run over a buffer in place. */
export { default as moogLadder } from "@audio/filter-moog-ladder";
/** The Oberheim SEM state-variable filter, run over a buffer in place. */
export { default as oberheim } from "@audio/filter-oberheim";
/** The Dattorro plate reverb, run over two channels in place. */
export { default as dattorro } from "@audio/reverb-dattorro";
/** The feedback delay network reverb, run over two channels in place. */
export { default as fdn } from "@audio/reverb-fdn";
/** Freeverb, run over two channels in place. */
export { default as freeverb } from "@audio/reverb-freeverb";
/** The Schroeder reverb, run over two channels in place. */
export { default as schroeder } from "@audio/reverb-schroeder";
/** The spring reverb, run over two channels in place. */
export { default as spring } from "@audio/reverb-spring";
