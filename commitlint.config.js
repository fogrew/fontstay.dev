export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /^chore\(deps(-dev)?\): Bump /.test(message)],
};
