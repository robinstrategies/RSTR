(() => {
  const TREASURY_ADDRESS = "0x77b6ab0572b43710ff06cd4d9d18f28eb22a5139";
  const PORTFOLIO_API_URL = "https://ztngfvexnbuzwlpmnhrn.supabase.co/functions/v1/treasury-portfolio";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oSLncZRM0-fSmWQK-islCA_-3fl5MiN";
  const HYPERLIQUID_API_ROOT = "https://api.hyperliquid.xyz";
  const holdingsEl = document.getElementById("treasury-holdings");
  const hyperliquidPositionsEl = document.getElementById("hyperliquid-positions");
  const statusEl = document.getElementById("treasury-status");

  const setStatus = (message) => { if (statusEl) statusEl.textContent = message; };
  const formatNumber = (value, fractionDigits = 4) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: fractionDigits }) : "0";
  };
  const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, { headers: { accept: "application/json", ...(options.headers || {}) }, cache: "no-store", ...options });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  };

  const renderHoldings = (holdings) => {
    if (!holdingsEl) return;
    if (!holdings.length) {
      holdingsEl.innerHTML = '<div class="tracker-box"><p class="tracker-label">Portfolio</p><p class="tracker-value">No trusted assets found</p></div>';
      return;
    }
    holdingsEl.innerHTML = holdings.map((holding) => {
      const symbol = escapeHtml(holding.symbol);
      const value = holding.usdValue == null ? "Value unavailable" : `$${formatNumber(holding.usdValue, 2)}`;
      return `<div class="tracker-box"><p class="tracker-label">${symbol}</p><p class="tracker-value">${value}</p><p class="tracker-subvalue">${formatNumber(holding.balance, 4)} ${symbol}</p></div>`;
    }).join("");
  };

  const getHyperliquidWalletValue = (spotData) => (spotData?.balances || []).find((item) => item.coin === "USDC")?.total || "0";
  const renderHyperliquidPositions = (data, spotData) => {
    if (!hyperliquidPositionsEl) return;
    const openPositions = (data?.assetPositions || []).filter((item) => Number(item.position?.szi || 0) !== 0);
    const wallet = `<div class="tracker-box"><p class="tracker-label">Wallet Value</p><p class="tracker-value">$${formatNumber(getHyperliquidWalletValue(spotData), 2)}</p></div>`;
    if (!openPositions.length) {
      hyperliquidPositionsEl.innerHTML = `${wallet}<div class="tracker-box"><p class="tracker-label">Position</p><p class="tracker-value">No Open Position</p></div>`;
      return;
    }
    hyperliquidPositionsEl.innerHTML = wallet + openPositions.map((item) => {
      const position = item.position;
      const size = Number(position.szi || 0);
      return `<div class="tracker-box"><p class="tracker-label">Position</p><p class="tracker-value">${position.coin} ${size < 0 ? "Short" : "Long"}</p></div><div class="tracker-box"><p class="tracker-label">Size</p><p class="tracker-value">${formatNumber(Math.abs(size), 5)} ${position.coin}</p></div><div class="tracker-box"><p class="tracker-label">Leverage</p><p class="tracker-value">${position.leverage?.value || ""}x ${position.leverage?.type || "cross"}</p></div><div class="tracker-box"><p class="tracker-label">Entry</p><p class="tracker-value">${formatNumber(position.entryPx, 2)}</p></div>`;
    }).join("");
  };

  const loadTreasury = async () => {
    const [portfolio, hyperliquid, hyperliquidSpot] = await Promise.allSettled([
      fetchJson(PORTFOLIO_API_URL, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
      }),
      fetchJson(`${HYPERLIQUID_API_ROOT}/info`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "clearinghouseState", user: TREASURY_ADDRESS }) }),
      fetchJson(`${HYPERLIQUID_API_ROOT}/info`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "spotClearinghouseState", user: TREASURY_ADDRESS }) }),
    ]);
    if (portfolio.status === "fulfilled") renderHoldings(portfolio.value.holdings || []);
    else {
      console.error(portfolio.reason);
      if (holdingsEl) {
        holdingsEl.innerHTML = '<div class="tracker-box"><p class="tracker-label">Portfolio</p><p class="tracker-value">Temporarily unavailable</p></div>';
      }
    }
    renderHyperliquidPositions(hyperliquid.status === "fulfilled" ? hyperliquid.value : null, hyperliquidSpot.status === "fulfilled" ? hyperliquidSpot.value : null);
    setStatus(portfolio.status === "fulfilled" ? "Trusted assets and live positions." : "Portfolio data is temporarily unavailable.");
  };

  loadTreasury();
  window.setInterval(loadTreasury, 300000);
})();
