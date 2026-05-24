# WhatsApp Retail Order AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local first-version WhatsApp retail order AI admin dashboard with tested order extraction, pricing, daily summaries, delivery lists, and payment tracking.

**Architecture:** Use a dependency-free JavaScript single-page app backed by in-memory seed data and pure domain modules. Keep WhatsApp and AI behavior behind service-style functions so live Cloud API and model calls can replace the local simulator later without rewriting the dashboard.

**Tech Stack:** Native browser modules, plain JavaScript, Node test runner, plain CSS.

---

### Task 1: Domain Model And Tests

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/domain/types.js`
- Create: `src/domain/orderAi.js`
- Create: `src/domain/pricing.js`
- Create: `src/domain/summaries.js`
- Create: `src/domain/payments.js`
- Create: `src/domain/domain.test.js`

- [x] **Step 1: Write failing tests**

Create tests for matching customers by WhatsApp number, extracting clear orders, flagging unclear/risky messages for review, customer-specific pricing, daily packing totals, delivery lists, and payment balances.

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because domain modules are not implemented yet.

- [x] **Step 3: Implement domain modules**

Create focused TypeScript functions with no React dependency:
- `interpretMessage`
- `priceOrderItems`
- `getPackingTotals`
- `getDeliveryList`
- `calculateCustomerBalance`

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

### Task 2: Seed Data And App State

**Files:**
- Create: `src/data/seedData.ts`
- Create: `src/app/state.js`

- [x] **Step 1: Add representative seed data**

Include one business, staff user, customers, products, special prices, WhatsApp messages, orders, and payments.

- [x] **Step 2: Add local app state hook**

Support selecting messages/orders, filtering by delivery date and status, confirming review messages, editing order status/payment status, and creating a manual order from the simulated WhatsApp composer.

### Task 3: Dashboard UI

**Files:**
- Create: `src/main.js`
- Create: `src/styles.css`

- [x] **Step 1: Build app shell and navigation**

Create a compact operational dashboard with sidebar navigation, top business header, status metrics, and delivery date controls.

- [x] **Step 2: Build inbox and review queue**

Show WhatsApp messages, detected language, AI confidence, linked customer, extracted order details, confirmation status, and needs-review reasons.

- [x] **Step 3: Build orders, daily summary, delivery, and payments views**

Make filters and status controls update local UI state. Keep payment amounts internal and do not show price in generated WhatsApp confirmations.

### Task 4: Verification

**Files:**
- Modify only if checks reveal issues.

- [x] **Step 1: Install dependencies**

Skipped. The shell has Node but no package manager on PATH, so the app is dependency-free.

- [x] **Step 2: Run tests**

Run: `npm test`

- [x] **Step 3: Build**

Run: `npm run build`

- [x] **Step 4: Run local app and browser-check dashboard**

Run: `node scripts/dev-server.js`
Verify desktop and mobile render, key controls, and no console-breaking errors.
