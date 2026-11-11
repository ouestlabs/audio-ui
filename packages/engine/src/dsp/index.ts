/**
 * The audio.js processors the registry's devices are built on, in one place:
 * a device's description takes its models, curves and offline processors
 * from here, so a project depends on the engine rather than on each atom.
 * They are the atoms' own, re-exported under the names the devices use.
 */

export { highshelf, lowshelf, magnitude } from "@audio/biquad";
export { compandStream } from "@audio/dynamics-compand";
export { compressorGain } from "@audio/dynamics-compressor";
export { compressor } from "@audio/dynamics-compressor/audio";
export { deesser } from "@audio/dynamics-deesser/audio";
export { expanderGain, upwardExpanderGain } from "@audio/dynamics-expander";
export { expander } from "@audio/dynamics-expander/audio";
export { fet } from "@audio/dynamics-fet/audio";
export { latency as limiterLatency } from "@audio/dynamics-limiter";
export { opto } from "@audio/dynamics-opto/audio";
export { unlimitDeficitGain, unlimitGain } from "@audio/dynamics-unlimit";
export { unlimit } from "@audio/dynamics-unlimit/audio";
export { varimu } from "@audio/dynamics-varimu/audio";
export { vca } from "@audio/dynamics-vca/audio";
export { default as distortion } from "@audio/effect-distortion";
export { default as diodeLadder } from "@audio/filter-diode-ladder";
export { default as korg35 } from "@audio/filter-korg35";
export { default as moogLadder } from "@audio/filter-moog-ladder";
export { default as oberheim } from "@audio/filter-oberheim";
export { default as dattorro } from "@audio/reverb-dattorro";
export { default as fdn } from "@audio/reverb-fdn";
export { default as freeverb } from "@audio/reverb-freeverb";
export { default as schroeder } from "@audio/reverb-schroeder";
export { default as spring } from "@audio/reverb-spring";
