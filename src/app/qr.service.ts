import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class QrService {
    async generateQrCode(text: string): Promise<string> {
        const QRCode = (await import('qrcode')).default;

        return await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'M',
            width: 200,
            margin: 0,
            color: {
                dark: '#777777FF',
                light: '#FFFFFFFF',
            },
        });
    }
}
