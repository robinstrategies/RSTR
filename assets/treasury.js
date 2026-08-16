(() => {
  const TREASURY_ADDRESS = "0xB6Fd4D73e8641EFa499ef02F7568Bbf1372F3a57";
  const RSTR_TOKEN_ADDRESS = "0x07653b0e1A7fbBC343dc6f96d21A4bf40E628b44";
  const API_ROOT = "https://robinhoodchain.blockscout.com/api/v2";
  const HYPERLIQUID_API_ROOT = "https://api.hyperliquid.xyz";

  const ethEl = document.getElementById("treasury-eth");
  const rstrEl = document.getElementById("treasury-rstr");
  const hyperliquidPositionsEl = document.getElementById("hyperliquid-positions");
  const statusEl = document.getElementById("treasury-status");

  const setStatus = (message) => {
    if (statusEl) statusEl.textContent = message;
  };

  const addCommas = (whole) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const formatUnits = (rawValue, decimals, fractionDigits = 4) => {
    const raw = String(rawValue || "0").replace(/^0+/, "") || "0";
    const padded = raw.padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals) || "0";
    const fraction = padded
      .slice(-decimals)
      .slice(0, fractionDigits)
      .replace(/0+$/, "");

    return fraction ? `${addCommas(whole)}.${fraction}` : addCommas(whole);
  };

  const fetchJson = async (path) => {
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Explorer request failed: ${response.status}`);
    }

    return response.json();
  };

  const fetchHyperliquid = async () => {
    const response = await fetch(`${HYPERLIQUID_API_ROOT}/info`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: TREASURY_ADDRESS,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid request failed: ${response.status}`);
    }

    return response.json();
  };

  const formatNumber = (value, fractionDigits = 4) => {
    const number = Number(value);

    if (!Number.isFinite(number)) return "0";

    return number.toLocaleString("en-US", {
      maximumFractionDigits: fractionDigits,
    });
  };

  const renderHyperliquidPositions = (positions) => {
    if (!hyperliquidPositionsEl) return;

    const openPositions = (positions || []).filter((item) => {
      return Number(item.position?.szi || 0) !== 0;
    });

    if (!openPositions.length) {
      hyperliquidPositionsEl.innerHTML = `
        <div class="tracker-box">
          <p class="tracker-label">Position</p>
          <p class="tracker-value">No Open Position</p>
        </div>
      `;
      return;
    }

    hyperliquidPositionsEl.innerHTML = openPositions
      .map((item) => {
        const position = item.position;
        const size = Number(position.szi || 0);
        const direction = size < 0 ? "Short" : "Long";
        const leverageType = position.leverage?.type || "cross";
        const leverageValue = position.leverage?.value || "";

        return `
          <div class="tracker-box">
            <p class="tracker-label">Position</p>
            <p class="tracker-value">${position.coin} ${direction}</p>
          </div>
          <div class="tracker-box">
            <p class="tracker-label">Size</p>
            <p class="tracker-value">${formatNumber(Math.abs(size), 5)} ${position.coin}</p>
          </div>
          <div class="tracker-box">
            <p class="tracker-label">Leverage</p>
            <p class="tracker-value">${leverageValue}x ${leverageType}</p>
          </div>
          <div class="tracker-box">
            <p class="tracker-label">Entry</p>
            <p class="tracker-value">${formatNumber(position.entryPx, 2)}</p>
          </div>
        `;
      })
      .join("");
  };

  const loadTreasury = async () => {
    try {
      const [addressData, tokenData, hyperliquidData] = await Promise.all([
        fetchJson(`/addresses/${TREASURY_ADDRESS}`),
        fetchJson(`/addresses/${TREASURY_ADDRESS}/tokens?type=ERC-20`),
        fetchHyperliquid(),
      ]);

      const rstrHolding = (tokenData.items || []).find((item) => {
        return item.token?.address_hash?.toLowerCase() === RSTR_TOKEN_ADDRESS.toLowerCase();
      });

      if (ethEl) {
        ethEl.textContent = `${formatUnits(addressData.coin_balance, 18, 4)} ETH`;
      }

      if (rstrEl) {
        const decimals = Number(rstrHolding?.token?.decimals || 18);
        rstrEl.textContent = rstrHolding
          ? `${formatUnits(rstrHolding.value, decimals, 2)} RSTR`
          : "0 RSTR";
      }

      renderHyperliquidPositions(hyperliquidData.assetPositions);
      setStatus("Live from Robinhood Chain.");
    } catch (error) {
      console.error(error);
      if (ethEl) ethEl.textContent = "Unavailable";
      if (rstrEl) rstrEl.textContent = "Unavailable";
      renderHyperliquidPositions([]);
      setStatus("Could not load live holdings. Please refresh.");
    }
  };

  loadTreasury();
  window.setInterval(loadTreasury, 300000);
})();
