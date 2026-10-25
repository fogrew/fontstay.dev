# Common UI

Public components are exported only through `@/common/ui`. Application layouts
load `src/app/styles/tokens.css`; the UI entry point loads component styles.
Tokens use `light-dark()` with system color scheme by default and optional root
`data-theme="light"` / `"dark"` overrides. Forced colors keep native system colors,
focus outlines and active-tab borders; reduced motion removes button transitions.

- `Button`: native button, `type="button"` by default, primary/secondary variants.
- `ff-button-group` (CSS): joins adjacent `.ff-button`s without gaps and squares only touching corners; works on a `div`, `span` or `fieldset` with a `legend`.
- `ToggleGroup`: multi-select `ff-button-group` of `aria-pressed` buttons; Shift+click selects the range from the last clicked item, applying its state.
- `FitField`: labelled range and number inputs with unit-bearing accessible names,
  auto checkbox and reset. Controlled `FitValue` follows changing `autoValue` in
  auto mode; edits pin a manual value. Reset/checking auto removes the pin. Inputs
  keep number drafts while typing and commit/clamp on blur or Enter; empty drafts
  revert without pinning. Slider changes pin immediately; its step is configurable,
  while number inputs allow finer decimals. Callers provide finite values, ordered
  bounds and a positive slider step.
- `Select`: native labelled select with controlled value and caller-provided options.
- `Tabs`: automatic activation with one tab stop, wrapping arrows and Home/End.
  Panels retain their content while hidden and provide a keyboard focus target.
  Callers provide nonempty items with stable unique IDs and localized labels.
- `CodeBlock`: escaped text in scrollable code, explicit Clipboard API action,
  pending state and localized success/failure feedback. No HTML interpretation.
- `Disclosure`: native details/summary interaction.
- `LiveRegion`: persistent, polite, atomic status node. Callers throttle frequently
  changing announcements before updating its content.

Locale is passed explicitly to components that own messages. Labels and content
come from callers; application callers must use `messagesFor(locale)` for UI text.
IDs use Preact `useId` to stay stable across server render and hydration.

`tests/ui` builds a separate Astro fixture site, not a production route. Its
Playwright suite checks both locales/themes with axe, keyboard navigation,
manual/auto behavior, clipboard success/failure, mobile overflow, forced colors
and reduced motion. The production build does not include the fixture page.
