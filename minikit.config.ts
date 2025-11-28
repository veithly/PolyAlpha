// Base Mini App manifest source of truth. Fill accountAssociation via
// https://docs.base.org/mini-apps/quickstart/create-new-miniapp/#associate-your-account
// then regenerate deploy/base-mini-app.manifest.json if you change URLs or assets.

const ROOT_URL = "https://polyalpha.vercel.app";

export const minikitConfig = {
  accountAssociation: {
      header: "eyJmaWQiOjEwNzc3NTUsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNENDNzFlNzBBOTMzNEFGMjQ1MGEyNzU0NTM2ZTFlN2M2NjUzQ2Q4In0",
      payload: "eyJkb21haW4iOiJwb2x5YWxwaGEudmVyY2VsLmFwcCJ9",
      signature: "6jMYDAHQdRl4o2CwhrvPRcVJUVMoD3BWWaaP0NFTSpUjkyjBhxrPmL/qV0NKbHN/C64NC5cXRDSwh43Df7PL6hs="
  },
  miniapp: {
    version: "1",
    name: "Polymarket AI Alpha",
    subtitle: "AI outlooks on Polymarket",
    description: "Ask AI, view market heatmaps, and open in Polymarket. Not investment advice.",
    screenshotUrls: [`${ROOT_URL}/assets/dashboard.png`],
    iconUrl: `${ROOT_URL}/assets/polyalpha-icon.png`,
    splashImageUrl: `${ROOT_URL}/assets/polyalpha-splash.png`,
    splashBackgroundColor: "#12326B",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`, // replace or remove when not used
    primaryCategory: "finance",
    tags: ["polymarket", "ai", "insights"],
    heroImageUrl: `${ROOT_URL}/assets/polyalpha-hero.png`,
    tagline: "AI-assisted market radar",
    ogTitle: "PolyAlpha · Polymarket AI",
    ogDescription: "AI outlooks, watchlists, and summaries for Polymarket markets.",
    ogImageUrl: `${ROOT_URL}/assets/polyalpha-hero.png`,
  },
  baseBuilder: {
    ownerAddress: "0xb9c204857A0691CFeD314D11a6ce01b4b19766F1",
  },
} as const;

export type MiniKitConfig = typeof minikitConfig;

export default minikitConfig;
