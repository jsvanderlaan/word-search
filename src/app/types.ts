import { WritableSignal } from '@angular/core';

export interface Solution {
    word: string;
    position: { x: number; y: number; direction: { dx: number; dy: number } };
    found: WritableSignal<boolean>;
}
