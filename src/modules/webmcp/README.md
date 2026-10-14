# webmcp

Experimental [WebMCP](https://github.com/webmachinelearning/webmcp) tools. When the browser offers
`document.modelContext` (or `navigator.modelContext`), `registerWebMcp` registers the tools from
`buildTools`; without it nothing happens. The API is an origin trial in Chrome 149 and Edge 150
and may change.

The generator fills a `ToolHost` on every render and the tools read it, so an agent always sees the
current state of the user's session. Tools: `list-fonts`, `select-font`, `analyze-font`,
`get-audience`, `set-audience`, `suggest-fallbacks`, `set-fallbacks`, `set-font-kind`, `get-css`,
`get-export`, `get-layout-shift` and `explain-setting`. They work on the fonts the user loaded, use
no network, and the changes they make are visible in the interface.
