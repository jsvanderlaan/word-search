import { NgClass, NgStyle } from '@angular/common';
import {
    AfterViewInit,
    Component,
    computed,
    effect,
    ElementRef,
    EventEmitter,
    inject,
    input,
    Output,
    ViewChild,
} from '@angular/core';
import { PdfService } from '../pdf.service';
import { Solution } from '../types';

@Component({
    selector: 'app-result',
    imports: [NgClass, NgStyle],
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

    readonly solved = computed(() => this.solution()?.every(s => s.found()));

    private scale = 1;
    private lastScale = 1;
    private panX = 0;
    private panY = 0;
    private lastPanX = 0;
    private lastPanY = 0;

    constructor() {
        effect(async () => {
            if (this.solved()) {
                const confetti = await import('canvas-confetti');

                confetti.default({
                    particleCount: 500,
                    startVelocity: 20,
                    spread: 360,
                    origin: { x: 0.5, y: 0.2 },
                });
            }
        });
    }

    ngAfterViewInit() {
        document.addEventListener('mouseup', () => {
            this.isSelecting = false;
            this.removeTemp();
            this.startCell = null;
            this.endCell = null;
        });
        document.addEventListener('touchend', () => {
            this.isSelecting = false;
            this.removeTemp();
            this.startCell = null;
            this.endCell = null;
        });

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
        event.preventDefault();
        this.isSelecting = true;
        this.startCell = { row, col };
    }

    updateSelection(event: MouseEvent | TouchEvent) {
        if (!this.isSelecting) {
            return;
        }

        event.preventDefault();

        const { x, y } = this.getEventPosition(event);
        const attr = document.elementFromPoint(x, y)?.attributes;

        if (!attr) {
            return;
        }

        const dataRow = attr['data-row' as any];
        const dataCol = attr['data-col' as any];

        if (!dataCol || !dataRow) {
            return;
        }

        const row = +dataRow.value;
        const col = +dataCol.value;

        if (this.isValid(this.startCell, { row, col })) {
            this.endCell = { row, col };
            this.drawRectangle(this.startCell!, this.endCell, true);
        }
    }

    endSelection(event: MouseEvent | TouchEvent) {
        event.preventDefault();
        this.isSelecting = false;
        this.removeTemp();
        if (this.isValid(this.startCell, this.endCell)) {
            const solution = this.checkWord(this.startCell, this.endCell);
            if (solution !== null) {
                this.drawRectangle(this.startCell!, this.endCell!, false);
                solution.found.set(true);
            }
        }

        this.startCell = null;
        this.endCell = null;
    }

    checkWord(startCell: { row: number; col: number } | null, endCell: { row: number; col: number } | null): Solution | null {
        if (!startCell || !endCell || !this.grid() || !this.solution()) {
            return null;
        }

        const grid = this.grid()!;
        const solution = this.solution()!;

        // Determine the direction of the selection
        const deltaRow = endCell.row - startCell.row;
        const deltaCol = endCell.col - startCell.col;

        // Normalize the direction to get the step values
        const stepRow = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow);
        const stepCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);

        // Collect the selected word
        const selectedWord: string[] = [];
        let currentRow = startCell.row;
        let currentCol = startCell.col;

        while (true) {
            selectedWord.push(grid[currentRow][currentCol]);

            if (currentRow === endCell.row && currentCol === endCell.col) {
                break;
            }

            currentRow += stepRow;
            currentCol += stepCol;
        }

        const word = selectedWord.join('');

        // Check if the word matches any solution
        const foundSolution = solution.find(s => s.word === word || s.word === word.split('').reverse().join(''));
        return foundSolution || null;
    }

    private tempSelection: HTMLDivElement | null = null;

    private removeTemp() {
        const gridContent = this.gridContent.nativeElement as HTMLElement;
        if (this.tempSelection !== null) {
            gridContent.removeChild(this.tempSelection);
            this.tempSelection = null;
        }
    }

    private drawRectangle(startCell: { row: number; col: number }, endCell: { row: number; col: number }, temp: boolean) {
        this.removeTemp();
        const gridContent = this.gridContent.nativeElement as HTMLElement;

        const cellWidth = gridContent.querySelector('td')!.clientWidth;
        const cellHeight = gridContent.querySelector('td')!.clientHeight;

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

        const distance = Math.hypot(endX - startX, endY - startY);
        const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

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

        if (temp) {
            this.tempSelection = rectangle;
        }

        gridContent.appendChild(rectangle);
    }

    private isValid(startCell: { row: number; col: number } | null, endCell: { row: number; col: number } | null): boolean {
        if (startCell === null || endCell === null) {
            return false;
        }

        if (startCell.col === endCell.col && startCell.row === endCell.row) {
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
