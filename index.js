const pokeApiBase = "https://pokeapi.co/api/v2/pokemon/";
const maxPokemonId = 898;

const difficulties = {
  easy: { pairs: 6, timeLimit: 30 },
  medium: { pairs: 12, timeLimit: 60 },
  hard: { pairs: 15, timeLimit: 70 },
};

let firstCard = null;
let secondCard = null;
let boardStopped = false;
let gameActive = false;

let numClicks = 0;
let matchedPairs = 0;
let totalPairs = 0;

let timerId = null;
let timeRediving = 0;

let powerUpAvailable = true;
let powerUpUsed = false;

function getRandomInt(min, max) {
  const range = max - min + 1;
  const randomValue = Math.random() * range;
  const wholeNumber = Math.floor(randomValue);
  return wholeNumber + min;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const randomIndex = getRandomInt(0, i);

    const temp = arr[i];
    arr[i] = arr[randomIndex];
    arr[randomIndex] = temp;
  }

  return arr;
}

function updateStatus() {
  $("#numClicks").text(numClicks);
  $("#pairsMatched").text(matchedPairs);
  $("#totalPairs").text(totalPairs);

  const remaining = totalPairs - matchedPairs;
  $("#redivingPairs").text(remaining);
}

function setMessage(text, type) {
  const bar = $("#popupMsgBar");

  bar.removeClass("win lose info");

  if (type) {
    bar.addClass(type);
  }

  bar.text(text || "");
}

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;

  const m = String(minutes);
  const s = String(seconds);

  return `${m}:${s}`;
}

// Updates the timer on the screen
function updatetimer() {
  const formatted = formatTime(timeRediving);
  $("#timer").text(formatted);
}

// Starts the countdown
function startTimer() {
  clearInterval(timerId);
  updatetimer();

  timerId = setInterval(function () {
    if (!gameActive) {
      return;
    }

    timeRediving--;
    updatetimer();

    if (timeRediving <= 0) {
      clearInterval(timerId);
      handleGameOver(false);
    }
  }, 1000);
}

// Stops the timer
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function resetBoardState() {
  firstCard = null;
  secondCard = null;
  boardStopped = false;
}

function handleCardClick() {
  // If the game is paused, ignore clicks
  if (!gameActive || boardStopped || powerUpUsed) {
    return;
  }

  const card = $(this);

  // Ignore already matched or already flipped cards
  if (card.hasClass("matched") || card.hasClass("flip")) {
    return;
  }

  // Flip the card
  card.addClass("flip");
  numClicks++;
  updateStatus();

  if (!firstCard) {
    firstCard = card;
    return;
  }

  // Prevents you from choosing same card twice
  if (firstCard.is(card)) {
    return;
  }

  secondCard = card;
  checkForMatch();
}

// Checks to see if two cards match
function checkForMatch() {
  const id1 = firstCard.data("pokeId");
  const id2 = secondCard.data("pokeId");

  if (id1 === id2) {
    handleMatch();
  } else {
    handleNoMatch();
  }
}

// For successful matches
function handleMatch() {
  firstCard.addClass("matched").off("click");
  secondCard.addClass("matched").off("click");

  matchedPairs++;
  updateStatus();
  resetBoardState();

  if (matchedPairs === totalPairs) {
    handleGameOver(true);
  }
}

// For mismatched cards
function handleNoMatch() {
  boardStopped = true;

  setTimeout(function () {
    firstCard.removeClass("flip");
    secondCard.removeClass("flip");
    resetBoardState();
  }, 900);
}

function handleGameOver(won) {
  gameActive = false;
  boardStopped = true;
  stopTimer();

  if (won) {
    setMessage("You matched them all! Victory!!", "win");
  } else {
    setMessage("Time has expired. Game over.", "lose");
  }

  $(".card").off("click");
}

function activatePowerUp() {
  if (!gameActive || !powerUpAvailable || powerUpUsed) {
    return;
  }

  powerUpUsed = true;
  powerUpAvailable = false;
  $("#powerUp").prop("disabled", true);

  setMessage("Revealing all cards for a second...", "info");

  const cards = $(".card");
  const alreadyFlipped = new Set();

  // Flips all cards
  cards.each(function () {
    const c = $(this);

    if (c.hasClass("flip")) {
      alreadyFlipped.add(c.data("index"));
    }

    c.addClass("flip");
  });

  boardStopped = true;

  // Only flips the ones that were hidden after the delay
  setTimeout(function () {
    cards.each(function () {
      const c = $(this);
      const idx = c.data("index");

      const wasOriginallyFlipped = alreadyFlipped.has(idx);
      const isMatched = c.hasClass("matched");

      if (!isMatched && !wasOriginallyFlipped) {
        c.removeClass("flip");
      }
    });

    powerUpUsed = false;
    boardStopped = false;
    setMessage("");
  }, 2500);
}

async function fetchPokemonById(id) {
  const url = `${pokeApiBase}${id}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("There was a problem fetching the pokemon: " + id);
  }

  const data = await response.json();

  const image =
    data.sprites?.other?.["official-artwork"]?.front_default ||
    data.sprites?.front_default ||
    "";

  return {
    id: data.id,
    name: data.name,
    image: image,
  };
}

async function getRandomUniquePokemon(count) {
  const used = new Set();
  const list = [];

  while (list.length < count) {
    const id = getRandomInt(1, maxPokemonId);

    if (used.has(id)) {
      continue;
    }

    used.add(id);

    try {
      const pokemon = await fetchPokemonById(id);

      if (pokemon.image) {
        list.push(pokemon);
      } else {
        used.delete(id);
      }
    } catch {
      used.delete(id);
    }
  }

  return list;
}

function renderBoard(cards) {
  const board = $("#gameBoard");
  board.empty();

  cards.forEach(function (card, index) {
    const element = $(`
      <div class="card" data-poke-id="${card.id}" data-index="${index}">
        <img class="face front" src="${card.image}">
        <img class="face back" src="back.webp">
      </div>
    `);

    board.append(element);
  });

  $(".card").on("click", handleCardClick);
}

async function startGame() {
  const difficultyKey = $("#difficulty").val();
  const config = difficulties[difficultyKey];

  totalPairs = config.pairs;
  matchedPairs = 0;
  numClicks = 0;
  timeRediving = config.timeLimit;

  powerUpAvailable = true;
  powerUpUsed = false;
  $("#powerUp").prop("disabled", false);

  updateStatus();
  updatetimer();
  setMessage("Spawning pokemon...", "info");

  gameActive = false;
  boardStopped = true;
  resetBoardState();
  stopTimer();

  try {
    const pokemonList = await getRandomUniquePokemon(totalPairs);

    const cards = [];

    pokemonList.forEach(function (p) {
      const firstCopy = {
        id: p.id,
        name: p.name,
        image: p.image,
      };

      const secondCopy = {
        id: p.id,
        name: p.name,
        image: p.image,
      };

      cards.push(firstCopy);
      cards.push(secondCopy);
    });

    shuffleArray(cards);
    renderBoard(cards);

    setMessage("Start matching!", "info");
    gameActive = true;
    boardStopped = false;
    startTimer();
  } catch (error) {
    console.error(error);
    setMessage("There was a problem loading the pokemon! ", "lose");
  }
}

function resetGame() {
  gameActive = false;
  boardStopped = false;
  resetBoardState();
  stopTimer();

  numClicks = 0;
  matchedPairs = 0;
  totalPairs = 0;
  timeRediving = 0;

  powerUpAvailable = true;
  powerUpUsed = false;
  $("#powerUp").prop("disabled", false);

  updateStatus();
  updatetimer();
  setMessage("");

  $("#gameBoard").empty();
}

function applyTheme(key) {
  if (key === "dark") {
    $("body").removeClass("lightMode").addClass("darkMode");
  } else {
    $("body").removeClass("darkMode").addClass("lightMode");
  }
}

$(document).ready(function () {
  updateStatus();
  updatetimer();

  $("#start").on("click", startGame);
  $("#reset").on("click", resetGame);
  $("#powerUp").on("click", activatePowerUp);

  $("#theme").on("change", function () {
    applyTheme($(this).val());
  });

  applyTheme($("#theme").val());
});
