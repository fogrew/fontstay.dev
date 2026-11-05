#!/usr/bin/env node
import { run } from './cli';

if (process.argv[2] === 'mcp' && process.argv.length === 3) {
  const { serve } = await import('./mcp');
  await serve(process.stdin, process.stdout);
} else {
  process.exitCode = await run(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
