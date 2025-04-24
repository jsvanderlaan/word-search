import { Injectable } from '@angular/core';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { QrService } from './qr.service';

@Injectable({
    providedIn: 'root',
})
export class PdfService {
    constructor(private qrService: QrService) {}
    async generatePdf(grid: string[][], words: string[], title: string, url: string) {
        // sort words alphabetically
        words.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const padding = 100; // Padding around the grid
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const page = pdfDoc.addPage();

        const monoBytes = await this.fetchFont('/assets/fonts/grid.ttf');
        const titleBytes = await this.fetchFont('/assets/fonts/title.ttf');
        const fontMono = await pdfDoc.embedFont(monoBytes);
        const fontTitle = await pdfDoc.embedFont(titleBytes);

        // Draw the title
        const titleFontSize = 36; // Font size for the title
        const titleWidth = fontTitle.widthOfTextAtSize(title, titleFontSize);
        const titleHeight = fontTitle.heightAtSize(titleFontSize);
        const titleX = (page.getWidth() - titleWidth) / 2; // Center the title horizontally
        const titleY = page.getHeight() - padding / 2 - titleHeight; // Position the title at the top with padding
        page.drawText(title, {
            x: titleX,
            y: titleY,
            size: titleFontSize,
            font: fontTitle,
            color: rgb(0, 0, 0),
        });

        // Draw the grid
        const titlePadding = padding / 2; // Padding below the title
        const prefferredCellSize = (page.getWidth() - padding * 2) / grid[0].length; // Preferred cell size in points
        const cellSize = Math.min(Math.max(prefferredCellSize, 8), 32);
        const cellFontSize = Math.floor(cellSize * 0.5); // Font size relative to cell size
        const xOffsetToCenter = (page.getWidth() - grid[0].length * cellSize) / 2;
        const startY = titleY - titlePadding - cellSize; // Start Y position for the grid
        grid.forEach((row, rowIndex) => {
            row.forEach((char, colIndex) => {
                const x = xOffsetToCenter + colIndex * cellSize;
                const y = startY - rowIndex * cellSize;
                const charWidth = fontMono.widthOfTextAtSize(char, cellFontSize);
                const charHeight = fontMono.heightAtSize(cellFontSize);
                const centeredX = x + (cellSize - charWidth) / 2;
                const centeredY = y + (cellSize - charHeight) / 2;

                page.drawText(char, {
                    x: centeredX,
                    y: centeredY,
                    size: cellFontSize,
                    font: fontMono,
                    color: rgb(0, 0, 0),
                });
                // page.drawRectangle({
                //     x,
                //     y,
                //     width: cellSize,
                //     height: cellSize,
                //     borderColor: rgb(0.75, 0.75, 0.75),
                //     borderWidth: 1,
                // });
            });
        });

        // Draw the word list
        let fontSize = Math.min(cellFontSize, 14); // Start with a larger font size for the word list

        while (fontSize > 5) {
            const lineHeight = fontMono.heightAtSize(fontSize) + 10; // Line height for the word list
            const wordListStartY = startY - grid.length * cellSize - padding / 2;

            // find the best number of columns to fit the page
            const maxWidth = page.getWidth() - padding * 2;
            const columnGap = fontSize; // Gap between columns
            const maxWordSize = Math.max(...words.map(word => fontMono.widthOfTextAtSize(word, fontSize) + columnGap));
            const numberOfColumns = Math.floor(maxWidth / maxWordSize);
            const columnSize = maxWidth / numberOfColumns; // Column size based on the number of columns

            // Check if the words fit in the available space
            const totalHeight = Math.ceil(words.length / numberOfColumns) * lineHeight;

            if (totalHeight > wordListStartY - padding) {
                fontSize--;
                continue;
            }
            words.forEach((word, i) => {
                // Calculate the number of rows per column for even distribution
                const rowsPerColumn = Array(numberOfColumns).fill(0);
                for (let j = 0; j < words.length; j++) {
                    rowsPerColumn[j % numberOfColumns]++;
                }

                // Determine the column and row for the current word
                let column = 0;
                let row = i;
                for (let j = 0; j < rowsPerColumn.length; j++) {
                    if (row < rowsPerColumn[j]) {
                        column = j;
                        break;
                    }
                    row -= rowsPerColumn[j];
                }

                // Calculate the X and Y positions
                // const wordCenterXOffset = (columnSize - fontMono.widthOfTextAtSize(word, fontSize)) / 2; // Center the word in the column
                // const x = padding + column * columnSize + wordCenterXOffset; // X position based on the column
                const x = padding + column * columnSize; // X position based on the column
                const y = wordListStartY - row * lineHeight; // Y position based on the row
                page.drawText(word, {
                    x,
                    y,
                    size: fontSize,
                    font: fontMono,
                    color: rgb(0.3, 0.3, 0.3),
                });
            });

            // Draw the QR code
            const qrCodeSize = 60; // Size of the QR code
            const qrCodeX = (page.getWidth() - qrCodeSize) / 2; // Position the QR code at the bottom right corner
            const qrCodeY = padding / 2; // Position the QR code at the bottom right corner
            const qrCodeData = await this.qrService.generateQrCode(url);
            const qrCodeImage = await pdfDoc.embedPng(qrCodeData);
            const qrCodeDims = qrCodeImage.scale(qrCodeSize / qrCodeImage.width);
            page.drawImage(qrCodeImage, {
                x: qrCodeX,
                y: qrCodeY,
                width: qrCodeDims.width,
                height: qrCodeDims.height,
            });

            const pdfBytes = await pdfDoc.save();
            this.downloadPDF(pdfBytes, `${title}.pdf`);
            break;
        }
    }

    // Utility function to download the PDF
    private downloadPDF(pdfBytes: Uint8Array<ArrayBufferLike>, filename: string) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    private async fetchFont(url: string): Promise<ArrayBuffer> {
        const res = await fetch(url);
        return await res.arrayBuffer();
    }
}
