import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const review = readFileSync(new URL('../.github/workflows/claude-code-review.yml', import.meta.url), 'utf8');
const adversarial = readFileSync(new URL('../.github/workflows/adversarial-review.yml', import.meta.url), 'utf8');

function inlineCommentHookCommand(workflow) {
  const lines = workflow.split('\n');
  const index = lines.findIndex((line) => line.trim() === 'settings: |');
  if (index < 0) throw new Error('Missing inline-review hook settings');

  const jsonLines = [];
  for (const line of lines.slice(index + 1)) {
    if (!line.startsWith('            ')) break;
    jsonLines.push(line.slice(12));
  }
  const settings = JSON.parse(jsonLines.join('\n'));
  const hook = settings.hooks?.PreToolUse?.[0];
  if (hook?.matcher !== 'mcp__github_inline_comment__create_inline_comment' ||
      hook.hooks?.[0]?.type !== 'command') {
    throw new Error('Expected the inline-comment PreToolUse guard');
  }
  return hook.hooks[0].command;
}

describe('Haiku-only CI review configuration', () => {
  it('uses Haiku for every model and forces it for delegated review agents', () => {
    expect(review).toContain('--model haiku');
    expect(adversarial).toContain('adversarial-review --provider claude --model haiku');
    for (const workflow of [review, adversarial]) {
      expect(workflow).toContain('CLAUDE_CODE_SUBAGENT_MODEL: haiku');
      expect(workflow).toContain("CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1'");
      expect(workflow).not.toMatch(/--model (?:sonnet|opus|claude-sonnet|claude-opus)/u);
    }
    expect(review).toContain("classify_inline_comments: 'false'");
  });

  it.each([
    ['confirmed', { tool_input: { confirmed: true } }, 0],
    ['missing', { tool_input: {} }, 2],
    ['false', { tool_input: { confirmed: false } }, 2],
    ['string', { tool_input: { confirmed: 'true' } }, 2],
    ['null', { tool_input: { confirmed: null } }, 2]
  ])('%s confirmation gives the expected hook exit status', (_name, input, expected) => {
    const result = spawnSync('sh', ['-c', inlineCommentHookCommand(review)], {
      input: JSON.stringify(input),
      encoding: 'utf8'
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(expected);
  });

  it('rejects malformed hook input', () => {
    const result = spawnSync('sh', ['-c', inlineCommentHookCommand(review)], {
      input: '{not valid JSON}',
      encoding: 'utf8'
    });
    expect(result.status).toBe(2);
  });
});
