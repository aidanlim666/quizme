#!/usr/bin/env node
// Validates the question bank: schema, unique ids, answer consistency.
// Usage: node scripts/validate-questions.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gradeText, gradeMcq, displayAnswer } from '../web/src/grading.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const qdir = path.join(root, 'web', 'questions');

const KNOWN_KEYS = new Set([
  'id', 'topic', 'difficulty', 'type', 'prompt', 'choices', 'answer',
  'match', 'tolerance', 'display', 'explanation', 'shuffle',
]);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function checkQuestion(q, topicId, file, seen) {
  const where = `${file} ${q?.id ?? '(no id)'}`;
  if (typeof q !== 'object' || q === null) return err(file, 'entry is not an object');

  for (const k of Object.keys(q)) if (!KNOWN_KEYS.has(k)) warn(where, `unknown key "${k}"`);

  if (!isNonEmptyString(q.id) || !/^[a-z]+-\d{3}$/.test(q.id)) err(where, 'id must look like "os-001"');
  else if (seen.has(q.id)) err(where, `duplicate id (also in ${seen.get(q.id)})`);
  else seen.set(q.id, file);

  if (q.topic !== topicId) err(where, `topic "${q.topic}" does not match file topic "${topicId}"`);
  if (![1, 2, 3].includes(q.difficulty)) err(where, 'difficulty must be 1, 2 or 3');
  if (!isNonEmptyString(q.prompt)) err(where, 'prompt is required');
  if (!isNonEmptyString(q.explanation)) err(where, 'explanation is required');
  if ((q.prompt?.match(/\$/g)?.length ?? 0) % 2) warn(where, 'odd number of $ in prompt (unbalanced math?)');

  if (q.type === 'mcq') {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6) {
      return err(where, 'mcq needs 2–6 choices');
    }
    if (!q.choices.every(isNonEmptyString)) err(where, 'every choice must be a non-empty string');
    if (new Set(q.choices).size !== q.choices.length) err(where, 'duplicate choices');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) {
      err(where, `answer must be a choice index 0..${q.choices.length - 1}`);
    } else if (!gradeMcq(q, q.answer)) {
      err(where, 'answer index does not grade as correct');
    }
    for (const c of q.choices) {
      if (/\b(all|none|both) of the above\b/i.test(c)) err(where, `"${c}" breaks when choices are shuffled`);
    }
    if (q.match || q.tolerance !== undefined) warn(where, 'match/tolerance are ignored for mcq');
  } else if (q.type === 'text') {
    const match = q.match ?? 'exact';
    if (!['exact', 'numeric', 'regex'].includes(match)) return err(where, `unknown match "${match}"`);
    if (!Array.isArray(q.answer) || !q.answer.length || !q.answer.every(isNonEmptyString)) {
      return err(where, 'text answer must be a non-empty array of strings');
    }
    if (match === 'numeric') {
      for (const a of q.answer) {
        const n = Number(a);
        if (Number.isNaN(n)) err(where, `numeric answer "${a}" is not a number`);
      }
      if (q.tolerance !== undefined && !(typeof q.tolerance === 'number' && q.tolerance >= 0)) {
        err(where, 'tolerance must be a non-negative number');
      }
    }
    if (match === 'regex') {
      for (const p of q.answer) {
        try { new RegExp(p, 'i'); } catch (e) { err(where, `invalid regex ${p}: ${e.message}`); }
        if (!p.startsWith('^') || !p.endsWith('$')) warn(where, `regex ${p} should be anchored with ^...$`);
      }
      if (!isNonEmptyString(q.display)) err(where, 'regex questions need a "display" answer');
    }
    // The answer shown on reveal must be accepted when typed back. Otherwise the user is stuck.
    const shown = displayAnswer(q);
    const typed = match === 'regex' ? shown.replace(/\s*\(.*\)\s*$/, '') : shown;
    if (!gradeText(q, typed)) err(where, `revealed answer "${shown}" is not accepted when typed`);
  } else {
    err(where, `type must be "mcq" or "text" (got ${JSON.stringify(q.type)})`);
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(qdir, 'topics.json'), 'utf8'));
  const seen = new Map();
  const counts = [];

  for (const t of manifest.topics) {
    if (!isNonEmptyString(t.id) || !isNonEmptyString(t.name) || !isNonEmptyString(t.file)) {
      err('topics.json', `bad topic entry ${JSON.stringify(t)}`);
      continue;
    }
    let questions;
    try {
      questions = JSON.parse(await readFile(path.join(qdir, t.file), 'utf8'));
    } catch (e) {
      err(t.file, `cannot read/parse: ${e.message}`);
      continue;
    }
    if (!Array.isArray(questions)) {
      err(t.file, 'file must contain a JSON array of questions');
      continue;
    }
    questions.forEach((q) => checkQuestion(q, t.id, t.file, seen));
    const mcq = questions.filter((q) => q.type === 'mcq').length;
    counts.push({ topic: t.name, total: questions.length, mcq, text: questions.length - mcq });
  }

  console.table(counts);
  console.log(`Total questions: ${seen.size}`);
  for (const w of warnings) console.warn(`warn  ${w}`);
  for (const e of errors) console.error(`error ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} error(s).`);
    process.exit(1);
  }
  console.log('Question bank OK.');
}

main();
