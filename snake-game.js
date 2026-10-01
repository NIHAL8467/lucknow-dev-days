const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const scoreDisplay = document.querySelector("#score");
const bestDisplay = document.querySelector("#best-score");
const statusDisplay = document.querySelector("#game-status");
const overlay = document.querySelector("#board-overlay");
const overlayMessage = document.querySelector("#overlay-message");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");

const cellCount = 20;
const cellSize = canvas.width / cellCount;
const tickDelay = 115;
const bestStorageKey = "lucknow-dev-days-snake-best";
const directions = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

let snake;
let food;
let direction;
let nextDirection;
let score = 0;
let bestScore = readBestScore();
let timerId;
let isRunning = false;

bestDisplay.textContent = formatScore(bestScore);
drawBoard();

function formatScore(value) {
  return String(value).padStart(2, "0");
}

function readBestScore() {
  try {
    const savedScore = Number(localStorage.getItem(bestStorageKey));
    return Number.isSafeInteger(savedScore) && savedScore >= 0 ? savedScore : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(bestStorageKey, String(value));
  } catch {
    statusDisplay.textContent = "Best score won’t be saved in this browser";
  }
}

function startGame() {
  window.clearInterval(timerId);
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  scoreDisplay.textContent = formatScore(score);
  food = makeFood();
  isRunning = true;
  overlay.classList.add("is-hidden");
  pauseButton.disabled = false;
  pauseButton.innerHTML = 'Pause <span aria-hidden="true">Ⅱ</span>';
  statusDisplay.textContent = "Game in progress";
  canvas.focus();
  drawBoard();
  timerId = window.setInterval(moveSnake, tickDelay);
}

function makeFood() {
  let position;
  do {
    position = {
      x: Math.floor(Math.random() * cellCount),
      y: Math.floor(Math.random() * cellCount),
    };
  } while (snake.some((segment) => segment.x === position.x && segment.y === position.y));
  return position;
}

function moveSnake() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const ateFood = head.x === food.x && head.y === food.y;
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
  const hitWall = head.x < 0 || head.x >= cellCount || head.y < 0 || head.y >= cellCount;
  const hitSelf = bodyToCheck.some((segment) => segment.x === head.x && segment.y === head.y);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (ateFood) {
    score += 1;
    scoreDisplay.textContent = formatScore(score);
    if (score > bestScore) {
      bestScore = score;
      bestDisplay.textContent = formatScore(bestScore);
      saveBestScore(bestScore);
    }
    if (snake.length === cellCount * cellCount) {
      drawBoard();
      endGame("You filled the board!");
      return;
    }
    food = makeFood();
  } else {
    snake.pop();
  }
  drawBoard();
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!snake) return;

  context.fillStyle = "#ff815c";
  context.beginPath();
  context.arc((food.x + 0.5) * cellSize, (food.y + 0.5) * cellSize, cellSize * 0.27, 0, Math.PI * 2);
  context.fill();

  snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3;
    context.fillStyle = index === 0 ? "#e5ff88" : "#b8d94d";
    context.beginPath();
    context.roundRect(
      segment.x * cellSize + inset,
      segment.y * cellSize + inset,
      cellSize - inset * 2,
      cellSize - inset * 2,
      index === 0 ? 6 : 4,
    );
    context.fill();
  });
}

function endGame(message = `Game over — score ${score}`) {
  window.clearInterval(timerId);
  isRunning = false;
  pauseButton.disabled = true;
  statusDisplay.textContent = message;
  overlayMessage.textContent = message;
  startButton.textContent = "Play again";
  overlay.classList.remove("is-hidden");
}

function setPaused(isPaused) {
  if (!isRunning && !isPaused) return;
  if (isPaused) {
    window.clearInterval(timerId);
    isRunning = false;
    pauseButton.innerHTML = 'Resume <span aria-hidden="true">▶</span>';
    statusDisplay.textContent = "Game paused";
    overlayMessage.textContent = "Take your time.";
    startButton.textContent = "Resume game";
  } else {
    isRunning = true;
    pauseButton.innerHTML = 'Pause <span aria-hidden="true">Ⅱ</span>';
    statusDisplay.textContent = "Game in progress";
    timerId = window.setInterval(moveSnake, tickDelay);
    canvas.focus();
  }
  overlay.classList.toggle("is-hidden", !isPaused);
  if (isPaused) startButton.focus();
}

function changeDirection(newDirection) {
  if (!isRunning) return;
  if (newDirection.x === -direction.x && newDirection.y === -direction.y) return;
  nextDirection = newDirection;
}

startButton.addEventListener("click", () => {
  if (snake && !isRunning && statusDisplay.textContent === "Game paused") {
    setPaused(false);
  } else {
    startGame();
  }
});

pauseButton.addEventListener("click", () => setPaused(isRunning));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isRunning) {
    setPaused(true);
    return;
  }
  const activeElement = document.activeElement;
  const canSteer = activeElement === canvas || activeElement === document.body;
  if (!canSteer) return;
  const newDirection = directions[event.key] || directions[event.key.toLowerCase()];
  if (!newDirection) return;
  event.preventDefault();
  changeDirection(newDirection);
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.direction;
    const keyByDirection = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
    changeDirection(directions[keyByDirection[name]]);
  });
});
