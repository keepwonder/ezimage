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

export type InsertFormat = 'markdown' | 'html-center' | 'html-figure' | 'custom';
export type InsertAlign = 'none' | 'left' | 'center' | 'right';

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

/** Built-in templates. Order matches the `insertFormat` enum. */
export const PRESET_TEMPLATES: Record<Exclude<InsertFormat, 'custom'>, string> = {
    'markdown':     '![{alt}]({url})',
    'html-center':  '<div align="{align}"><img src="{url}" alt="{alt}" width="{width}"></div>',
    'html-figure':  '<figure><img src="{url}" alt="{alt}" width="{width}"><figcaption>{alt}</figcaption></figure>',
};
