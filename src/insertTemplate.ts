/**
 * Insert template engine.
 *
 * Renders the markdown / HTML snippet that gets inserted into the editor
 * after a successful upload. The shape is controlled by
 * `ezimage.insert.{format,width,align,customTemplate,includeName}`.
 *
 * Variable substitution is plain string replacement (no regex, no
 * escaping) because the variables are fixed and trust-controlled — the
 * user picks them from settings; they cannot appear in the URL or filename.
 */
import * as path from 'path';
import {
    InsertAlign,
    InsertFormat,
    InsertTemplateSettings,
    PRESET_TEMPLATES,
    TEMPLATE_VARIABLES,
    TemplateVariable,
} from './types';

export { PRESET_TEMPLATES };

export interface RenderInput {
    /** Public URL returned by the uploader. */
    url: string;
    /** Full filename including extension, e.g. `screenshot-2026.webp`. */
    filename: string;
    /** Resolved template settings from the user's config. */
    settings: InsertTemplateSettings;
    /** Optional explicit alt text; falls back to filename when empty. */
    customAlt?: string;
}

export interface RenderResult {
    /** The full snippet that will be inserted into the editor. */
    snippet: string;
    /** Number of newlines between the snippet and surrounding text. */
    trailingNewlines: 1 | 2;
}

/**
 * Substitute `{var}` placeholders. Unknown placeholders are left as-is so a
 * user with a typo in `customTemplate` can see exactly what went wrong.
 */
function substituteVariables(template: string, vars: Record<TemplateVariable, string>): string {
    let out = template;
    for (const v of TEMPLATE_VARIABLES) {
        // Use split/join instead of .replaceAll for Node 18 compat.
        out = out.split(v).join(vars[v]);
    }
    return out;
}

/**
 * Resolve the template string for the given format. Custom with an empty
 * `customTemplate` falls back to the markdown preset so users still get a
 * sensible snippet instead of an empty line.
 */
export function resolveTemplate(format: InsertFormat, customTemplate: string): string {
    if (format === 'custom') {
        const trimmed = customTemplate.trim();
        if (trimmed.length === 0) {
            return PRESET_TEMPLATES.markdown;
        }
        return trimmed;
    }
    return PRESET_TEMPLATES[format];
}

/**
 * Build the variable map from the upload result and the user's settings.
 * Exposed for testing — production code goes through renderInsert().
 */
export function buildVariables(input: RenderInput): Record<TemplateVariable, string> {
    const parsed = path.parse(input.filename);
    const name = parsed.name;
    const ext = parsed.ext.replace(/^\./, '');

    const alt = (input.customAlt?.trim() ||
        (input.settings.includeName ? name : '') ||
        name);

    return {
        '{url}': input.url,
        '{filename}': input.filename,
        '{name}': name,
        '{ext}': ext,
        '{width}': input.settings.width,
        '{align}': input.settings.align,
        '{alt}': alt,
    };
}

/**
 * Public entry point. Returns the snippet to insert plus a hint about how
 * many blank lines should follow it. Markdown and HTML-block snippets are
 * separated from surrounding paragraphs by a blank line, while inline
 * snippets (rare) just collapse to a single newline.
 */
export function renderInsert(input: RenderInput): RenderResult {
    const tpl = resolveTemplate(input.settings.format, input.settings.customTemplate);
    const vars = buildVariables(input);
    const snippet = substituteVariables(tpl, vars).trimEnd();

    // Block-level snippets get a trailing blank line so the cursor lands
    // below the inserted block, not glued to the last line.
    const isBlock = snippet.includes('\n') || /^\s*<(div|figure|p|table|pre)\b/.test(snippet);
    return { snippet, trailingNewlines: isBlock ? 2 : 1 };
}

/**
 * Validate that a user-defined template references known variables only.
 * Returns the list of unknown placeholders (e.g. `{typo}`) so the caller
 * can surface a friendly error.
 */
export function findUnknownVariables(template: string): string[] {
    const known = new Set<string>(TEMPLATE_VARIABLES);
    const found = new Set<string>();
    const re = /\{[a-zA-Z_]+\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template)) !== null) {
        if (!known.has(m[0])) found.add(m[0]);
    }
    return Array.from(found).sort();
}

/** Helper used by the package.json enum contribution to keep it in sync. */
export const INSERT_FORMAT_VALUES: readonly InsertFormat[] = [
    'markdown', 'html-center', 'html-figure', 'custom',
] as const;

export const INSERT_ALIGN_VALUES: readonly InsertAlign[] = [
    'none', 'left', 'center', 'right',
] as const;
