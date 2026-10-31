// Bus layout shared by the live engine and the offline self-test.
//
//   sfxDry   -> sfxVol ------------------------------> sum
//   sfxWet   -> sfxVolW ------------------> verbIn
//   musicDry -> musicTone -> musicDuck -> musicVol --> sum
//   musicWet -> musicDuckW -> musicVolW --> verbIn
//   verbIn -> highpass -> convolver(synth IR) --------> sum
//   sum -> masterVol -> [glue compressor -> soft clipper] -> destination

import { reverbIR, softClipCurve } from './dsp';

export interface Mixer {
  ctx: BaseAudioContext;
  sfxDry: GainNode;
  sfxWet: GainNode;
  musicDry: GainNode;
  musicWet: GainNode;
  sfxVol: GainNode;
  sfxVolW: GainNode;
  musicTone: BiquadFilterNode;
  musicDuck: GainNode;
  musicDuckW: GainNode;
  musicVol: GainNode;
  musicVolW: GainNode;
  masterVol: GainNode;
  output: AudioNode;
}

export interface MixerOpts {
  /** glue compressor + safety soft-clip at the end of the chain (on for the game, off for raw measurements) */
  finalStage: boolean;
}

export function createMixer(ctx: BaseAudioContext, dest: AudioNode, opts: MixerOpts): Mixer {
  const g = (v = 1): GainNode => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };
  const sfxDry = g(), sfxWet = g(), musicDry = g(), musicWet = g();
  const sfxVol = g(), sfxVolW = g();
  const musicDuck = g(), musicDuckW = g(), musicVol = g(), musicVolW = g();
  const musicTone = ctx.createBiquadFilter();
  musicTone.type = 'lowpass';
  musicTone.frequency.value = 18000;
  musicTone.Q.value = -3;
  const sum = g();
  const masterVol = g();
  const verbIn = g();
  const verbHp = ctx.createBiquadFilter();
  verbHp.type = 'highpass';
  verbHp.frequency.value = 170;
  verbHp.Q.value = -3;
  const conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = reverbIR(ctx.sampleRate);

  sfxDry.connect(sfxVol).connect(sum);
  sfxWet.connect(sfxVolW).connect(verbIn);
  musicDry.connect(musicTone).connect(musicDuck).connect(musicVol).connect(sum);
  musicWet.connect(musicDuckW).connect(musicVolW).connect(verbIn);
  verbIn.connect(verbHp).connect(conv).connect(sum);
  sum.connect(masterVol);

  let output: AudioNode = masterVol;
  if (opts.finalStage) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    const pre = g(0.5); // soft-clip curve expects input pre-scaled by 0.5 (covers +-2.0)
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = '2x';
    masterVol.connect(comp).connect(pre).connect(clip);
    output = clip;
  }
  output.connect(dest);
  return {
    ctx, sfxDry, sfxWet, musicDry, musicWet, sfxVol, sfxVolW, musicTone,
    musicDuck, musicDuckW, musicVol, musicVolW, masterVol, output,
  };
}
