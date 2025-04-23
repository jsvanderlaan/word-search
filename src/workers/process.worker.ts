/// <reference lib="webworker" />

import { setupWasm } from '../wasm/wasm_exec';

let initialized = false;

addEventListener('message', async ({ data: { command, payload } }) => {
    if (!initialized) {
        if (!initialized) {
            await loadWasm();
            initialized = true;
        }
        postMessage({ status: 'initialized' });
    }

    try {
        if (command === 'generate') {
            const { words, width, height } = payload;

            const result = (self as any).generate(words, width, height);
            postMessage({ status: 'completed', result });
        }
    } catch (error: any) {
        postMessage({ status: 'error', error: error.message });
    }
});

async function loadWasm(): Promise<void> {
    setupWasm();
    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(fetch('assets/main.wasm'), go.importObject);
    go.run(result.instance);
}
