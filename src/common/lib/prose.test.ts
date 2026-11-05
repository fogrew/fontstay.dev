import { describe, expect, it } from 'vitest';
import { addProseClasses } from './prose';

describe('addProseClasses', () => {
  it('adds block classes to headings, paragraphs and lists', () => {
    expect(addProseClasses('<h2 id="x">T</h2><p>a</p><ul><li>b</li></ul>')).toBe(
      '<h2 class="ff-heading ff-page__heading ff-prose__heading" id="x">T</h2><p class="ff-page__text">a</p><ul class="ff-page__list"><li class="ff-page__item">b</li></ul>',
    );
  });

  it('marks links inside list items and cells as tap targets', () => {
    expect(addProseClasses('<p><a href="/">x</a></p><ul><li><a href="/">y</a></li></ul>')).toBe(
      '<p class="ff-page__text"><a class="ff-link" href="/">x</a></p><ul class="ff-page__list"><li class="ff-page__item"><a class="ff-link ff-link--tap" href="/">y</a></li></ul>',
    );
  });

  it('leaves unmapped tags untouched', () => {
    expect(addProseClasses('<code>x</code><br />')).toBe('<code>x</code><br />');
  });
});
