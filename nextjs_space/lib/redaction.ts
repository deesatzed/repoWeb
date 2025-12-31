export interface RedactionOptions {
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 2000;

const SECRET_PATTERNS: RegExp[] = [
  /ghp_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{30,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g,
  /AIzaSy[A-Za-z0-9_-]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
];

function stripFencedCodeBlocks(input: string): string {
  return input.replace(/```[\s\S]*?```/g, '[REDACTED_CODE_BLOCK]');
}

function stripInlineCode(input: string): string {
  return input.replace(/`[^`\n]{1,200}`/g, '[REDACTED_INLINE_CODE]');
}

function redactSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED_SECRET]');
  }
  return out;
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n/g, '\n');
}

export function redactForLLM(input: string, options: RedactionOptions = {}): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  let out = normalizeWhitespace(input ?? '');
  out = stripFencedCodeBlocks(out);
  out = stripInlineCode(out);
  out = redactSecrets(out);
  if (out.length > maxLength) {
    out = out.slice(0, maxLength);
  }
  return out;
}
