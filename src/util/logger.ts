/** Minimal dependency-free console logger with ANSI colours. */

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(color: keyof typeof COLORS, text: string): string {
  return useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

export const log = {
  info(msg: string): void {
    console.log(`${paint('blue', '•')} ${msg}`);
  },
  step(n: number, total: number, msg: string): void {
    const tag = paint('cyan', `[${String(n).padStart(2, '0')}/${total}]`);
    console.log(`${tag} ${msg}`);
  },
  success(msg: string): void {
    console.log(`${paint('green', '✓')} ${msg}`);
  },
  warn(msg: string): void {
    console.warn(`${paint('yellow', '!')} ${msg}`);
  },
  error(msg: string): void {
    console.error(`${paint('red', '✗')} ${msg}`);
  },
  detail(msg: string): void {
    console.log(`  ${paint('dim', msg)}`);
  },
  banner(msg: string): void {
    console.log(`\n${paint('magenta', msg)}`);
  },
};
