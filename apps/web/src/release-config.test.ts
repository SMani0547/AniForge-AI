import { describe, expect, it } from 'vitest';
import { assertReleaseConfig } from '../release-config';

// Syntactic configuration fixture, not real Firebase credentials or deployment proof.
const fixture = { VITE_FIREBASE_PROJECT_ID: 'aniforge-test-config', VITE_FIREBASE_AUTH_DOMAIN: 'aniforge-test-config.firebaseapp.com', VITE_FIREBASE_API_KEY: `AIza${'x'.repeat(35)}`, VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef1234', VITE_API_BASE_URL: 'https://aniforge-api.test.run.app/api/v1', VITE_ENABLE_ANONYMOUS_AUTH: 'false' };
describe('release configuration boundary', () => {
  it('accepts complete configuration only for the same deployment project', () => {
    expect(() => assertReleaseConfig(fixture, fixture.VITE_FIREBASE_PROJECT_ID)).not.toThrow();
    expect(() => assertReleaseConfig(fixture, 'different-project')).toThrow('does not match');
    expect(() => assertReleaseConfig({})).toThrow('Release configuration blocked');
  });
  it('rejects emulator and accidentally public server settings without printing their values', () => {
    for (const patch of [{ VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099' }, { VITE_FIREBASE_PROJECT_ID: 'demo-aniforge' }, { VITE_GEMINI_API_KEY: 'PRIVATE-VALUE-DO-NOT-PRINT' }, { VITE_FIREBASE_APP_ID: 'PRIVATE-VALUE-DO-NOT-PRINT' }]) {
      try { assertReleaseConfig({ ...fixture, ...patch }); throw new Error('Expected release rejection'); }
      catch (error) { expect(String(error)).toContain('Release configuration blocked'); expect(String(error)).not.toContain('PRIVATE-VALUE-DO-NOT-PRINT'); }
    }
  });
  it('rejects a Vite-only proxy, HTTP, URL credentials and non-API paths', () => {
    for (const url of ['/api/v1', 'http://api.example.org/api/v1', 'https://localhost/api/v1', 'https://user:secret@api.example.org/api/v1', 'https://api.example.org/api/v1?key=secret', 'https://api.example.org/', 'https://api.example.org/api/v1#fragment']) expect(() => assertReleaseConfig({ ...fixture, VITE_API_BASE_URL: url })).toThrow('VITE_API_BASE_URL');
  });
});
