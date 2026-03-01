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
}
