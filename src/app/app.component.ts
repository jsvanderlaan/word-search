import { NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { generateBackground } from './background';
import { decodeAZString, encodeAZString } from './grid-encode';
import { ResultComponent } from './result/result.component';
import { Solution } from './types';
import { WorkerService } from './worker.service';

@Component({
    selector: 'app-root',
    imports: [FormsModule, NgClass, ResultComponent],
    templateUrl: './app.component.html',
})
export class AppComponent {
    private readonly workerService: WorkerService = inject(WorkerService);

    readonly grid = signal<string[][] | null>(null);
    readonly solution = signal<Solution[]>([]);
    readonly url = computed(() => {
        const grid =
            this.grid()
                ?.map(row => row.join(''))
                .join('') || '';
        const solution = this.solution();
        if (!grid || !solution) {
            return null;
        }
        const width = this.grid()!
            .map(row => row.length)
            .reduce((a, b) => Math.max(a, b), 0);
        const height = this.grid()!.length;

        const params = new URLSearchParams();
        params.set('g', encodeAZString(grid));
        params.set('w', width.toString());
        params.set('h', height.toString());
        params.set('e', this.edit() ? '1' : '0');

        const serializedSolution = solution
            .map(s => `${s.word}_${s.position.x}_${s.position.y}_${s.position.direction.dx}_${s.position.direction.dy}`)
            .join('.');
        params.set('s', serializedSolution);

        if (this.title) {
            params.set('t', this.title);
        }

        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        return url.length < 2000 ? url : null;
    });

    words: string | null = null;
    width: number | null = null;
    height: number | null = null;
    title: string | null = null;

    readonly edit = signal(true);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    constructor() {
        // on screen resize or rotate
        window.addEventListener('resize', () => generateBackground());
        window.addEventListener('orientationchange', () => generateBackground());

        // set url on url change
        effect(() => {
            const url = this.url();
            window.history.replaceState({}, '', url ?? `${window.location.origin}${window.location.pathname}`);
        });

        // get words from query params
        const urlParams = new URLSearchParams(window.location.search);
        const solution = urlParams.get('s');
        const width = urlParams.get('w');
        const height = urlParams.get('h');
        const grid = urlParams.get('g');
        const title = urlParams.get('t');
        const edit = urlParams.get('e');

        if (edit === '1') {
            this.edit.set(true);
        } else if (edit === '0') {
            this.edit.set(false);
        } else {
            this.edit.set(!grid || !solution);
        }

        if (title) {
            this.title = decodeURIComponent(title);
        }
        if (solution) {
            const parsedSolution = solution.split('.').map(entry => {
                const [word, x, y, dx, dy] = entry.split('_');
                return {
                    word,
                    position: {
                        x: +x,
                        y: +y,
                        direction: { dx: +dx, dy: +dy },
                    },
                    found: signal(false),
                };
            });
            this.solution.set(parsedSolution);
            this.words = parsedSolution.map((x: Solution) => x.word).join('\n');
        }
        if (width) {
            this.width = parseInt(width, 10);
        }
        if (height) {
            this.height = parseInt(height, 10);
        }
        if (grid && this.width && this.height) {
            const str = decodeAZString(grid, this.width * this.height);
            const g: string[][] = [];
            for (let i = 0; i < this.height; i++) {
                const start = i * this.width;
                const end = start + this.width;
                g.push(str.slice(start, end).split(''));
            }
            this.grid.set(g);
        } else if (this.words) {
            this.generate();
        }
    }

    ngAfterViewInit() {
        generateBackground();
    }

    cancel(): void {
        this.workerService.cancel();
        this.loading.set(false);
        this.error.set(null);
        this.edit.set(true);
    }

    clear() {
        this.words = null;
        this.width = null;
        this.height = null;
        this.title = null;
        this.grid.set(null);
        this.solution.set([]);
    }

    generate() {
        this.loading.set(true);
        this.error.set(null);
        this.edit.set(false);

        if (!this.words) {
            this.loading.set(false);
            this.error.set('No words entered.');
            this.edit.set(true);
            return;
        }
        const wordsArray = this.parseWords(this.words);

        if (wordsArray.some(w => w.length < 2)) {
            this.loading.set(false);
            this.error.set('All words must at least contain two characters.');
            this.edit.set(true);
        }

        const containedWords = wordsArray.filter(word =>
            wordsArray.some(otherWord => word !== otherWord && otherWord.includes(word))
        );
        if (containedWords.length > 0) {
            this.loading.set(false);
            this.error.set(`Some words are contained in other words. (${containedWords.join(', ')})`);
            this.edit.set(true);
            return;
        }

        if (this.width === null) {
            this.width = wordsArray.map(word => word.length).reduce((a, b) => Math.max(a, b), 0);
        }

        if (this.height === null) {
            this.height = wordsArray.map(word => word.length).reduce((a, b) => Math.max(a, b), 0);
        }

        if (this.width < 2 || this.height < 2) {
            this.loading.set(false);
            this.error.set('Width and height must be greater than 1.');
            this.edit.set(true);
            return;
        }
        if (this.width > 50 || this.height > 50) {
            this.loading.set(false);
            this.error.set('Width and height must be less than or equal to 50.');
            this.edit.set(true);
            return;
        }

        this.workerService
            .generate(wordsArray.join(','), this.width, this.height)
            .then(result => {
                if (!result?.grid) {
                    this.loading.set(false);
                    this.error.set('No result found. Try a bigger grid or less words.');
                    this.edit.set(true);
                    return;
                }

                this.grid.set(
                    result?.grid
                        .split('\n')
                        .map((row: string) => row.split(' ').filter((row: string) => row.length > 0))
                        .filter((row: string[]) => row.length > 0)
                );
                this.loading.set(false);
                this.error.set(null);
                this.solution.set(
                    result.solution
                        .map((x: Solution) => ({ ...x, found: signal(false) }))
                        .sort((a: Solution, b: Solution) => a.word.localeCompare(b.word, undefined, { sensitivity: 'base' })) ||
                        []
                );
                this.words = wordsArray.join('\n');
            })
            .catch(error => {
                this.loading.set(false);
                this.error.set(error.message);
                this.edit.set(true);
            });
    }

    private parseWords(words: string): string[] {
        return [
            ...new Set(
                words
                    .split('\n')
                    .flatMap(word => word.split(','))
                    .map(word => word.trim().toUpperCase())
                    .map(word => word.replace(/[^A-Z]/g, ''))
                    .filter(word => word.length > 0)
            ),
        ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
}
