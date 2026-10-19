# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Web Audio (audio)

**Impact:** CRITICAL  
**Description:** Getting sound out at all, without clicks, at the right level and in time: the audio context, parameter ramps, gain, scheduling and cleanup.

## 2. Live Data (live)

**Impact:** CRITICAL  
**Description:** Meters, spectra, waveforms and playheads follow signals that change every frame, so they read from sources instead of React state.
