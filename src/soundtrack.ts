import espionage from './assets/music/espionage.mp3?inline';
import experiments from './assets/music/strange-experiments.mp3?inline';
import pynchon from './assets/music/pynchon.mp3?inline';

export const SOUNDTRACK = {
  espionage: { title: 'Espionage', artist: 'brandon75689', source: 'https://opengameart.org/content/espionage', url: espionage },
  experiments: { title: 'Strange Experiments', artist: 'Alexander Ehlers', source: 'https://opengameart.org/content/t-t-free-cyberpunk-pack-2', url: experiments },
  harbor: { title: 'PYNCHON', artist: 'James Gargette', source: 'https://opengameart.org/content/pynchon', url: pynchon },
} as const;
export type TrackId = keyof typeof SOUNDTRACK;
