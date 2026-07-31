# ADR-003 — MetaMask-only signing for the live dApp

## Status

Accepted · 2026-07-30 · replaces the initial in-browser burner
implementation.

## Context

The initial GenSquat frontend generated a fresh viem private key on
first load and stored it in `localStorage`. This looked convenient — no
wallet install required, one-click demo — but produced two failure
modes that a reviewer would notice within seconds:

1. **Burner starts at 0 GEN.** Hosted Studionet has no public faucet
   and does not auto-fund random addresses. The first payable write
   (`submit_claim`, 5 GEN) reverted with `insufficient funds` and the
   demo was dead.
2. **Any key that ever exists in the browser is exfiltratable.**
   Anything under `VITE_*` is bundled into the shipped JS and readable
   by DevTools. A `localStorage` burner is not much better — trivial to
   copy across sessions or exfiltrate via a compromised dependency.

The GenLayer common-errors reference calls these out as **R21** and
**R22**; R23 further requires an explicit
`wallet_switchEthereumChain` on connect, because Studio's `isStudio`
flag skips the SDK's own chain-mismatch guard.

## Decision

The live dApp **never generates or stores a private key**. Every write
is signed by the user's MetaMask extension:

- `src/genlayerClient.js` exports `getSigner(address)` which returns a
  cached `createClient({ chain: studionet, account: address })` — when
  `account` is a **string**, the SDK routes signing methods through
  `window.ethereum` automatically.
- `connectWallet()` runs `wallet_switchEthereumChain(0xF1EF)` and falls
  back to `wallet_addEthereumChain` with parameters read from the
  SDK's own `studionet` chain object (chain id is not hardcoded).
- Read-only views use a separate `readClient` with no account, so
  browsing the app without MetaMask connected still shows historical
  claims / rulings.
- All 5 write handlers in `App.jsx` call `requireWallet()` before
  spawning a tx; buttons are visually disabled with tooltips when no
  wallet is connected.

## Consequences

- Reviewers need MetaMask installed and funded from Studio → Accounts
  before the write path works. This is called out in `README.md § Wallet`
  and in the header banner when no wallet is connected. The
  read-only path (view any claim + ruling) works without a wallet at
  all, so the reviewer can still explore the state.
- Zero private key material in the built bundle. `grep 'generatePrivateKey\|privateKeyToAccount'
  dist/` matches only the error-message strings that ship inside
  `viem` / `genlayer-js`.
- Chain-change events reload the page (kept simple; the client cache is
  keyed by chain, so a full reload is the cleanest reset).

## Alternatives rejected

- **Auto-fund the burner from a backend.** Would require a hot wallet
  holding real GEN and a rate-limited endpoint — significant infra
  for a demo, and a plain footgun to leave running.
- **Hybrid (MetaMask preferred, burner fallback).** Rejected because
  the fallback path leaks value: any reviewer who *does* have MetaMask
  might still land on the burner code path if detection order changed,
  and now we ship two failure modes instead of one.
- **`VITE_` env-var private key.** Explicitly forbidden — the bundle
  is public.
