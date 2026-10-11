// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// models-env.js — the codebase chat's two model ids, read from the build's
// environment. Pure: the environment is passed in.
// -----------------------------------------------------------------------------
// The ids are the Metrale organisation's variables, OPENROUTER_DEFAULT_FREE_MODEL
// (the answer model) and OPENROUTER_RERANK_MODEL, so a model change is one edit
// in the organisation's settings and never a commit here. CI passes them to the
// build as the two variables below (.github/actions/build-site, pr.yml's e2e
// job); vite.config.js reads them through this and serves them to the page as
// the module `virtual:metrale-chat-models`. There is no fallback id: a build
// without both fails, naming what is missing. The embedding model is not here
// at all: the library reads it from each corpus's meta.json, because a
// question embedded by another model would not match the corpus's vectors.
// =============================================================================

export const CHAT_MODEL_ENV = 'METRALE_CHAT_MODEL';
export const RERANK_MODEL_ENV = 'METRALE_RERANK_MODEL';
export const CHAT_MODELS_MODULE = 'virtual:metrale-chat-models';

// An OpenRouter model id: `vendor/model`, optionally with a `:variant` such as `:free`.
const MODEL_ID = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?$/;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ chatModel: string, rerankModel: string }}
 */
export function readChatModels(env) {
  const problems = [];
  const read = (name) => {
    const value = env[name];
    if (value === undefined || value.trim() === '') problems.push(`${name} is not set`);
    else if (!MODEL_ID.test(value.trim()))
      problems.push(`${name}=${JSON.stringify(value)} is not an OpenRouter model id (vendor/model[:variant])`);
    return value?.trim() ?? '';
  };
  const models = { chatModel: read(CHAT_MODEL_ENV), rerankModel: read(RERANK_MODEL_ENV) };
  if (problems.length) {
    throw new Error(
      `the codebase chat's model ids are missing or malformed: ${problems.join('; ')}. ` +
        `CI sets them from the Metrale organisation variables OPENROUTER_DEFAULT_FREE_MODEL and OPENROUTER_RERANK_MODEL; ` +
        `export the same two values to build locally.`
    );
  }
  return models;
}

/** The source of `virtual:metrale-chat-models` for a validated pair. */
export const chatModelsModule = ({ chatModel, rerankModel }) =>
  `export const chatModel = ${JSON.stringify(chatModel)};\nexport const rerankModel = ${JSON.stringify(rerankModel)};\n`;
