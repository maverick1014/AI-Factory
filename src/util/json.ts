/**
 * Tolerant extraction of JSON and code from model output.
 *
 * Even with structured outputs the safest consumer strips Markdown fences and
 * locates the first complete JSON value, so these helpers double as a fallback
 * when running against a model/SDK that doesn't honour `output_config.format`.
 */

/** Remove a leading/trailing Markdown code fence (``` or ```lang). */
export function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n?```$/;
  const match = trimmed.match(fence);
  return match ? match[1]!.trim() : trimmed;
}

/** Extract raw source code, dropping any surrounding Markdown fence. */
export function extractCode(text: string): string {
  return stripFences(text);
}

/**
 * Locate and parse the first complete JSON object/array in `text`.
 * Scans bracket depth while respecting string literals and escapes.
 */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = stripFences(text);

  // Fast path: the whole thing is already valid JSON.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to bracket scan
  }

  const start = firstJsonStart(cleaned);
  if (start === -1) {
    throw new JsonParseError(text);
  }

  const open = cleaned[start]!;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          throw new JsonParseError(text);
        }
      }
    }
  }

  throw new JsonParseError(text);
}

function firstJsonStart(text: string): number {
  const obj = text.indexOf('{');
  const arr = text.indexOf('[');
  if (obj === -1) return arr;
  if (arr === -1) return obj;
  return Math.min(obj, arr);
}

export class JsonParseError extends Error {
  constructor(public readonly raw: string) {
    super('Could not extract JSON from model output');
    this.name = 'JsonParseError';
  }
}
