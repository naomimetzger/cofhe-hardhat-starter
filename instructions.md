# Fhenix TimeCapsule Project Instructions

## 1) Overview

### Project goals
- Build a social time-capsule dApp where friends write private messages now and reveal them together later.
- Use FHE so messages remain encrypted on-chain until threshold-based unlock and explicit reveal.
- Provide both real on-chain mode and a frontend-only demo mode for onboarding.

### Problem statements
- Traditional group chats are ephemeral and easy to revise; users need a way to "seal" thoughts to future selves.
- Regular smart contracts expose plaintext state; this project needs confidentiality while preserving on-chain logic.
- Group reveal should require coordination (threshold signatures), not unilateral access.

### Core FHE functionality in this repo
- Encrypt user message client-side as `InEuint64` via CoFHE web SDK.
- Store encrypted ciphertext handle in `TimeCapsule.submitMessage()`.
- Grant decrypt permissions after unlock threshold in `signUnlock()` using `FHE.allowPublic(...)`.
- Perform threshold decryption off-chain for tx (`decryptForTx`) and publish verified plaintext on-chain with `FHE.publishDecryptResult(...)`.
- Read published plaintext safely with `FHE.getDecryptResultSafe(...)`.

---

## 2) Tech Stack

### Smart contract / backend tooling
- Solidity `^0.8.28`
- Hardhat `^2.22.19`
- TypeScript (root) `>=4.5.0`
- Ethers `^6.4.0`
- `@fhenixprotocol/cofhe-contracts` `^0.1.3`
- `@cofhe/hardhat-plugin` `^0.5.1`
- `@cofhe/sdk` `^0.5.1`
- `@cofhe/mock-contracts` `^0.5.1`
- OpenZeppelin contracts `^5.0.0`
- dotenv `^16.4.7`

### Frontend
- React `^18.3.1`
- React DOM `^18.3.1`
- Vite `^5.4.10`
- TypeScript (frontend) `^5.6.3`
- React Router DOM `^6.28.0`
- Wagmi `^2.12.30`
- Viem `^2.21.57`
- RainbowKit `^2.1.3`
- TanStack Query `^5.59.20`
- **Fhenix/CoFHE SDK in frontend:** `@cofhe/sdk` `^0.5.1` (loaded via `@cofhe/sdk/web`)

### Deployment / hosting
- Vercel (frontend configured as Vite SPA)
- Target chain: Base Sepolia (`84532`)

---

## 3) Project Structure

```text
capsule-fhe/
  contracts/
    TimeCapsule.sol          # Primary app contract (group capsules + FHE message flow)
    Counter.sol              # Starter/example contract from template
  scripts/
    deploy.js                # Deploys TimeCapsule
  tasks/
    deploy-counter.ts        # Template task
    increment-counter.ts     # Template task
    reset-counter.ts         # Template task
    utils.ts                 # Task utilities
    index.ts                 # Task exports
  test/
    Counter.test.ts          # Template test
  hardhat.config.ts          # Hardhat + CoFHE plugin + Base Sepolia config
  package.json               # Root dependencies/scripts

  frontend/
    src/
      main.tsx               # Providers (wagmi/query/rainbowkit/router/demo)
      App.tsx                # Nav and routes
      styles.css             # Global visual system
      screens/
        HomeScreen.tsx       # Landing + demo entry
        CreateScreen.tsx     # Capsule creation + encrypted submit
        UnlockScreen.tsx     # Unlock/sign/reveal
      lib/
        contracts.ts         # Contract address + ABI
        cofhe.ts             # CoFHE client, encrypt/decrypt helpers
        wagmi.ts             # Wallet + chain config
        messageCodec.ts      # uint64 message encode/decode helper
        logTxError.ts        # Deep tx error diagnostics
      demo/
        DemoContext.tsx      # Frontend-only demo mode state machine
    vite.config.ts           # Vite + worker/wasm config for CoFHE SDK
    vercel.json              # SPA rewrites
    package.json             # Frontend dependencies/scripts
```

---

## 4) FHE Patterns

### 4.1 Encryption pattern (frontend -> contract)
1. User types message in `CreateScreen`.
2. Message is packed into `uint64` in frontend (current implementation stores up to 8 bytes).
3. `encryptUint64Input(...)` in `frontend/src/lib/cofhe.ts`:
   - creates/uses CoFHE web client,
   - executes `client.encryptInputs([Encryptable.uint64(value)]).execute()`,
   - returns encrypted input tuple.
4. Frontend calls `submitMessage(id, encryptedMsg)` on contract.
5. Contract converts input with `FHE.asEuint64(...)`, stores ciphertext handle, and calls `FHE.allowThis(...)`.

### 4.2 Unlock and permission pattern
1. Members call `signUnlock(id)` after `unlockDate`.
2. When `signatures >= threshold`, contract marks unlocked.
3. For each submitted member message, contract grants public decrypt permission using `FHE.allowPublic(ciphertext)`.

### 4.3 Decryption-for-transaction pattern
1. Frontend reads ciphertext handle from `encryptedMessages[id][member]`.
2. Frontend calls `decryptCiphertextForTx(...)`:
   - `client.decryptForTx(ciphertext).withoutPermit().execute()`
   - receives `{ decryptedValue, signature }`.
3. Frontend submits `revealMessage(id, member, decryptedValue, signature)`.
4. Contract verifies and publishes via `FHE.publishDecryptResult(...)`.
5. Anyone reads plaintext with `getRevealedMessage(...)` + `FHE.getDecryptResultSafe(...)`.

### 4.4 Reliability / operational pattern
- Transaction failures are logged with cause-chain + revert selector in `logTxError.ts`.
- Selector can be decoded in terminal:
  - `npx cofhe-errors <0x-selector>`

---

## 5) Coding Standards

### Language and strictness
- TypeScript strict mode enabled at root and frontend (`"strict": true`).
- Prefer explicit typing for external/web3 data (`unknown`, typed casts for ABI results).
- Solidity uses explicit `require(...)` guards and state checks.

### Style conventions used in repo
- React:
  - Function components, hooks, and colocated helper functions.
  - Async actions wrapped in `try/catch/finally` with status state updates.
  - State machine style for multi-step flows (Create screen) and demo mode context.
- Web3:
  - Reads/writes via viem/wagmi clients.
  - Centralized contract ABI/address in `lib/contracts.ts`.
  - CoFHE setup centralized in `lib/cofhe.ts`.
- Errors:
  - Log full error object plus `error.cause`/`error.data` chain.
  - Include phase-based error labels (e.g., `submitMessage`, `createCapsule`) for debugging.

### Linting/formatting status
- No dedicated ESLint/Prettier config currently committed.
- Effective quality gate is TypeScript compile + Vite build (`pnpm run build` in `frontend/`, `pnpm compile` at root).

---

## 6) User Stories

### Core user stories
- As a user, I can connect my wallet and create a named capsule with a future unlock date.
- As a creator, I can add member wallets and define a threshold of required signers.
- As a member, I can submit a private encrypted message that is unreadable until reveal flow completes.
- As a member, I can sign unlock after the unlock date.
- As the group, we can reveal all submitted messages once threshold is met.
- As a user, I can load a capsule by ID and see progress/signing/reveal status.

### Demo user stories
- As a new user, I can click "try the demo" from home.
- In demo mode, I can sign multiple chips and open a prefilled capsule with fake delays and no real chain calls.
- I can clearly see demo state in nav and exit demo at any time.

---

## 7) APIs and Integrations

### Blockchain / wallet
- **Base Sepolia RPC** (configured in `hardhat.config.ts`, chain id `84532`).
- **wagmi + viem** for wallet connection and contract RPC calls.
- **RainbowKit + WalletConnect** (`VITE_WALLETCONNECT_PROJECT_ID`) for wallet UX.

### Fhenix / CoFHE
- `@cofhe/sdk/web` in frontend for encryption/decryption workflows.
- `@fhenixprotocol/cofhe-contracts/FHE.sol` in contract for encrypted types and decrypt publication.
- `@cofhe/hardhat-plugin` for development/testnet integration and mock tooling.

### Hosting / build
- **Vite** frontend build with special worker config for CoFHE worker compatibility.
- **Vercel** SPA deployment (`frontend/vercel.json` rewrite to `index.html`).

### Local persistence
- Browser `localStorage` stores known member lists by capsule id (`capsule:<id>:members`) to aid unlock UI.

---

## Notes for Future Contributors

- `submitMessage` is the most failure-prone path (network rate limits, signer/rpc conditions, CoFHE payload validity). Use `logTxError.ts` output and decoded selectors as first-line debugging.
- Current message packing is `uint64` (8-byte cap). If richer text is required, plan a multi-chunk encrypted message design.
- Demo mode is intentionally frontend-only and should never trigger contract writes.
