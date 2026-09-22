/**
 * Audio conversion utilities for Twilio Media Streams (8kHz G.711 mu-law)
 * and AssemblyAI Voice Agent API (16kHz / 24kHz Linear PCM16).
 */

// G.711 mu-law decoding table
const muLawToPcmTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const mu = ~i;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  muLawToPcmTable[i] = sign !== 0 ? -sample : sample;
}

/**
 * Converts a buffer of 8kHz mu-law audio bytes into 16kHz PCM16 buffer.
 * Performs linear interpolation upsampling (8kHz -> 16kHz).
 */
export function muLaw8kToPcm16k(muLawBuffer: Buffer): Buffer {
  const numSamples = muLawBuffer.length;
  // Upsampling 8kHz to 16kHz doubles the sample count (each sample is 2 bytes in PCM16)
  const outputBuffer = Buffer.alloc(numSamples * 2 * 2);

  for (let i = 0; i < numSamples; i++) {
    const s0 = muLawToPcmTable[muLawBuffer[i]];
    const s1 = i + 1 < numSamples ? muLawToPcmTable[muLawBuffer[i + 1]] : s0;
    const interpolated = Math.round((s0 + s1) / 2);

    outputBuffer.writeInt16LE(s0, i * 4);
    outputBuffer.writeInt16LE(interpolated, i * 4 + 2);
  }

  return outputBuffer;
}

/**
 * Fast encode 16-bit linear PCM sample into 8-bit mu-law.
 */
function pcmSampleToMuLaw(pcm: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;

  let sign = 0;
  if (pcm < 0) {
    pcm = -pcm;
    sign = 0x80;
  }

  if (pcm > CLIP) pcm = CLIP;
  pcm += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }

  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  const mu = ~(sign | (exponent << 4) | mantissa);
  return mu & 0xff;
}

/**
 * Converts a buffer of 16kHz PCM16 audio bytes into 8kHz mu-law buffer for Twilio.
 * Downsamples by dropping alternate samples.
 */
export function pcm16kToMuLaw8k(pcmBuffer: Buffer): Buffer {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const downsampledCount = Math.floor(sampleCount / 2);
  const out = Buffer.alloc(downsampledCount);

  for (let i = 0; i < downsampledCount; i++) {
    const sample = pcmBuffer.readInt16LE(i * 4);
    out[i] = pcmSampleToMuLaw(sample);
  }

  return out;
}
