declare module 'sharp' {
  interface SharpOptions {
    failOnError?: boolean;
  }
  
  interface Metadata {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  }

  interface ResizeOptions {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    withoutEnlargement?: boolean;
  }

  interface WebpOptions {
    quality?: number;
    lossless?: boolean;
    nearLossless?: boolean;
  }

  interface JpegOptions {
    quality?: number;
    progressive?: boolean;
    mozjpeg?: boolean;
  }

  interface Sharp {
    metadata(): Promise<Metadata>;
    resize(width?: number, height?: number, options?: ResizeOptions): Sharp;
    webp(options?: WebpOptions): Sharp;
    jpeg(options?: JpegOptions): Sharp;
    png(options?: { compressionLevel?: number }): Sharp;
    toFile(path: string): Promise<{ width: number; height: number; size: number } >;
  }

  function sharp(input?: string | Buffer, options?: SharpOptions): Sharp;
  
  export = sharp;
}