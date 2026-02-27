// services/pdf.service.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import axios from 'axios';

// Fetch file as buffer
async function fetchFile(url: string): Promise<ArrayBuffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
}

export async function createPdfOverlay(
    pdfUrl: string,
    contact: { name: string; company?: string; phone?: string; email?: string },
    avatarUrl?: string
): Promise<Buffer> {
    // Download standard PDF
    const pdfBytes = await fetchFile(pdfUrl);

    // Load standard PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    if (avatarUrl && avatarUrl.startsWith('http')) {
        try {
            const avatarBytes = await fetchFile(avatarUrl);
            let avatarImage;

            // Determine image type (jpg vs png)
            if (avatarUrl.toLowerCase().endsWith('.png')) {
                avatarImage = await pdfDoc.embedPng(avatarBytes);
            } else {
                avatarImage = await pdfDoc.embedJpg(avatarBytes);
            }

            const pages = pdfDoc.getPages();
            if (pages.length > 0) {
                const lastPage = pages[pages.length - 1];
                const { width, height } = lastPage.getSize();
                // Assume bottom right corner
                lastPage.drawImage(avatarImage, {
                    x: width - 140,
                    y: height - 140,
                    width: 100,
                    height: 100
                });
            }
        } catch (e) {
            console.error('Failed to embed avatar image:', e);
        }
    }

    // Draw texts
    const pages = pdfDoc.getPages();
    if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        const { width, height } = lastPage.getSize();
        let y = height - 50; // Starting Y coordinate below the image

        // Fallback if no avatar URL provided but logic wants text there
        if (!avatarUrl) {
            y = height - 60;
        }

        if (contact.name) {
            lastPage.drawText(contact.name, { x: width - 280, y, size: 11, font, color: rgb(0, 0, 0) });
            y -= 15;
        }

        if (contact.company) {
            lastPage.drawText(contact.company, { x: width - 280, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 13;
        }

        if (contact.phone) {
            lastPage.drawText(contact.phone, { x: width - 280, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 13;
        }

        if (contact.email) {
            lastPage.drawText(contact.email, { x: width - 280, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 13;
        }
    }

    const pdfUint8Array = await pdfDoc.save();
    return Buffer.from(pdfUint8Array);
}
