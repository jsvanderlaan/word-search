import { AfterViewInit, Component, computed, ElementRef, EventEmitter, inject, input, Output, ViewChild } from '@angular/core';
import { PdfService } from '../pdf.service';
import { Solution } from '../types';

@Component({
    selector: 'app-result',
    imports: [],
    templateUrl: './result.component.html',
})
export class ResultComponent implements AfterViewInit {
    private readonly pdfService = inject(PdfService);
    readonly title = input<string | null>('');
    readonly grid = input<string[][] | null>([]);
    readonly solution = input<Solution[] | null>([]);
    readonly url = input<string | null>(null);
    @Output() readonly onEdit = new EventEmitter<void>();

    @ViewChild('gridContainer', { static: false }) gridContainer!: ElementRef;
    @ViewChild('gridContent', { static: false }) gridContent!: ElementRef;
    @ViewChild('selectionOverlay', { static: false }) selectionOverlay!: ElementRef;

    private scale = 1;
    private lastScale = 1;
    private panX = 0;
    private panY = 0;
    private lastPanX = 0;
    private lastPanY = 0;

    ngAfterViewInit() {
        const container = this.gridContainer.nativeElement;
        const content = this.gridContent.nativeElement;

        let startTouches: TouchList | null = null;

        container.addEventListener('touchstart', (event: TouchEvent) => {
            if (event.touches.length === 2) {
                startTouches = event.touches;
                this.lastScale = this.scale;
                this.lastPanX = this.panX;
                this.lastPanY = this.panY;
            }
        });

        container.addEventListener('touchmove', (event: TouchEvent) => {
            if (event.touches.length === 2 && startTouches) {
                const [touch1, touch2] = event.touches;
                const [startTouch1, startTouch2] = startTouches;

                // Calculate scale
                const startDistance = Math.hypot(
                    startTouch2.clientX - startTouch1.clientX,
                    startTouch2.clientY - startTouch1.clientY
                );
                const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                this.scale = this.lastScale * (currentDistance / startDistance);

                // Calculate pan
                const startMidpoint = {
                    x: (startTouch1.clientX + startTouch2.clientX) / 2,
                    y: (startTouch1.clientY + startTouch2.clientY) / 2,
                };
                const currentMidpoint = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2,
                };
                this.panX = this.lastPanX + (currentMidpoint.x - startMidpoint.x);
                this.panY = this.lastPanY + (currentMidpoint.y - startMidpoint.y);

                // Apply transformations
                content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
            }
        });

        container.addEventListener('touchend', () => {
            startTouches = null;
        });
    }

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
        if (!this.grid() || !this.solution()) {
            return;
        }
        const grid = this.grid()!;
        const solution = this.solution()!;
        await this.pdfService.generatePdf(
            grid,
            solution.map(x => x.word),
            this.title() || 'Word Search',
            this.url() || ''
        );
    }

    private isSelecting = false;
    private startCell: { row: number; col: number } | null = null;
    private endCell: { row: number; col: number } | null = null;

    startSelection(event: MouseEvent | TouchEvent, row: number, col: number) {
        console.log('start', row, col);
        event.preventDefault();
        this.isSelecting = true;
        this.startCell = { row, col };
    }

    updateSelection(event: MouseEvent | TouchEvent) {
        event.preventDefault();

        const { x, y } = this.getEventPosition(event);
        const attr = document.elementFromPoint(x, y)?.attributes;

        const row = +attr!['data-row' as any].value;
        const col = +attr!['data-col' as any].value;

        if (this.isSelecting && this.isValid(this.startCell, { row, col })) {
            this.endCell = { row, col };
            // Highlight selected cells (e.g., add a CSS class)
        }
    }

    endSelection(event: MouseEvent | TouchEvent) {
        event.preventDefault();
        this.isSelecting = false;
        if (this.isValid(this.startCell, this.endCell)) {
            console.log('end');
            this.checkWord(this.startCell, this.endCell);
            this.drawRectangle(this.startCell!, this.endCell!);
        }
        this.startCell = null;
        this.endCell = null;
    }

    checkWord(startCell: { row: number; col: number } | null, endCell: { row: number; col: number } | null) {
        // const word = selectedCells.map(cell => this.grid()![cell.row][cell.col]).join('');
        // if (this.solution()!.some(s => s.word === word)) {
        //     console.log(`Found word: ${word}`);
        //     // Mark the word as found
        // }
    }

    private drawRectangle(startCell: { row: number; col: number }, endCell: { row: number; col: number }) {
        // const overlay = this.selectionOverlay.nativeElement as HTMLElement;
        const gridContent = this.gridContent.nativeElement as HTMLElement;

        // Get the dimensions of the grid cells
        const cellWidth = gridContent.querySelector('td')!.clientWidth;
        const cellHeight = gridContent.querySelector('td')!.clientHeight;

        // Calculate the center of the starting and ending cells
        const startX = startCell.col * cellWidth + cellWidth / 2;
        const startY = startCell.row * cellHeight + cellHeight / 2;
        const endX = endCell.col * cellWidth + cellWidth / 2;
        const endY = endCell.row * cellHeight + cellHeight / 2;

        let offsetX;
        let offsetY;
        if (startX === endX) {
            offsetX = 0;
            offsetY = (cellWidth / 2) * (startY > endY ? 1 : -1);
        } else if (startY === endY) {
            offsetX = (cellWidth / 2) * (startX > endX ? 1 : -1);
            offsetY = 0;
        } else {
            const factor = Math.sin(Math.PI / 4);
            offsetX = factor * (cellWidth / 2) * (startX > endX ? 1 : -1);
            offsetY = factor * (cellWidth / 2) * (startY > endY ? 1 : -1);
        }

        // Calculate the distance (width of the rectangle)
        const distance = Math.hypot(endX - startX, endY - startY);

        // Calculate the angle for rotation
        const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

        // Clear any existing rectangles
        // overlay.innerHTML = '';

        // Create a new rectangle
        const rectangle = document.createElement('div');
        rectangle.classList.add('selection-rectangle');
        rectangle.style.position = 'absolute';
        rectangle.style.width = `${distance + cellWidth}px`;
        rectangle.style.height = `${cellHeight}px`; // Height of one cell
        rectangle.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'; // Semi-transparent blue
        rectangle.style.border = '2px solid rgba(59, 130, 246, 0.8)'; // Tailwind's indigo-500
        rectangle.style.pointerEvents = 'none';
        rectangle.style.transformOrigin = 'left center';
        rectangle.style.transform = `translate(${startX + offsetX}px, ${startY + offsetY - cellHeight / 2}px) rotate(${angle}deg)`;
        rectangle.style.top = '0';
        rectangle.style.left = '0';
        // rectangle.style['z-index' as any] = '1';

        // Add the rectangle to the overlay
        gridContent.appendChild(rectangle);
    }

    private isValid(startCell: { row: number; col: number } | null, endCell: { row: number; col: number } | null): boolean {
        if (startCell === null || endCell === null) {
            return false;
        }

        if (startCell.row === endCell.row && startCell.col !== endCell.col) {
            return true;
        }

        if (startCell.col === endCell.col && startCell.row !== endCell.col) {
            return true;
        }

        if (
            Math.abs(startCell.col - endCell.col) === Math.abs(startCell.row - endCell.row) &&
            startCell.row - endCell.row !== 0
        ) {
            return true;
        }

        return false;
    }

    private getEventPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
        if (event instanceof MouseEvent) {
            return { x: event.clientX, y: event.clientY };
        } else if (event instanceof TouchEvent) {
            const touch = event.touches[0] || event.changedTouches[0];
            return { x: touch.clientX, y: touch.clientY };
        }
        return { x: 0, y: 0 };
    }
}
