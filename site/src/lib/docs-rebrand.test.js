// The docs rebrand: the words change, the names of things do not.
import { describe, expect, test } from 'bun:test';
import { RENAMES, leftovers, rebrand } from '../../../docs/rebrand.mjs';

describe('rebrand', () => {
  test('the capitalised name becomes the product name, in prose and in the title', () => {
    expect(rebrand('Atlas serves an OpenAI-compatible API.')).toBe('Metrale Engine serves an OpenAI-compatible API.');
    expect(rebrand('title = "The Atlas Book"')).toBe('title = "The Metrale Engine Book"');
    expect(rebrand('A guide to Atlas — pure-Rust inference.')).toBe('A guide to Metrale Engine — pure-Rust inference.');
    expect(rebrand('Atlas Inference Engine and Atlas Inference')).toBe('Metrale Engine and Metrale Engine');
  });

  test('commands, crates, repositories, identifiers and environment names stay', () => {
    for (const s of [
      'atlasctl status',
      'atlas serve --model qwen',
      'the atlas-recipes repository',
      'https://github.com/Avarok-Cybersecurity/atlas/blob/main/README.md',
      'struct AtlasConfig',
      'export ATLAS_HOME=/opt/atlas',
      '/usr/local/bin/atlas',
      'atlas.toml',
    ]) {
      expect(rebrand(s)).toBe(s);
    }
  });

  test('hosts move as hosts, inside addresses', () => {
    expect(rebrand('https://docs.atlascybernetics.ai/getting-started/')).toBe('https://docs.metrale.ai/getting-started/');
    expect(rebrand('blog.atlascybernetics.ai and atlascybernetics.ai')).toBe('blog.metrale.ai and metrale.ai');
  });

  test('longer phrases are listed before shorter ones, so nothing is half replaced', () => {
    for (let i = 1; i < RENAMES.length; i++) {
      const [prev] = RENAMES[i - 1];
      const [cur] = RENAMES[i];
      if (prev.includes(cur)) expect(prev.length).toBeGreaterThan(cur.length);
    }
  });

  test('the leftover finder sees what a reader would', () => {
    expect(leftovers('nothing here')).toEqual([]);
    expect(leftovers(rebrand('Atlas is fast. atlasctl is the tool.'))).toEqual([]);
    expect(leftovers('Run Atlas now').length).toBe(1);
  });
});
