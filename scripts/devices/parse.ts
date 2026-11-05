import ts from 'typescript';

export type DeviceGroup = 'phone' | 'foldable' | 'tablet' | 'desktop';

export interface ImportedDevice {
  name: string;
  group: DeviceGroup;
  width: number;
  height: number;
  scale: number;
}

type Literal = string | number | boolean | Literal[] | { [key: string]: Literal };

const TYPE_GROUPS: Record<string, DeviceGroup> = {
  phone: 'phone',
  tablet: 'tablet',
  notebook: 'desktop',
  'smart-display': 'desktop',
};

function keyOf(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`Unsupported property key: ${name.getText()}`);
}

function literalOf(node: ts.Expression, strings: Record<string, string>): Literal {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return literalOf(node.expression, strings);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalOf(element, strings));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result: { [key: string]: Literal } = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported property: ${property.getText()}`);
      }
      result[keyOf(property.name)] = literalOf(property.initializer, strings);
    }
    return result;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.getText() === 'i18nLazyString' &&
    node.arguments.length === 1 &&
    ts.isPropertyAccessExpression(node.arguments[0] as ts.Expression)
  ) {
    const name = (node.arguments[0] as ts.PropertyAccessExpression).name.text;
    const text = strings[name];
    if (text === undefined) throw new Error(`Unknown UI string: ${name}`);
    return text;
  }
  throw new Error(`Unsupported expression: ${node.getText()}`);
}

function initializerOf(file: ts.SourceFile, name: string): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  file.forEachChild((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        found = declaration.initializer;
      }
    }
  });
  return found;
}

const record = (value: Literal | undefined): { [key: string]: Literal } | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;

function sizeOf(value: Literal | undefined): { width: number; height: number } | undefined {
  const size = record(value);
  if (typeof size?.width !== 'number' || typeof size.height !== 'number') return undefined;
  if (!(size.width > 0) || !(size.height > 0)) return undefined;
  return { width: size.width, height: size.height };
}

export function parseEmulatedDevices(source: string): ImportedDevice[] {
  const file = ts.createSourceFile('EmulatedDevices.ts', source, ts.ScriptTarget.Latest, true);
  const uiStrings = initializerOf(file, 'UIStrings');
  const list = initializerOf(file, 'emulatedDevices');
  if (!uiStrings || !list) throw new Error('UIStrings or emulatedDevices not found');
  const strings = Object.fromEntries(
    Object.entries(record(literalOf(uiStrings, {})) ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const entries = literalOf(list, strings);
  if (!Array.isArray(entries)) throw new Error('emulatedDevices is not an array');

  const devices: ImportedDevice[] = [];
  for (const entry of entries) {
    const item = record(entry);
    const screen = record(item?.screen);
    if (!item || !screen || typeof item.title !== 'string') {
      throw new Error('Malformed device entry');
    }
    const scale = screen['device-pixel-ratio'];
    const portrait = sizeOf(screen.vertical);
    const landscape = sizeOf(screen.horizontal);
    if (typeof scale !== 'number' || !portrait || !landscape) {
      throw new Error(`Device without a screen size: ${item.title}`);
    }
    const folds = item['foldable-screen'] === true || item['dual-screen'] === true;
    const group = folds ? 'foldable' : TYPE_GROUPS[String(item.type)];
    if (!group) throw new Error(`Unknown device type for ${item.title}: ${String(item.type)}`);
    const { width, height } = group === 'desktop' ? landscape : portrait;
    devices.push({ name: item.title, group, width, height, scale });
    const open = sizeOf(screen['vertical-spanned']);
    if (folds && open) devices.push({ name: `${item.title} (unfolded)`, group, ...open, scale });
  }
  return devices;
}
