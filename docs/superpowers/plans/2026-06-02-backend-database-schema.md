# Backend And Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local backend API and durable database schema for the WhatsApp retail order AI spec.

**Architecture:** Keep the app dependency-free with Node built-ins. Add a PostgreSQL-ready schema for the target production database, plus a JSON-file repository for local development and tests. Expose REST-style `/api/*` handlers and a combined static/API server so the existing frontend can be migrated incrementally.

**Tech Stack:** Native Node HTTP server, plain JavaScript modules, Node test runner, SQL migration file.

---

### Task 1: Backend Contract Tests

**Files:**
- Create: `src/backend/backend.test.js`

- [x] **Step 1: Write failing tests**

Cover schema table names, repository seed loading, list endpoints, daily summary endpoint, webhook simulation endpoint, review action endpoint, and payment update endpoint.

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test src/backend/backend.test.js`
Expected: FAIL because backend modules and schema do not exist yet.

### Task 2: Schema And Repository

**Files:**
- Create: `db/schema.sql`
- Create: `src/backend/createSeedDatabase.js`
- Create: `src/backend/jsonDatabase.js`

- [x] **Step 1: Add database schema**

Create tables for businesses, users, customers, products, customer special prices, orders, order items, messages, and payments, including foreign keys, status checks, tenant keys, and operational indexes.

- [x] **Step 2: Add local repository**

Create a JSON-file capable repository that can also run in memory for tests.

### Task 3: API Layer And Server

**Files:**
- Create: `src/backend/api.js`
- Create: `scripts/backend-server.js`
- Modify: `scripts/dev-server.js`
- Modify: `package.json`

- [x] **Step 1: Add API handlers**

Implement `GET /api/bootstrap`, `GET /api/orders`, `GET /api/daily-summary`, `POST /api/whatsapp/webhook`, `POST /api/messages/:id/reviewed`, and `PATCH /api/orders/:id/payment`.

- [x] **Step 2: Add server script**

Serve API routes and static frontend files from one process.

- [x] **Step 3: Update package scripts**

Make `npm test` include backend tests and make `npm run dev` use the combined backend server.

### Task 4: Verification

**Files:**
- Modify only if checks reveal issues.

- [x] **Step 1: Run domain tests**

Run: `node --test src/domain/domain.test.js`

- [x] **Step 2: Run backend tests**

Run: `node --test src/backend/backend.test.js`

- [x] **Step 3: Run static app check**

Run: `node scripts/check-static-app.js`

- [x] **Step 4: Run Playwright QA**

Run: `node scripts/qa-playwright.js`
