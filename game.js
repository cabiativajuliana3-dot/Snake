// Elementos del DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

// Configuración del juego
const gridSize = 20;
const gridWidth = 20;
const gridHeight = 20;
const canvasSize = 400;

let snake = [{x: 10, y: 10}];
let direction = {x: 0, y: 0};
let nextDirection = {x: 0, y: 0};
let food = {};
let score = 0;
let gameRunning = false;
let gameLoopInterval = null;
let gameSpeed = 150; // ms (más lento)

// High score
let highScore = localStorage.getItem('snakeHighScore') ? parseInt(localStorage.getItem('snakeHighScore')) : 0;
highScoreSpan.textContent = highScore;

// Obstáculos
let obstacles = [];

// Partículas
let particles = [];

// Pausa
let paused = false;

// Estrellas de fondo
let stars = [];
for (let i = 0; i < 80; i++) {
    stars.push({
        x: Math.random() * canvasSize,
        y: Math.random() * canvasSize,
        size: Math.random() * 2 + 1,
        speed: 0.5 + Math.random() * 0.5
    });
}

// --- Sonidos sintéticos con Web Audio API ---
let audioCtx = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playStartSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function playEatSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 600;
    gain.gain.value = 0.1;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playGameOverSound() {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}
// ---------------------------------------------

// Comida aleatoria
function randomFood() {
    const newFood = {
        x: Math.floor(Math.random() * gridWidth),
        y: Math.floor(Math.random() * gridHeight)
    };
    if (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) ||
        obstacles.some(obs => obs.x === newFood.x && obs.y === newFood.y)) {
        return randomFood();
    }
    return newFood;
}

// Generar obstáculos según puntuación
function generateObstacles(score) {
    const maxObstacles = 3;
    let targetCount = Math.min(Math.floor(score / 5), maxObstacles);
    while (obstacles.length < targetCount) {
        let newObs;
        do {
            newObs = {
                x: Math.floor(Math.random() * gridWidth),
                y: Math.floor(Math.random() * gridHeight)
            };
        } while (
            snake.some(s => s.x === newObs.x && s.y === newObs.y) ||
            (food.x === newObs.x && food.y === newObs.y) ||
            obstacles.some(o => o.x === newObs.x && o.y === newObs.y)
        );
        obstacles.push(newObs);
    }
}

// Crear partículas al comer
function createParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x * gridSize + gridSize/2,
            y: y * gridSize + gridSize/2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color: `hsl(${Math.random() * 360}, 100%, 70%)`
        });
    }
}

// Dibujar todo
function draw() {
    // Fondo negro con estrellas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Estrellas parpadeantes
    stars.forEach(s => {
        let brightness = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 * s.speed + s.x);
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    // Cuadrícula (opcional)
    ctx.strokeStyle = '#0a3a2a';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvasSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvasSize, i * gridSize);
        ctx.stroke();
    }

    // Dibujar obstáculos
    ctx.fillStyle = '#aaa';
    ctx.shadowColor = '#aaa';
    ctx.shadowBlur = 5;
    obstacles.forEach(obs => {
        ctx.fillRect(obs.x * gridSize + 2, obs.y * gridSize + 2, gridSize - 4, gridSize - 4);
    });

    // Dibujar serpiente (con color variable según puntuación)
    snake.forEach((segment, index) => {
        let hue = (score * 10 + index * 5) % 360;
        if (index === 0) {
            ctx.fillStyle = `hsl(${hue}, 100%, 60%)`; // cabeza más brillante
        } else {
            ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        }
        ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowBlur = 8;
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
        if (index === 0) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(segment.x * gridSize + 4, segment.y * gridSize + 4, 4, 4);
            ctx.globalAlpha = 1.0;
        }
    });

    // Dibujar comida
    ctx.fillStyle = '#ff3355';
    ctx.shadowColor = '#ff3355';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/3, 0, 2 * Math.PI);
    ctx.fill();

    // Dibujar partículas
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        return true;
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Si está pausado, mostrar mensaje
    if (paused && gameRunning) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.font = '20px "Press Start 2P", cursive';
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 10;
        ctx.fillText('PAUSA', 120, 200);
        ctx.shadowBlur = 0;
    }
}

// Actualizar lógica
function update() {
    direction = {...nextDirection};
    if (direction.x === 0 && direction.y === 0) return;

    const head = snake[0];
    const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
    };

    // Colisiones con paredes
    if (newHead.x < 0 || newHead.x >= gridWidth || newHead.y < 0 || newHead.y >= gridHeight) {
        gameOver();
        return;
    }

    // Colisión con sí misma
    if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        gameOver();
        return;
    }

    // Colisión con obstáculos
    if (obstacles.some(obs => obs.x === newHead.x && obs.y === newHead.y)) {
        gameOver();
        return;
    }

    snake.unshift(newHead);

    // Comida
    if (newHead.x === food.x && newHead.y === food.y) {
        score++;
        scoreSpan.textContent = score;

        // High score
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            highScoreSpan.textContent = highScore;
        }

        playEatSound();
        createParticles(food.x, food.y);
        food = randomFood();
        generateObstacles(score); // Generar obstáculos según nueva puntuación
    } else {
        snake.pop();
    }

    draw();
}

function gameStep() {
    if (gameRunning && !paused) update();
}

function startGame() {
    if (gameRunning) return;

    initAudio();
    playStartSound();

    snake = [{x: 10, y: 10}];
    direction = {x: 0, y: 0};
    nextDirection = {x: 1, y: 0};
    score = 0;
    scoreSpan.textContent = score;
    obstacles = []; // Reiniciar obstáculos
    particles = []; // Reiniciar partículas
    food = randomFood();
    gameRunning = true;
    paused = false;

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameStep, gameSpeed);
    draw();
}

function gameOver() {
    gameRunning = false;
    paused = false;
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    playGameOverSound();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.font = '20px "Press Start 2P", cursive';
    ctx.fillStyle = '#ff3355';
    ctx.shadowColor = '#ff3355';
    ctx.shadowBlur = 10;
    ctx.fillText('GAME OVER', 50, 180);
    ctx.font = '12px "Press Start 2P", cursive';
    ctx.fillStyle = '#00ff9d';
    ctx.fillText('Pulsa ESPACIO', 70, 260);
    ctx.shadowBlur = 0;
}

// Evento teclado
document.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) e.preventDefault();

    if (e.key === ' ') {
        e.preventDefault();
        if (!gameRunning) {
            startGame();
        }
        return;
    }

    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (gameRunning) {
            paused = !paused;
            if (!paused) {
                // Si reanudamos, aseguramos que el intervalo sigue
                clearInterval(gameLoopInterval);
                gameLoopInterval = setInterval(gameStep, gameSpeed);
            }
        }
        return;
    }

    if (!gameRunning || paused) return;

    const key = e.key;
    if (key === 'ArrowUp' && direction.y !== 1) {
        nextDirection = {x: 0, y: -1};
    } else if (key === 'ArrowDown' && direction.y !== -1) {
        nextDirection = {x: 0, y: 1};
    } else if (key === 'ArrowLeft' && direction.x !== 1) {
        nextDirection = {x: -1, y: 0};
    } else if (key === 'ArrowRight' && direction.x !== -1) {
        nextDirection = {x: 1, y: 0};
    }
});

// Control de velocidad
speedSlider.addEventListener('input', (e) => {
    gameSpeed = parseInt(e.target.value);
    speedValue.textContent = gameSpeed;
    if (gameRunning) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameStep, gameSpeed);
    }
});

// Inicializar audio con clic (requisito navegador)
document.addEventListener('click', () => {
    initAudio();
}, { once: true });

// Pantalla de inicio
function drawStartScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    // Estrellas también en inicio
    stars.forEach(s => {
        ctx.fillStyle = `rgba(255,255,255,${0.5+0.5*Math.sin(Date.now()*0.002*s.speed+s.x)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.font = '14px "Press Start 2P", cursive';
    ctx.fillStyle = '#00ff9d';
    ctx.shadowColor = '#00ff9d';
    ctx.shadowBlur = 10;
    ctx.fillText('SNAKE', 130, 150);
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('Pulsa ESPACIO', 100, 250);
    ctx.shadowBlur = 0;
}

drawStartScreen();
// Animación de estrellas en inicio (opcional)
setInterval(() => {
    if (!gameRunning) drawStartScreen();
}, 50);s