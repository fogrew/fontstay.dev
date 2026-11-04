import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  CATEGORIES,
  type Category,
  EXPORT_FORMATS,
  type ExportFormat,
  type FitOutput,
  FitRunError,
  FontParseError,
  fitFiles,
  OS_IDS,
  type OsId,
} from './index';

export const USAGE = `Usage: fontstay fit <font-file...> [options]

Generate metric-adjusted fallback @font-face rules for web fonts.

Options:
  -s, --systems <list>     Comma-separated systems to fit: ${OS_IDS.join(', ')}
                           (default: every system in the audience)
  -a, --audience <query>   Browserslist query, optionally with "os <system>" and
                           "not os <system>" parts (default: baseline widely available)
  -f, --format <format>    ${EXPORT_FORMATS.join(', ')} (default: css)
  -k, --kind <kind>        Fallback kind: ${CATEGORIES.join(', ')} (default: detected from the font)
      --locale <en|ru>     Frequency profile for the fit (default: en)
      --unicode-range      Add unicode-range from the glyphs the font covers
      --no-scripts         Do not emit separate faces for other scripts
  -o, --out <file>         Write the output to a file instead of stdout
      --json               Print a JSON report (output, picks, shares) instead of the file text
  -h, --help               Show this help
  -v, --version            Show the version
`;

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const LOW_COVERAGE = 0.9;

class UsageError extends Error {}

function choice<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`Invalid ${flag} "${value}". Expected one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function systemsOf(value: string): OsId[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => choice(item, OS_IDS, '--systems entry'));
}

function reportOf({ css: _css, ...rest }: FitOutput) {
  return rest;
}

async function version(): Promise<string> {
  const file = new URL('../package.json', import.meta.url);
  return (JSON.parse(await readFile(file, 'utf8')) as { version: string }).version;
}

export async function run(argv: readonly string[], io: Io): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        systems: { type: 'string', short: 's' },
        audience: { type: 'string', short: 'a' },
        format: { type: 'string', short: 'f' },
        kind: { type: 'string', short: 'k' },
        locale: { type: 'string' },
        'unicode-range': { type: 'boolean' },
        'no-scripts': { type: 'boolean' },
        out: { type: 'string', short: 'o' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
    if (values.help) {
      io.stdout(USAGE);
      return 0;
    }
    if (values.version) {
      io.stdout(`${await version()}\n`);
      return 0;
    }
    const [command, ...files] = positionals;
    if (command !== 'fit') {
      throw new UsageError(command ? `Unknown command "${command}".` : 'Missing command.');
    }
    if (files.length === 0) throw new UsageError('Give at least one font file.');
    const format: ExportFormat = choice(values.format ?? 'css', EXPORT_FORMATS, '--format');
    const kind: Category | undefined = values.kind
      ? choice(values.kind, CATEGORIES, '--kind')
      : undefined;
    const locale = values.locale ? choice(values.locale, ['en', 'ru'] as const, '--locale') : 'en';

    const result = await fitFiles(files, {
      ...(values.audience ? { audience: values.audience } : {}),
      ...(values.systems ? { systems: systemsOf(values.systems) } : {}),
      ...(kind ? { kind } : {}),
      locale,
      unicodeRange: values['unicode-range'] ?? false,
      scripts: !values['no-scripts'],
      format,
    });
    for (const font of result.fonts) {
      if (font.coverage < LOW_COVERAGE) {
        io.stderr(
          `warning: ${font.fileName}: fallbacks share only ${Math.round(font.coverage * 100)}% of its glyphs\n`,
        );
      }
    }
    if (result.uncovered.length > 0) {
      io.stderr(`warning: no fallback fonts available for: ${result.uncovered.join(', ')}\n`);
    }
    const text = values.json
      ? `${JSON.stringify(reportOf(result), null, 2)}\n`
      : `${result.file.text}\n`;
    if (values.out) {
      await writeFile(values.out, text);
      io.stderr(`${values.out} written\n`);
    } else {
      io.stdout(text);
    }
    return 0;
  } catch (failure) {
    if (failure instanceof UsageError) {
      io.stderr(`error: ${failure.message}\n\n${USAGE}`);
      return 2;
    }
    if (failure instanceof FitRunError) {
      io.stderr(`error: ${failure.message}\n`);
      return 1;
    }
    if (failure instanceof FontParseError) {
      io.stderr(`error: the font could not be read (${failure.code})\n`);
      return 1;
    }
    if (failure instanceof Error && 'code' in failure && typeof failure.code === 'string') {
      const fileError = failure as NodeJS.ErrnoException;
      if (
        fileError.code === 'ENOENT' ||
        fileError.code === 'EISDIR' ||
        fileError.code === 'EACCES'
      ) {
        io.stderr(`error: ${fileError.path ?? ''}: ${fileError.code}\n`);
        return 1;
      }
    }
    if (failure instanceof TypeError && 'code' in failure) {
      io.stderr(`error: ${failure.message}\n\n${USAGE}`);
      return 2;
    }
    throw failure;
  }
}
