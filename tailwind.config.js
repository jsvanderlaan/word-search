/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{html,ts}'],
    theme: {
        extend: {
            fontFamily: {
                grid: ['grid', 'monospace'],
                title: ['title', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
