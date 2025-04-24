import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { generateBackground } from './background';
import { PdfService } from './pdf.service';
import { WorkerService } from './worker.service';

@Component({
    selector: 'app-root',
    imports: [FormsModule, NgClass],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent {
    private readonly workerService: WorkerService = inject(WorkerService);
    private readonly pdfService: PdfService = inject(PdfService);

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

        if (this.title) {
            params.set('title', this.title);
        }

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
    title: string | null = null;

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    constructor() {
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
        const title = urlParams.get('title');
        if (title) {
            this.title = decodeURIComponent(title);
        }

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
            .filter(word => word.length > 0)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

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
            const result = await this.workerService.generate(wordsArray.join(','), this.width, this.height);
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
        await this.pdfService.generatePdf(grid, words, this.title || 'Word Search', this.url() || '');
    }
}
