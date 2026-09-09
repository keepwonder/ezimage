export interface UploadOptions {
    filePath: string;
    originalName: string;
}

export interface UploadResult {
    url: string;
    key: string;
}

export interface IUploader {
    upload(options: UploadOptions): Promise<UploadResult>;
}

/**
 * Insert format presets.
 *
 * - `markdown`  : `![alt](url)` — plain Markdown image.
 * - `html-wrap` : `<div align="..."><img></div>` — HTML with a wrapper that
 *                respects the `align` setting. `align: 'none'` drops the
 *                wrapper and emits a bare `<img>`.
 * - `html-figure`: `<figure><img><figcaption></figure>` — semantic HTML5;
 *                `align` is intentionally ignored (figure alignment is
 *                CSS, not an attribute).
 * - `custom`    : user-supplied template string (see insertCustomTemplate).
 */
export type InsertFormat = 'markdown' | 'html-wrap' | 'html-figure' | 'custom';
export type InsertAlign = 'none' | 'left' | 'center' | 'right';

/** Canonical enum used for settings UI and validation. */
export const CANONICAL_INSERT_FORMATS: readonly InsertFormat[] = [
    'markdown', 'html-wrap', 'html-figure', 'custom',
] as const;

export interface InsertTemplateSettings {
    /** Which preset template to render. `'custom'` reads `customTemplate`. */
    format: InsertFormat;
    /** Width attribute value (`""` omits the attribute entirely). */
    width: string;
    /** Alignment. `'none'` skips the wrapper `<div>`. */
    align: InsertAlign;
    /** User-defined template used when `format === 'custom'`. */
    customTemplate: string;
    /** Whether to seed alt/figcaption from the source filename. */
    includeName: boolean;
}

export interface EzImageSettings {
    provider: 'r2' | 's3' | 'oss';
    r2: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucketName: string;
        publicUrl: string;
    };
    pathTemplate: string;
    compress: boolean;
    maxWidth: number;
    quality: number;
    insert: InsertTemplateSettings;
}

/**
 * Variables available to insert templates. Keep this in sync with
 * PRESETS below and the README section "Insert format templates".
 */
export const TEMPLATE_VARIABLES = [
    '{url}',       // public R2 URL after upload
    '{filename}',  // full filename including extension (foo.webp)
    '{name}',      // filename without extension (foo)
    '{ext}',       // extension without dot (webp)
    '{width}',     // ezimage.insert.width
    '{align}',     // ezimage.insert.align
    '{alt}',       // final alt text (filename or customAlt)
] as const;

export type TemplateVariable = typeof TEMPLATE_VARIABLES[number];

/**
 * Legacy string templates, kept only for documentation / migration. The
 * real rendering now happens in `renderPreset()` so we can drop empty
 * attributes and skip the `<div>` wrapper when align is `none`.
 *
 * Note: these strings match the html-wrap rendering when `align=center`,
 * `width:100%` — they show the most common case, not all combinations.
 * For accurate per-case output see renderPreset() in insertTemplate.ts.
 *
 * @deprecated Use `renderPreset()` from insertTemplate.ts. Exported so
 * external readers can still see what each format produces.
 */
export const PRESET_TEMPLATES: Readonly<Record<Exclude<InsertFormat, 'custom'>, string>> = {
    'markdown':     '![{alt}]({url})',
    'html-wrap':    '<div align="{align}"><img src="{url}" alt="{alt}" width="{width}"></div>',
    'html-figure':  '<figure><img src="{url}" alt="{alt}" width="{width}"><figcaption>{alt}</figcaption></figure>',
};
