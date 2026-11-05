const part = '[a-z0-9]+(?:-[a-z0-9]+)*';

export default {
  overrides: [{ files: ['**/*.astro'], customSyntax: 'postcss-html' }],
  rules: {
    'selector-max-type': [0, { ignoreTypes: ['html', 'body'] }],
    'selector-max-id': 0,
    'selector-class-pattern': [
      `^ff-${part}(?:__${part})?(?:--${part})?$`,
      {
        resolveNestedSelectors: true,
        message: (name) =>
          `Class "${name}" must be ff-block, ff-block__element or ff-block--modifier`,
      },
    ],
  },
};
