/**
 * Insert template engine.
 *
 * Renders the markdown / HTML snippet that gets inserted into the editor
 * after a successful upload. The shape is controlled by
 * `ezimage.insert.{format,width,align,customTemplate,includeName}`.
 *
 * Built-in presets are produced by functions so we can drop empty
 * attributes (`width=""`, `align="none"`) and skip the `<div>` wrapper
 * entirely when alignment isn't requested. Custom templates are still
 * raw strings interpolated with `{var}` placeholders — power users keep
 * full control.
 *
 * Variable substitution for custom templates is plain string replacement
 * (no regex, no escaping) because the variables are fixed and trust-
 * controlled — the user picks them from settings; they cannot appear in
 * the URL or filename.
 */
import * as path from 'path';
import {
    InsertAlign,
    InsertFormat,
    InsertTemplateSettings,
    TEMPLATE_VARIABLES,
    TemplateVariable,
} from './types';

// Re-export so callers don't need to import types + engine separately.
export type {
    InsertFormat,
    InsertAlign,
    InsertTemplateSettings,
} from './types';

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

// ---------------------------------------------------------------------------
// Variable map (used by both built-in presets and custom templates)
// ---------------------------------------------------------------------------

/**
 * Build the variable map from the upload result and the user's settings.
 * Exposed for testing — production code goes through renderInsert().
 *
 * Important: variable VALUES are bare (no surrounding attributes), so a
 * custom template like `<img width="{width}">` interpolates correctly.
 * Built-in presets do their own attribute wrapping inside the renderer.
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
        // Bare values — the preset renderer decides whether to wrap them
        // in width="...". Custom templates can opt-in by writing their own
        // attribute wrapper, e.g. width="{width}".
        '{width}': input.settings.width,
        '{align}': input.settings.align,
        '{alt}': alt,
    };
}

// ---------------------------------------------------------------------------
// Built-in preset rendering
// ---------------------------------------------------------------------------

interface PresetRenderVars {
    url: string;
    alt: string;
    /** Bare width value (e.g. `65%`) or empty string. */
    width: string;
    /** Bare align value (e.g. `center`) — caller decides if/where to use it. */
    align: InsertAlign;
}

/**
 * Render one of the three built-in formats.
 *
 * `align` and `width` are **independent**:
 *   - `align` decides whether to wrap in <div> and what value.
 *     `align: none` means NO wrapper at all — just the bare <img>.
 *   - `width` only emits a `width="..."` attribute when non-empty.
 *
 * This means a user can pick html-wrap + align=none to get a bare img
 * with a width attribute but no centering wrapper.
 */
export type RenderablePreset = Exclude<InsertFormat, 'custom'>;

export function renderPreset(format: RenderablePreset, v: PresetRenderVars): string {
    const widthAttr = v.width ? ` width="${escapeAttr(v.width)}"` : '';

    switch (format) {
        case 'markdown':
            return `![${v.alt}](${v.url})`;

        case 'html-wrap': {
            const img = `<img src="${escapeAttr(v.url)}" alt="${escapeAttr(v.alt)}"${widthAttr}>`;
            if (v.align === 'none') return img;
            // left / center / right all emit the wrapper, just with
            // different align values. Empty / unknown aligns fall back to
            // a bare <img> to avoid producing align="none".
            return `<div align="${escapeAttr(v.align)}">${img}</div>`;
        }

        case 'html-figure':
            // <figure> is a block element that the host typically renders
            // centered. The user-chosen `align` setting is intentionally
            // ignored here — figure alignment is a CSS concern, not an
            // attribute. Width still applies to the inner <img>.
            return `<figure><img src="${escapeAttr(v.url)}" alt="${escapeAttr(v.alt)}"${widthAttr}><figcaption>${v.alt}</figcaption></figure>`;
    }
}

/**
 * Minimal HTML-attribute-value escaping. Covers the only characters that
 * are valid inside an attribute and can break the document if left raw.
 * Used for built-in presets so user-controlled filename / alt text can
 * never inject markup. Custom templates escape their own values.
 */
function escapeAttr(value: string): string {
    return value.replace(/[&<>"']/g, (c) => {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return c;
        }
    });
}

// ---------------------------------------------------------------------------
// Custom template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a custom template string. Returns `null` when the user hasn't
 * configured one — caller should fall back to the markdown preset.
 */
export function resolveCustomTemplate(customTemplate: string): string | null {
    const trimmed = customTemplate.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Substitute `{var}` placeholders in a user-supplied template. Unknown
 * placeholders are left as-is so a typo in `customTemplate` is visible
 * in the editor instead of silently dropped.
 */
export function substituteVariables(template: string, vars: Record<TemplateVariable, string>): string {
    let out = template;
    for (const v of TEMPLATE_VARIABLES) {
        // Use split/join instead of .replaceAll for Node 18 compat.
        out = out.split(v).join(vars[v]);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Public entry point. Returns the snippet to insert plus a hint about
 * how many blank lines should follow it.
 */
export function renderInsert(input: RenderInput): RenderResult {
    const vars = buildVariables(input);

    let snippet: string;
    if (input.settings.format === 'custom') {
        const tpl = resolveCustomTemplate(input.settings.customTemplate);
        if (tpl === null) {
            // Custom selected but no template provided — fall back so the
            // user still gets a sensible insertion.
            snippet = renderPreset('markdown', {
                url: input.url,
                alt: vars['{alt}'],
                width: '',
                align: 'none',
            });
        } else {
            snippet = substituteVariables(tpl, vars).trimEnd();
        }
    } else {
        snippet = renderPreset(input.settings.format, {
            url: input.url,
            alt: vars['{alt}'],
            width: vars['{width}'],
            align: vars['{align}'] as InsertAlign,
        });
    }

    // Block-level snippets get a trailing blank line so the cursor lands
    // below the inserted block, not glued to the last line.
    const isBlock = snippet.includes('\n') || /^\s*<(div|figure|p|table|pre)\b/.test(snippet);
    return { snippet, trailingNewlines: isBlock ? 2 : 1 };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Re-export helper constants used in package.json enum validation
// ---------------------------------------------------------------------------

/**
 * Helper used by the package.json enum contribution to keep it in sync.
/**
 * Helper used by the package.json enum contribution to keep it in sync.
 */
export const INSERT_FORMAT_VALUES: readonly InsertFormat[] = [
    'markdown', 'html-wrap', 'html-figure', 'custom',
] as const;

export const INSERT_ALIGN_VALUES: readonly InsertAlign[] = [
    'none', 'left', 'center', 'right',
] as const;
