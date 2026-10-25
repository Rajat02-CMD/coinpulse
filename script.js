
const API_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1";

const coinGrid = document.getElementById("coin-grid");
const statusMessage = document.getElementById("status-message");
const resultCount = document.getElementById("result-count");
const refreshButton = document.getElementById("refresh-button");
const searchInput = document.getElementById("coin-search");
const sortSelect = document.getElementById("sort-select");
const watchlistToggle = document.getElementById("watchlist-toggle");

const WATCHLIST_KEY = "marketTrackerWatchlist";

let allCoins = [];
let showWatchlistOnly = false;

function loadWatchlist() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(WATCHLIST_KEY) || "[]"
    );

    return new Set(
      Array.isArray(saved)
        ? saved.filter((id) => typeof id === "string")
        : []
    );
  } catch (error) {
    console.error("Could not read watchlist:", error);
    return new Set();
  }
}

let watchlist = loadWatchlist();

function saveWatchlist() {
  try {
    localStorage.setItem(
      WATCHLIST_KEY,
      JSON.stringify([...watchlist])
    );
    return true;
  } catch (error) {
    console.error("Could not save watchlist:", error);
    statusMessage.textContent =
      "Could not save watchlist. Check browser storage settings.";
    return false;
  }
}

function formatCurrency(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 8 : 2
  }).format(value);
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: "compact"
  }).format(value);
}

function updateWatchlistButton(button, coinId) {
  const isSaved = watchlist.has(coinId);

  button.textContent = isSaved
    ? "★ Remove from Watchlist"
    : "☆ Add to Watchlist";

  button.setAttribute("aria-pressed", String(isSaved));
}

function renderCoins(coins) {
  coinGrid.replaceChildren();

  resultCount.textContent = `${coins.length} cryptocurrencies`;

  if (coins.length === 0) {
    statusMessage.textContent = showWatchlistOnly
      ? "No saved coins match your search."
      : "No cryptocurrencies found.";
    return;
  }

  statusMessage.textContent = "";

  const fragment = document.createDocumentFragment();

  coins.forEach((coin) => {
    const card = document.createElement("article");
    card.className = "coin-card";

    const header = document.createElement("div");
    header.className = "coin-header";

    const image = document.createElement("img");
    image.className = "coin-image";
    image.src = coin.image || "";
    image.alt = `${coin.name} logo`;
    image.loading = "lazy";

    const identity = document.createElement("div");

    const name = document.createElement("h3");
    name.className = "coin-name";
    name.textContent = coin.name;

    const symbol = document.createElement("p");
    symbol.className = "coin-symbol";
    symbol.textContent = coin.symbol.toUpperCase();

    identity.append(name, symbol);
    header.append(image, identity);

    const price = document.createElement("p");
    price.className = "coin-price";
    price.textContent = formatCurrency(coin.current_price);

    const change = document.createElement("p");
    const changeValue = coin.price_change_percentage_24h;

    const hasChange =
      typeof changeValue === "number" &&
      Number.isFinite(changeValue);

    change.className = `coin-change ${
      hasChange && changeValue >= 0 ? "positive" : "negative"
    }`;

    change.textContent = hasChange
      ? `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}% (24h)`
      : "24h change unavailable";

    const marketCap = document.createElement("p");
    marketCap.className = "coin-market-cap";
    marketCap.textContent =
      `Market Cap: $${formatNumber(coin.market_cap)}`;

    const watchlistButton = document.createElement("button");
    watchlistButton.type = "button";
    watchlistButton.className = "watchlist-button";
    watchlistButton.dataset.coinId = coin.id;

    updateWatchlistButton(watchlistButton, coin.id);

    card.append(
      header,
      price,
      change,
      marketCap,
      watchlistButton
    );

    fragment.append(card);
  });

  coinGrid.append(fragment);
}

function updateCoinList() {
  const query = searchInput.value.trim().toLowerCase();
  const sortBy = sortSelect.value;

  const filteredCoins = allCoins.filter((coin) => {
    const matchesSearch =
      coin.name.toLowerCase().includes(query) ||
      coin.symbol.toLowerCase().includes(query);

    const matchesWatchlist =
      !showWatchlistOnly || watchlist.has(coin.id);

    return matchesSearch && matchesWatchlist;
  });

  filteredCoins.sort((a, b) => {
    if (sortBy === "price") {
      return (b.current_price ?? 0) - (a.current_price ?? 0);
    }

    if (sortBy === "change") {
      return (
        (b.price_change_percentage_24h ?? -Infinity) -
        (a.price_change_percentage_24h ?? -Infinity)
      );
    }

    return (b.market_cap ?? 0) - (a.market_cap ?? 0);
  });

  renderCoins(filteredCoins);
}

async function loadCoins() {
  refreshButton.disabled = true;
  coinGrid.replaceChildren();
  resultCount.textContent = "";
  statusMessage.textContent = "Loading live market data...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected API response.");
    }

    allCoins = data;
    updateCoinList();
  } catch (error) {
    console.error("Market data error:", error);

    resultCount.textContent = "";
    statusMessage.textContent =
      "Unable to load market data. Check your connection or API access, then try Refresh.";
  } finally {
    refreshButton.disabled = false;
  }
}

// Event delegation: one listener handles all coin-card buttons.
coinGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".watchlist-button");

  if (!button || !coinGrid.contains(button)) return;

  const coinId = button.dataset.coinId;

  if (watchlist.has(coinId)) {
    watchlist.delete(coinId);
  } else {
    watchlist.add(coinId);
  }

  saveWatchlist();
  updateCoinList();
});

searchInput.addEventListener("input", updateCoinList);
sortSelect.addEventListener("change", updateCoinList);

watchlistToggle.addEventListener("click", () => {
  showWatchlistOnly = !showWatchlistOnly;

  watchlistToggle.textContent = showWatchlistOnly
    ? "← All Coins"
    : "⭐ Watchlist";

  updateCoinList();
});

refreshButton.addEventListener("click", loadCoins);

loadCoins();
