(() => {
  const TREASURY_ADDRESS = "0xB6Fd4D73e8641EFa499ef02F7568Bbf1372F3a57";
  const RSTR_TOKEN_ADDRESS = "0x07653b0e1A7fbBC343dc6f96d21A4bf40E628b44";
  const API_ROOT = "https://robinhoodchain.blockscout.com/api/v2";

  const ethEl = document.getElementById("treasury-eth");
  const rstrEl = document.getElementById("treasury-rstr");
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

  const loadTreasury = async () => {
    try {
      const [addressData, tokenData] = await Promise.all([
        fetchJson(`/addresses/${TREASURY_ADDRESS}`),
        fetchJson(`/addresses/${TREASURY_ADDRESS}/tokens?type=ERC-20`),
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

      setStatus("Live from Robinhood Chain.");
    } catch (error) {
      console.error(error);
      if (ethEl) ethEl.textContent = "Unavailable";
      if (rstrEl) rstrEl.textContent = "Unavailable";
      setStatus("Could not load live holdings. Please refresh.");
    }
  };

  loadTreasury();
})();
