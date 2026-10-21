import { readFileSync } from 'node:fs';

const PROTECTED = /^refs\/heads\/(main|develop|release\/.+|hotfix\/.+)$/;

const refs = readFileSync(0, 'utf8')
  .split('\n')
  .map((line) => line.split(' ')[2])
  .filter(Boolean);

const blocked = refs.filter((ref) => PROTECTED.test(ref));
if (blocked.length > 0) {
  console.error(
    `Pushing to ${blocked.join(', ')} is not allowed: open a pull request from an issue branch.`,
  );
  process.exit(1);
}
