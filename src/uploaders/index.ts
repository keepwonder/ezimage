import { IUploader, EzImageSettings } from "../types";
import { R2Uploader } from "./r2";

export class UploaderFactory {
    static create(settings: EzImageSettings): IUploader {
        switch (settings.provider) {
            case 'r2':
                return new R2Uploader(settings.r2);
            default:
                throw new Error(`Unsupported provider: ${settings.provider}`);
        }
    }
}
