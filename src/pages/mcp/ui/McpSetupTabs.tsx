import { type Locale, messagesFor } from '@/common/i18n';
import { Tabs } from '@/common/ui';
import './mcp-setup.css';

interface Props {
  locale: Locale;
}

const claudeCode = 'claude mcp add fontstay -- npx -y fontstay mcp';
const mcpServers = `{
  "mcpServers": {
    "fontstay": { "command": "npx", "args": ["-y", "fontstay", "mcp"] }
  }
}`;
const vscode = `{
  "servers": {
    "fontstay": { "type": "stdio", "command": "npx", "args": ["-y", "fontstay", "mcp"] }
  }
}`;
const codex = `[mcp_servers.fontstay]
command = "npx"
args = ["-y", "fontstay", "mcp"]`;

const server = { command: 'npx', args: ['-y', 'fontstay', 'mcp'] };
const vscodeInstall = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'fontstay', ...server }))}`;
const cursorInstall = `cursor://anysphere.cursor-deeplink/mcp/install?name=fontstay&config=${encodeURIComponent(btoa(JSON.stringify(server)))}`;

export function McpSetupTabs({ locale }: Props) {
  const t = messagesFor(locale);
  const content = (
    code: string,
    options?: { path?: string; install?: { href: string; label: string } },
  ) => (
    <div class="ff-mcp-setup__content">
      {options?.path && (
        <p class="ff-mcp-setup__path">
          {t.mcp_setup_config_file()} <code dir="ltr">{options.path}</code>
        </p>
      )}
      {options?.install && (
        <a class="ff-link ff-link--tap ff-mcp-setup__install" href={options.install.href}>
          {options.install.label}
        </a>
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable code needs a keyboard focus target */}
      <pre class="ff-prose__code ff-mcp-setup__code" dir="ltr" tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div class="ff-mcp-setup">
      <Tabs
        label={t.mcp_setup_heading()}
        animate
        scrollable
        items={[
          { id: 'claude-code', label: t.mcp_setup_claude_code(), content: content(claudeCode) },
          {
            id: 'claude-desktop',
            label: t.mcp_setup_claude_desktop(),
            content: content(mcpServers, { path: 'claude_desktop_config.json' }),
          },
          {
            id: 'cursor',
            label: t.mcp_setup_cursor(),
            content: content(mcpServers, {
              path: '.cursor/mcp.json',
              install: { href: cursorInstall, label: t.mcp_setup_install_cursor() },
            }),
          },
          {
            id: 'vscode',
            label: t.mcp_setup_vscode(),
            content: content(vscode, {
              path: '.vscode/mcp.json',
              install: { href: vscodeInstall, label: t.mcp_setup_install_vscode() },
            }),
          },
          {
            id: 'codex',
            label: t.mcp_setup_codex(),
            content: content(codex, { path: '~/.codex/config.toml' }),
          },
        ]}
      />
    </div>
  );
}
