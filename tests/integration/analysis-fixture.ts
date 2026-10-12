import type { ShotPlan } from '@aniforge/shared';

/** Explicit browser-test fixture only; never loaded by the application runtime. */
export const analysisFixturePlan: ShotPlan = {
  sceneSummary: 'TEST FIXTURE: original geometric study',
  subjects: [{ name: 'Blue geometric shape', appearance: 'Original blue rectangle with clean edges' }],
  action: 'A gentle upward movement',
  camera: { shotType: 'Wide', movement: 'Static' },
  environment: 'A plain dark background', mood: 'Calm',
  animationPrompt: 'TEST FIXTURE: move the original blue geometric shape gently upward for six seconds.',
  preserve: ['Blue color', 'Original silhouette'], uncertainties: ['Motion is a suggestion'],
};
