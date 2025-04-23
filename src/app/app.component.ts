import { NgClass } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateBackground } from './background';
import { WorkerService } from './worker.service';

@Component({
    selector: 'app-root',
    imports: [FormsModule, NgClass],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent {
    readonly grid = signal<string[][] | null>(null);
    readonly gridWords = signal<string[]>([]);
    readonly url = computed(() => {
        const grid =
            this.grid()
                ?.map(row => row.join(''))
                .join(',') || '';
        const words = this.gridWords().join(',') || '';

        if (!grid || !words) {
            return null;
        }
        const width = this.grid()!
            .map(row => row.length)
            .reduce((a, b) => Math.max(a, b), 0);
        const height = this.grid()!.length;
        const params = new URLSearchParams();
        params.set('grid', grid);
        params.set('words', words);
        params.set('width', width.toString());
        params.set('height', height.toString());
        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        return url.length < 2000 ? url : null;
    });
    readonly shareData = computed(() => {
        const url = this.url();
        if (!url) {
            return null;
        }
        return {
            title: 'Word Search',
            text: 'Check out this word search I generated!',
            url: url,
        };
    });
    readonly canShare = computed(() => {
        const shareData = this.shareData();
        if (!shareData) {
            return false;
        }
        return navigator.canShare && navigator.canShare(shareData);
    });

    words: string | null = null;
    width: number | null = null;
    height: number | null = null;

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    constructor(private workerService: WorkerService) {
        generateBackground();

        // set url on url change
        effect(() => {
            const url = this.url();
            if (url !== null) {
                window.history.replaceState({}, '', url);
            }
        });
        // get words from query params
        const urlParams = new URLSearchParams(window.location.search);
        const words = urlParams.get('words');
        const width = urlParams.get('width');
        const height = urlParams.get('height');
        const grid = urlParams.get('grid');

        if (words) {
            this.words = decodeURIComponent(words).split(',').join('\n');
        }
        if (width) {
            this.width = parseInt(width, 10);
        }
        if (height) {
            this.height = parseInt(height, 10);
        }
        if (grid) {
            this.grid.set(grid.split(',').map(row => row.split('')));
            this.gridWords.set(this.words?.split('\n') || []);
        } else if (this.words) {
            this.generate();
        }
    }

    async generate() {
        this.loading.set(true);
        this.error.set(null);
        if (!this.words) {
            this.loading.set(false);
            this.error.set('Please enter some words to generate a grid.');
            return;
        }
        const wordsArray = this.words
            .split('\n')
            .flatMap(word => word.split(','))
            .map(word => word.trim().toUpperCase())
            .filter(word => word.length > 0);
        if (this.width === null) {
            this.width = wordsArray.map(word => word.trim().length).reduce((a, b) => Math.max(a, b), 0);
        }

        if (this.height === null) {
            this.height = wordsArray.map(word => word.trim().length).reduce((a, b) => Math.max(a, b), 0);
        }

        if (this.width < 1 || this.height < 1) {
            return;
        }
        if (this.width > 100 || this.height > 100) {
            return;
        }

        try {
            const result = await this.workerService.generate(this.words, this.width, this.height);
            if (!result?.grid) {
                this.loading.set(false);
                this.error.set('No result found.. try a bigger grid or less words.');
                return;
            }

            this.grid.set(
                result?.grid
                    .split('\n')
                    .map((row: string) => row.split(' ').filter((row: string) => row.length > 0))
                    .filter((row: string[]) => row.length > 0)
            );
        } catch (error: any) {
            this.loading.set(false);
            this.error.set(error.message);
            return;
        }
        this.loading.set(false);
        this.error.set(null);
        this.gridWords.set(wordsArray || []);
    }

    async share() {
        if (this.canShare()) {
            try {
                await navigator.share(this.shareData()!);
            } catch (error) {
                console.error('Error sharing:', error);
            }
        }
    }

    async copy() {
        const url = this.url();
        if (url) {
            try {
                await navigator.clipboard.writeText(url);
            } catch (error) {
                console.error('Error copying URL:', error);
            }
        }
    }

    async download() {
        if (!this.grid() || !this.gridWords()) {
            return;
        }
        const grid = this.grid()!;
        const words = this.gridWords()!;
        await this.generateWordSearchPDF(grid, words);
    }

    async generateWordSearchPDF(grid: string[][], words: string[]) {
        // sort words alphabetically
        words.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const padding = 80; // Padding around the grid
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Draw the grid
        const prefferredCellSize = (page.getWidth() - padding * 2) / grid[0].length; // Preferred cell size in points
        const cellSize = Math.min(Math.max(prefferredCellSize, 8), 32);
        const cellFontSize = Math.floor(cellSize * 0.5); // Font size relative to cell size
        const xOffsetToCenter = (page.getWidth() - grid[0].length * cellSize) / 2;
        const startY = page.getHeight() - padding - cellSize; // Start Y position for the grid
        grid.forEach((row, rowIndex) => {
            row.forEach((char, colIndex) => {
                const x = xOffsetToCenter + colIndex * cellSize;
                const y = startY - rowIndex * cellSize;
                const charWidth = font.widthOfTextAtSize(char, cellFontSize);
                const charHeight = font.heightAtSize(cellFontSize);
                const centeredX = x + (cellSize - charWidth) / 2;
                const centeredY = y + (cellSize - charHeight) / 2;

                page.drawText(char, {
                    x: centeredX,
                    y: centeredY,
                    size: cellFontSize,
                    font,
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
            const lineHeight = font.heightAtSize(fontSize) + 10; // Line height for the word list
            let wordListStartY = startY - grid.length * cellSize - padding / 2;

            // find the best number of columns to fit the page
            const maxWidth = page.getWidth() - padding * 2;
            const columnGap = fontSize; // Gap between columns
            const maxWordSize = Math.max(...words.map(word => font.widthOfTextAtSize(word, fontSize) + columnGap));
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
                const wordCenterXOffset = (columnSize - font.widthOfTextAtSize(word, fontSize)) / 2; // Center the word in the column
                const x = padding + column * columnSize + wordCenterXOffset; // X position based on the column
                const y = wordListStartY - row * lineHeight; // Y position based on the row
                page.drawText(word, {
                    x,
                    y,
                    size: fontSize,
                    font,
                    color: rgb(0.3, 0.3, 0.3),
                });
            });

            const pdfBytes = await pdfDoc.save();
            this.downloadPDF(pdfBytes, 'word-search.pdf');
            break;
        }
    }

    // Utility function to download the PDF
    downloadPDF(pdfBytes: Uint8Array<ArrayBufferLike>, filename: string) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
}
