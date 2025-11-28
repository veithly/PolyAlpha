"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { LogoMark } from "./LogoMark";
import { useAiDrawer } from "./ai-drawer-context";
import { HomeIcon, MarketsIcon, SettingsIcon, SparkIcon } from "./icons";

const navLinks = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/market/watchlist", label: "Markets", icon: MarketsIcon, disabled: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppHeader() {
  const pathname = usePathname();
  const { setOpen, setContext } = useAiDrawer();

  const renderWalletButton = () => (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openConnectModal,
        openAccountModal,
        openChainModal,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain;
        const isWrongNetwork = Boolean(connected && chain?.unsupported);
        const chainLabel = chain?.name ?? "Base";

        return (
          <div
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {connected ? (
              <>
                <button
                  type="button"
                  onClick={openChainModal}
                  className="pill-button pill-button--ghost"
                  style={{
                    padding: "10px 12px",
                    borderColor: isWrongNetwork
                      ? "var(--color-negative)"
                      : "var(--color-border-strong)",
                    background: isWrongNetwork
                      ? "rgba(255, 92, 92, 0.12)"
                      : "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  aria-label="Switch network"
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 4,
                      background: isWrongNetwork
                        ? "var(--color-negative)"
                        : "var(--color-success)",
                      boxShadow: "inset 0 0 0 1px var(--color-border-strong)",
                    }}
                  />
                  {isWrongNetwork ? "Switch to Base" : chainLabel}
                </button>
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="pill-button pill-button--primary"
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  aria-label="Account"
                >
                  {account.displayName}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openConnectModal}
                className="pill-button pill-button--primary"
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(76, 141, 255, 0.25)",
                }}
                aria-label="Connect wallet"
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--color-text-muted)",
                  }}
                />
                Connect wallet
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );

  return (
    <header
      className="card"
      style={{
        marginBottom: 28,
        padding: 16,
        borderColor: "var(--color-border-strong)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark size={40} />
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>PolyAlpha</div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Polymarket AI Copilot
            </div>
          </div>
        </Link>

        <nav className="app-nav" style={{ flex: 1, justifyContent: "flex-end", rowGap: 6, minWidth: 260, alignItems: "center" }}>
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-disabled={link.disabled}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.9rem",
                  color:
                    pathname === link.href
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  opacity: link.disabled ? 0.4 : 1,
                  pointerEvents: link.disabled ? "none" : "auto",
                }}
              >
                <Icon size={18} aria-hidden />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="pill-button pill-button--primary"
            onClick={() => {
              setContext(null);
              setOpen(true);
            }}
            style={{ padding: "10px 14px" }}
          >
            AI
          </button>
          {renderWalletButton()}
        </nav>
      </div>

      <div className="mobile-nav">
        <div className="mobile-nav__items">
          <Link href="/" className={pathname === "/" ? "active" : ""} aria-label="Home">
            <HomeIcon aria-hidden />
            <span className="sr-only">Home</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setContext(null);
              setOpen(true);
            }}
            aria-label="Open AI assistant"
            className={pathname.startsWith("/market") ? "" : ""}
          >
            <SparkIcon aria-hidden />
            <span className="sr-only">AI</span>
          </button>
          <Link href="/settings" className={pathname === "/settings" ? "active" : ""} aria-label="Settings">
            <SettingsIcon aria-hidden />
            <span className="sr-only">Settings</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
