// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// copy.js — every word Metrale Prime's surface shows. Same voice rules as the
// rest of the site: plain sentences, no exclamation marks, no em dashes.
// =============================================================================

export const prime = {
  name: 'Metrale Prime',
  mark: 'M′',
  kicker: 'the site, answered',
  launcher: { label: 'Ask M′', aria: 'Open Metrale Prime, the guide to this site' },
  close: 'Close the guide',
  reset: 'Start over',
  welcome: {
    title: 'Ask me anything on this site.',
    body: 'I read every page here, the engine documentation, the blog and the repository history, and I cite the page an answer comes from. Say who you are and I will pitch the answer to you.',
  },
  audiences: [
    {
      id: 'infra',
      label: 'I run GPUs at scale',
      starters: [
        'How much faster is it than vLLM on the same box, and where is the receipt?',
        'What does a four week proof of value involve, and what do you need from us?',
        'Run the payback model for 256 GPUs at 60 percent utilization.',
      ],
    },
    {
      id: 'investor',
      label: 'I am evaluating an investment',
      starters: [
        'Who is on the team, and what did each of them do before?',
        'On this site, what is measured, what is modeled, and what is proposed?',
        'How is the product priced, and how does open source fit the business?',
      ],
    },
    {
      id: 'contributor',
      label: 'I want to contribute',
      starters: [
        'How do I install the engine and run a recipe?',
        'Where should a first contribution go, and how does a change land?',
        'What gates does a kernel change have to pass before it merges?',
      ],
    },
    {
      id: 'curious',
      label: 'Just looking',
      starters: ['What is Metrale, in one paragraph?', 'What does the console do?', 'What happened in January 2026?'],
    },
  ],
  phase: {
    reading: 'reading the site',
    searching: 'searching',
    tool: 'working',
    reasoning: 'thinking',
    writing: 'writing',
  },
  thinking: {
    label: 'thinking',
    show: 'show',
    hide: 'hide',
    took: 'thought for',
    steps: 'steps',
  },
  sources: { heading: 'Sources', partner: 'partner document', cited: 'cited', more: 'also read' },
  telemetry: {
    heading: 'Response times, this session',
    avg: 'average',
    last: 'last',
    first: 'first token',
    total: 'total',
    tokens: 'tokens',
    cached: 'cached',
    rate: 'tok/s',
    thinking: 'thinking',
    cost: 'cost',
    session: 'session',
    answers: 'answers',
    none: 'No answers yet.',
    ms: 'ms',
  },
  composer: {
    placeholder: 'Ask about the platform, the numbers, the team, the repository',
    send: 'Send',
    stop: 'Stop',
    hint: 'Enter sends. Shift and Enter starts a new line.',
  },
  fine: 'Answers cite the page they come from. Not a quote, not advice.',
  runs: 'Runs on',
  via: 'via xAI',
  partner: {
    label: 'Partner code',
    // The group around the field, named by its purpose so a screen reader does
    // not hear "Partner code, group" and then "Partner code, edit text".
    group: 'Partner access',
    placeholder: 'the code the team gave you',
    apply: 'Unlock',
    on: 'Partner documents unlocked',
    off: 'Lock',
    hint: 'With a code from the team, the deck and the plan answer too.',
  },
  copy: 'Copy',
  copied: 'Copied',
  errors: {
    off: 'The guide is not switched on for this build.',
    network: 'The guide could not be reached. Check the connection and try again.',
    busy: 'The model is busy. Try again in a few seconds.',
    upstream: 'The model did not answer. Try again, and if it repeats, the contact page reaches a person.',
    internal: 'Something went wrong on our side. Ask again in other words.',
    budget: 'The guide has reached its budget for today. Every page still answers by itself, and the contact page reaches a person.',
    rate: 'Too many questions in a row. Give it a minute.',
    empty: 'No answer came back. Ask again in other words.',
    aborted: 'Stopped.',
  },
};
