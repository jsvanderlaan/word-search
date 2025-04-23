const englishCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const usedPositions: { x: number; y: number; size: number }[] = [];
const maxAttempts = 100;
function generateRandom(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function checkOverlap(x: number, y: number, size: number) {
    for (let pos of usedPositions) {
        let distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
        if (distance < (pos.size + size) / 2) {
            return true; // Overlaps
        }
    }
    return false; // No overlap
}

function createRandomCharacter(fontColor: string, selectedFont: string) {
    const char = document.createElement('div');
    char.className = 'char';

    const characters = englishCharacters;

    char.innerText = characters[generateRandom(0, characters.length - 1)];

    const size = generateRandom(20, 100);
    char.style.fontSize = `${size}px`;
    char.style.color = fontColor;
    char.style.fontFamily = selectedFont;

    let x,
        y,
        attempts = 0;
    do {
        x = generateRandom(0, window.innerWidth - size - 30);
        y = generateRandom(0, window.innerHeight - size - 30);
        attempts++;
    } while (checkOverlap(x, y, size) && attempts < maxAttempts);

    if (attempts < maxAttempts) {
        usedPositions.push({ x, y, size });

        char.style.left = `${x}px`;
        char.style.top = `${y}px`;
        char.style.transform = `rotate(${generateRandom(0, 360)}deg)`;

        document.body.appendChild(char);
    } else {
        console.log('Skipped character due to overcrowding');
    }
}

export function generateBackground() {
    // document.body.style.backgroundColor = document.getElementById('bgColor')?.value;

    document.querySelectorAll('.char').forEach(function (char) {
        char.remove();
    });
    usedPositions.length = 0;

    const charCount = 100;
    const fontColor = 'oklch(0.91 0.04 272.68)';
    const selectedFont = 'Arial, sans-serif';

    for (let i = 0; i < charCount; i++) {
        createRandomCharacter(fontColor, selectedFont);
    }
}
