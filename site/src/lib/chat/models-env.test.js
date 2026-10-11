// SPDX-License-Identifier: AGPL-3.0-only
//
// The chat's model ids come from the build's environment and have no fallback:
// a build without them must stop, saying which is missing.

import { describe, expect, test } from 'bun:test';
import { CHAT_MODEL_ENV, RERANK_MODEL_ENV, chatModelsModule, readChatModels } from './models-env.js';

const env = {
  [CHAT_MODEL_ENV]: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  [RERANK_MODEL_ENV]: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
};

describe('readChatModels', () => {
  test('reads both ids', () => {
    expect(readChatModels(env)).toEqual({
      chatModel: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      rerankModel: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
    });
  });

  test('trims the newline a variable copied from a file carries', () => {
    expect(readChatModels({ ...env, [CHAT_MODEL_ENV]: ' vendor/model:free\n' }).chatModel).toBe('vendor/model:free');
  });

  test('a missing id stops the build, naming the variable', () => {
    expect(() => readChatModels({ [RERANK_MODEL_ENV]: env[RERANK_MODEL_ENV] })).toThrow(`${CHAT_MODEL_ENV} is not set`);
    expect(() => readChatModels({ [CHAT_MODEL_ENV]: env[CHAT_MODEL_ENV] })).toThrow(`${RERANK_MODEL_ENV} is not set`);
  });

  // `${{ vars.X }}` of a variable that does not exist is the empty string, not an absent one.
  test('an empty id is missing too', () => {
    expect(() => readChatModels({ ...env, [CHAT_MODEL_ENV]: '' })).toThrow(`${CHAT_MODEL_ENV} is not set`);
  });

  test('both missing are reported together', () => {
    expect(() => readChatModels({})).toThrow(new RegExp(`${CHAT_MODEL_ENV} is not set; ${RERANK_MODEL_ENV} is not set`));
  });

  test('a value that is not a model id is refused', () => {
    expect(() => readChatModels({ ...env, [RERANK_MODEL_ENV]: 'rerank model' })).toThrow('is not an OpenRouter model id');
    expect(() => readChatModels({ ...env, [RERANK_MODEL_ENV]: 'nvidia' })).toThrow('is not an OpenRouter model id');
  });
});

test('the generated module exports both ids as string literals', async () => {
  const source = chatModelsModule(readChatModels(env));
  const mod = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  expect(mod.chatModel).toBe(env[CHAT_MODEL_ENV]);
  expect(mod.rerankModel).toBe(env[RERANK_MODEL_ENV]);
});
