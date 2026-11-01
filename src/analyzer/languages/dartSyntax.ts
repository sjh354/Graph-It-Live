/**
 * Dart declaration scanner.
 *
 * Dart is not parsed by tree-sitter here: the grammar WASM is not available to
 * this build, and the tree-sitter query language cannot express `package:` URI
 * resolution. Declarations, members and call sites are therefore read
 * syntactically from a masked copy of the source (comments and strings blanked
 * so their contents cannot look like code). The result is evidence "syntax":
 * a call to a name that is not declared in the file stays unresolved instead of
 * being attached to a same-named symbol elsewhere.
 *
 * NO vscode imports — this module is VS Code-agnostic.
 */

export type DartDeclarationKind = "class" | "function" | "method" | "variable" | "type" | "interface";

export interface DartDeclaration {
  name: string;
  kind: DartDeclarationKind;
  /** 1-based line of the declaration */
  line: number;
  /** False for `_private` members */
  isExported: boolean;
  parentName?: string;
  /** Offsets into the masked source; a member's body excludes the signature */
  startIndex: number;
  endIndex: number;
}

export interface DartCallSite {
  /** Called name, e.g. `fetchUsers` */
  name: string;
  /** 1-based line */
  line: number;
  /** 0-based column */
  column: number;
}

const CLASS_KEYWORDS = new Set(["class", "mixin", "enum", "extension"]);

/** Blank comments and string bodies, preserving every newline and offset. */
export function maskDart(source: string): string {
  const chars = [...source];
  const blank = (from: number, to: number): void => {
    for (let index = from; index < to && index < chars.length; index++) {
      if (chars[index] !== "\n") chars[index] = " ";
    }
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      blank(index, stop);
      index = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      // Dart block comments nest.
      let depth = 1;
      let cursor = index + 2;
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === "/" && source[cursor + 1] === "*") {
          depth++;
          cursor += 2;
        } else if (source[cursor] === "*" && source[cursor + 1] === "/") {
          depth--;
          cursor += 2;
        } else {
          cursor++;
        }
      }
      blank(index, cursor);
      index = cursor;
      continue;
    }

    if (char === "'" || char === '"') {
      const triple = source.startsWith(char.repeat(3), index);
      const quote = triple ? char.repeat(3) : char;
      let cursor = index + quote.length;
      const raw = source[index - 1] === "r";
      while (cursor < source.length) {
        if (!raw && source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source.startsWith(quote, cursor)) {
          cursor += quote.length;
          break;
        }
        cursor++;
      }
      blank(index, cursor);
      index = cursor;
      continue;
    }

    index++;
  }

  return chars.join("");
}

/** Balanced `{` … `}` starting at `openIndex`, or the end of the source. */
function blockEnd(code: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < code.length; index++) {
    if (code[index] === "{") depth++;
    else if (code[index] === "}") {
      depth--;
      if (depth <= 0) return index;
    }
  }
  return Math.max(0, code.length - 1);
}

/** Depth of `{`/`}` at the start of each line of already-masked code. */
function lineDepths(code: string): number[] {
  const depths: number[] = [];
  let depth = 0;
  for (const line of code.split("\n")) {
    depths.push(depth);
    for (const char of line) {
      if (char === "{") depth++;
      else if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return depths;
}

const MEMBER_NAME = /^\s*(?:@[A-Za-z_][\w.]*(?:\([^)]*\))?\s*)*((?:(?:static|abstract|external|final|const|late|covariant|factory|required)\s+)*)([\w<>,?[\]. ]*?)\b([A-Za-z_]\w*)\s*(?:<[^<>()]*>)?\s*\([^;{}]*\)\s*(?:async\*?|sync\*?)?\s*(?:\{|=>|;)/;
const GETTER_SETTER = /^\s*(?:static\s+)?(?:get|set)\s+([A-Za-z_]\w*)\b/;
// A class field: `int count = 0;`, `final controller = TextEditingController();`,
// `late final Foo foo;`. Checked before methods so an initializer's constructor
// call is not mistaken for a method declaration.
const CLASS_FIELD = /^\s*(?:static\s+)?(?:final\s+|const\s+|late\s+|covariant\s+)*(?:[\w<>,?[\]. ]+\s+)?([A-Za-z_]\w*)\s*(?:=|;)/;
const TOP_VARIABLE = /^\s*(?:final|const|var|late)\s+(?:[\w<>,?[\]. ]+\s+)?([A-Za-z_]\w*)\s*(?:=|;)/;
const TOP_FUNCTION = /^\s*(?:@[A-Za-z_][\w.]*(?:\([^)]*\))?\s*)*(?:Future|Stream|void|int|double|num|bool|String|dynamic|Object|Never)?[\w<>,?[\]. ]*\b([A-Za-z_]\w*)\s*(?:<[^<>()]*>)?\s*\([^;{}]*\)\s*(?:async\*?|sync\*?)?\s*(?:\{|=>)/;

const SKIP_NAMES = new Set([
  "if", "for", "while", "switch", "catch", "assert", "return", "await", "yield",
  "throw", "new", "const", "super", "this", "setState", "print", "rethrow", "else",
  "do", "try", "finally", "case", "default", "in", "is", "as", "with", "on",
]);

/**
 * Declarations of one file, outermost first: classes (and mixins/enums/extensions),
 * then their members, then top-level functions and variables.
 */
export function parseDartDeclarations(source: string): DartDeclaration[] {
  const code = maskDart(source);
  const lines = code.split("\n");
  const depths = lineDepths(code);
  const declarations: DartDeclaration[] = [];

  // Classes and other type declarations, with their body ranges.
  const classBodies: Array<{ name: string; startLine: number; endLine: number; kind: DartDeclarationKind }> = [];
  let offset = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const classMatch = /^\s*(?:abstract\s+|base\s+|final\s+|sealed\s+|interface\s+|mixin\s+)*(class|mixin|enum|extension|typedef)\s+([A-Za-z_]\w*)?/.exec(line);
    if (classMatch && depths[lineIndex] === 0) {
      const keyword = classMatch[1];
      const name = classMatch[2];
      if (!name) {
        // `extension on String` is anonymous; skip it rather than invent a name.
        offset += line.length + 1;
        continue;
      }
      const openBrace = code.indexOf("{", offset);
      const semicolon = code.indexOf(";", offset);
      const hasBody = openBrace !== -1 && (semicolon === -1 || openBrace < semicolon);
      const end = hasBody ? blockEnd(code, openBrace) : offset + line.length;
      const kind: DartDeclarationKind =
        keyword === "enum" || keyword === "typedef" ? "type" : "class";
      declarations.push({
        name,
        kind,
        line: lineIndex + 1,
        isExported: !name.startsWith("_"),
        startIndex: offset,
        endIndex: end,
      });
      if (hasBody && CLASS_KEYWORDS.has(keyword)) {
        classBodies.push({
          name,
          startLine: lineIndex,
          endLine: code.slice(0, end).split("\n").length - 1,
          kind,
        });
      }
    }
    offset += line.length + 1;
  }

  const classAt = (lineIndex: number) =>
    classBodies.find((body) => lineIndex > body.startLine && lineIndex <= body.endLine);

  offset = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const owner = classAt(lineIndex);
    const bodyStart = depths[lineIndex] === 0;

    if (owner && depths[lineIndex] === 1) {
      const field = CLASS_FIELD.exec(line);
      if (field && !SKIP_NAMES.has(field[1])) {
        declarations.push({
          name: field[1],
          kind: "variable",
          line: lineIndex + 1,
          isExported: !field[1].startsWith("_") && !owner.name.startsWith("_"),
          parentName: owner.name,
          startIndex: offset,
          endIndex: offset + line.length,
        });
        offset += line.length + 1;
        continue;
      }

      const getter = GETTER_SETTER.exec(line);
      const member = MEMBER_NAME.exec(line);
      const name = getter?.[1] ?? member?.[3];
      if (name && !SKIP_NAMES.has(name)) {
        const openBrace = code.indexOf("{", offset);
        const arrow = code.indexOf("=>", offset);
        const end =
          openBrace !== -1 && (arrow === -1 || openBrace < arrow)
            ? blockEnd(code, openBrace)
            : offset + line.length;
        declarations.push({
          name,
          kind: "method",
          line: lineIndex + 1,
          isExported: !name.startsWith("_") && !owner.name.startsWith("_"),
          parentName: owner.name,
          startIndex: offset,
          endIndex: end,
        });
      }
    } else if (!owner && bodyStart) {
      const variable = TOP_VARIABLE.exec(line);
      if (variable) {
        declarations.push({
          name: variable[1],
          kind: "variable",
          line: lineIndex + 1,
          isExported: !variable[1].startsWith("_"),
          startIndex: offset,
          endIndex: offset + line.length,
        });
      } else if (!/^\s*(?:class|mixin|enum|extension|typedef|import|export|part|library)\b/.test(line)) {
        const fn = TOP_FUNCTION.exec(line);
        if (fn && !SKIP_NAMES.has(fn[1]) && fn[1] !== classBodies[0]?.name) {
          const openBrace = code.indexOf("{", offset);
          const arrow = code.indexOf("=>", offset);
          const end =
            openBrace !== -1 && (arrow === -1 || openBrace < arrow)
              ? blockEnd(code, openBrace)
              : offset + line.length;
          declarations.push({
            name: fn[1],
            kind: "function",
            line: lineIndex + 1,
            isExported: !fn[1].startsWith("_"),
            startIndex: offset,
            endIndex: end,
          });
        }
      }
    }

    offset += line.length + 1;
  }

  return declarations;
}

/** Call sites inside a declaration body (the signature itself is excluded). */
export function findCallSites(code: string, declaration: DartDeclaration): DartCallSite[] {
  const bodyCode = code.slice(declaration.startIndex, declaration.endIndex + 1);
  const signatureEnd = Math.min(
    Math.max(bodyCode.indexOf("{"), bodyCode.indexOf("=>")),
    bodyCode.length,
  );
  const body = bodyCode.slice(signatureEnd === -1 ? 0 : signatureEnd);
  const baseOffset = declaration.startIndex + (signatureEnd === -1 ? 0 : signatureEnd);

  const calls: DartCallSite[] = [];
  const seen = new Set<number>();
  for (const match of body.matchAll(/([A-Za-z_]\w*)\s*(?:<[^<>()]*>)?\s*\(/g)) {
    const name = match[1];
    if (SKIP_NAMES.has(name)) continue;
    const index = baseOffset + (match.index ?? 0);
    const before = code.slice(0, index).trimEnd().slice(-1);
    // A field access (`this.name(`) and a constructor (`const Foo(`) are calls
    // too, but a declaration signature (`void name(`) is already excluded by
    // the body slice. Skip keywords and annotations.
    if (before === "@") continue;
    if (seen.has(index)) continue;
    seen.add(index);
    // `index` is absolute in the masked source, so the line comes from it directly.
    const prefix = code.slice(0, index).split("\n");
    calls.push({
      name,
      line: prefix.length,
      column: prefix[prefix.length - 1].length,
    });
  }
  return calls;
}
