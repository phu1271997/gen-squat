# Contributing to GenSquat

Small, focused PRs. Every change ships with a test or a note explaining
why one wasn't practical. This file collects the setup + review
conventions the project relies on.

## Environment

- Python **3.13+** with a virtualenv (contract tests + gltest)
- Node.js **20+** for the Vite / React frontend
- MetaMask browser extension (for live-app testing on Studionet)
- Optional: GenLayer CLI for direct-mode contract debugging

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm install
```

## Contract layer (`contracts/`)

- Single `gl.Contract` subclass named `Contract` per module.
- Storage types: `TreeMap`, `DynArray`, `bigint`, sized ints (`u256`,
  `i256`, ...). **No bare `int` in storage.**
- `TreeMap` keys are `str` at any calldata boundary (see
  `docs/02-common-errors.md` for the full pitfalls list).
- Any `gl.nondet.*` call must live inside `gl.eq_principle.*` or
  `gl.vm.run_nondet`. Prefer `gl.eq_principle.prompt_comparative` for
  free-form rulings; the validator principle must check the *semantics*
  of the verdict, not the JSON shape.
- User-controlled strings that end up in an LLM prompt must go through
  `_sanitize_user_text` (contract-side) and be wrapped in
  `<user_input>` / `<web_data>` XML tags in the prompt.

## Frontend (`src/`)

- MetaMask signs every write. No private key is generated or stored in
  the browser (audit finding R21 / R22).
- Chain switch is explicit: `wallet_switchEthereumChain(0xF1EF)`, then
  `wallet_addEthereumChain` fallback (`switchToStudio` in
  `src/genlayerClient.js`).
- Read-only views use the shared `readClient`; writes use
  `getSigner(walletAddress)` — never mix the two.

## Tests

Direct-VM tests run without a running Studio node:

```bash
gltest tests/
```

Studio integration:

```bash
gltest tests/ --network studionet
```

- Every consensus-flow test **must** install `sim_installMocks` before
  the transaction; skipping the mock produces confusing state-error
  messages, not the actual consensus failure.
- `params` on `sim_installMocks` is a bare dict, never `[{...}]`.

## Local dev loop

```bash
npm run dev            # Vite HMR, http://localhost:5173
npm run build          # production bundle → dist/
npm run lint           # ESLint (advisory; existing warnings pre-date PRs)
```

## Deploying

1. Open <https://studio.genlayer.com/run-debug>.
2. Deploy `contracts/gen_squat_core.py` — verify `Result: SUCCESS`
   (`Status: FINALIZED` alone is not enough).
3. Update `VITE_CONTRACT_ADDRESS` on Vercel (`vercel env rm/add
   VITE_CONTRACT_ADDRESS production`) and redeploy the frontend
   (`vercel deploy --prod --yes`).
4. Record the new address in `README.md` +
   `docs/VERIFICATION.md` + a new `CHANGELOG.md` entry.

## Commit + PR conventions

- Conventional-Commits prefixes: `feat` / `fix` / `chore` / `docs` /
  `test` / `refactor`.
- One logical change per commit. A PR bundles related commits.
- Every non-docs PR includes the relevant test file, updated or new.
- Reviewer feedback goes into the appropriate `docs/ADR-XXX-*.md` when
  it changes a design decision — the ADR file is the durable record.

## Reporting security issues

Open a private issue if the finding could be exploited before a
patch ships; a public issue otherwise. Include the exact revert /
verdict / calldata that reproduces it. Add coverage to
`tests/test_security_fixes.py` (or `tests/test_prompt_injection_defense.py`)
so we can't regress on it later.
