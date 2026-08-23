const TREASURY_ADDRESS = "0x77b6ab0572b43710ff06cd4d9d18f28eb22a5139";
const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api/v2";
const ROBINHOOD_API = "https://api.robinhood.com/rhj";
const TRUSTED_TOKENS: Record<string, { symbol: string; fixedPrice?: number }> = {
  "0x07653b0e1a7fbbc343dc6f96d21a4bf40e628b44": { symbol: "RSTR" },
  "0x5fc5360d0400a0fd4f2af552add042d716f1d168": { symbol: "USDG", fixedPrice: 1 },
  "0x0bd7d308f8e1639fab988df18a8011f41eacad73": { symbol: "WETH" },
};
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type TokenBalance = { value?: string; token?: { address_hash?: string; decimals?: string | number; symbol?: string } };
type RobinhoodAsset = { tokenSymbol?: string; currentMultiplier?: string; status?: string; deployments?: Array<{ contractAddress?: string; chainId?: number }> };
type Holding = { symbol: string; balance: number; usdValue: number | null };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const [address, tokenBalances, registry, ethPrice] = await Promise.all([
      fetchJson(`${BLOCKSCOUT_API}/addresses/${TREASURY_ADDRESS}`),
      fetchJson(`${BLOCKSCOUT_API}/addresses/${TREASURY_ADDRESS}/tokens?type=ERC-20`),
      fetchJson(`${ROBINHOOD_API}/assets`),
      fetchOptionalJson("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"),
    ]);

    const ethUsd = finiteNumber(ethPrice?.ethereum?.usd);
    const registeredAssets = new Map<string, RobinhoodAsset>();
    for (const asset of registry.assets || []) {
      if (asset.status !== "ASSET_STATUS_ACTIVE") continue;
      const deployment = asset.deployments?.find((item: { chainId?: number }) => item.chainId === 4663);
      if (deployment?.contractAddress) registeredAssets.set(deployment.contractAddress.toLowerCase(), asset);
    }

    const holdings: Holding[] = [];
    const nativeBalance = decimalBalance(address.coin_balance, 18);
    if (nativeBalance > 0) holdings.push({ symbol: "ETH", balance: nativeBalance, usdValue: ethUsd ? nativeBalance * ethUsd : null });

    const trustedBalances = (tokenBalances.items || [])
      .map((item: TokenBalance) => ({ item, address: item.token?.address_hash?.toLowerCase() || "" }))
      .filter(({ address }: { address: string }) => TRUSTED_TOKENS[address] || registeredAssets.has(address));

    const quotes = new Map<string, number>();
    await Promise.all(trustedBalances.map(async ({ address }: { address: string }) => {
      const asset = registeredAssets.get(address);
      if (!asset?.tokenSymbol) return;
      const quote = (await fetchOptionalJson(`${ROBINHOOD_API}/prices/${encodeURIComponent(asset.tokenSymbol)}`))?.quotes?.[0];
      const midpoint = (finiteNumber(quote?.bid) + finiteNumber(quote?.ask)) / 2;
      if (midpoint > 0) quotes.set(address, midpoint * (finiteNumber(asset.currentMultiplier) || 1));
    }));

    for (const { item, address } of trustedBalances) {
      const trusted = TRUSTED_TOKENS[address];
      const asset = registeredAssets.get(address);
      const balance = decimalBalance(item.value, Number(item.token?.decimals || 18));
      if (balance <= 0) continue;
      const price = trusted?.fixedPrice ?? quotes.get(address) ?? (trusted?.symbol === "WETH" ? ethUsd : null);
      holdings.push({ symbol: trusted?.symbol || asset?.tokenSymbol || item.token?.symbol || "Token", balance, usdValue: price == null ? null : balance * price });
    }

    holdings.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1) || a.symbol.localeCompare(b.symbol));
    return json({ address: TREASURY_ADDRESS, holdings, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    return json({ error: "Portfolio data is temporarily unavailable" }, 502);
  }
});

async function fetchJson(url: string) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upstream request failed");
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}
async function fetchOptionalJson(url: string) { try { return await fetchJson(url); } catch { return null; } }
function decimalBalance(rawValue: unknown, decimals: number) {
  const value = Number(String(rawValue || "0")) / 10 ** decimals;
  return Number.isFinite(value) ? value : 0;
}
function finiteNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
