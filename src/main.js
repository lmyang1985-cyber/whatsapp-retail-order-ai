import { createInitialState, deriveState, receiveComposerMessage } from "./app/state.js";

let state = createInitialState();

function customerName(customerId) {
  return state.customers.find((customer) => customer.id === customerId)?.businessName ?? "Unknown";
}

function productName(productId) {
  return state.products.find((product) => product.id === productId)?.name ?? "Unknown item";
}

function money(amount) {
  return `RM ${amount.toFixed(2)}`;
}

function statusLabel(value) {
  return value.replaceAll("_", " ");
}

function render() {
  const root = document.querySelector("#root");
  const view = deriveState(state);
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">WA</span>
          <div>
            <strong>${state.business.name}</strong>
            <small>Retail Order AI</small>
          </div>
        </div>
        <nav>
          ${["Inbox", "Orders", "Customers", "Products", "Daily Summary", "Payments"].map((item) => `
            <button class="nav-item ${state.activeSection === item ? "active" : ""}" data-action="section" data-section="${item}">
              ${navIcon(item)}
              <span>${item}</span>
            </button>
          `).join("")}
        </nav>
        <div class="sidebar-note">
          <span>Cloud API</span>
          <strong>Webhook ready</strong>
          <small>Single business enabled. Data model is tenant-ready.</small>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <h1>WhatsApp Orders</h1>
            <p>AI-assisted review, packing, delivery, and collection control desk.</p>
          </div>
          <div class="top-controls">
            <label>
              Delivery date
              <input type="date" value="${state.selectedDate}" data-action="date" />
            </label>
            <label>
              Order status
              <select data-action="status-filter">
                ${["all", "confirmed", "needs_review", "delivered", "cancelled"].map((status) => `
                  <option value="${status}" ${state.orderStatusFilter === status ? "selected" : ""}>${statusLabel(status)}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </header>

        <section class="metrics">
          <article>
            <span>Needs review</span>
            <strong>${view.needsReviewCount}</strong>
            <small>Risky or unclear messages</small>
          </article>
          <article>
            <span>Orders for date</span>
            <strong>${view.filteredOrders.length}</strong>
            <small>${state.selectedDate}</small>
          </article>
          <article>
            <span>Amount owing</span>
            <strong>${money(view.unpaidAmount)}</strong>
            <small>Across active customers</small>
          </article>
          <article>
            <span>Packing lines</span>
            <strong>${view.packingTotals.length}</strong>
            <small>Grouped by product</small>
          </article>
        </section>

        <section class="grid">
          ${renderInbox(view)}
          ${renderOrderWorkspace(view)}
          ${renderDailySummary(view)}
          ${renderPayments(view)}
        </section>
      </main>
    </div>
  `;
}

function renderInbox(view) {
  return `
    <section class="panel inbox-panel">
      <div class="panel-head">
        <div>
          <h2>WhatsApp Inbox</h2>
          <p>Inbound messages, AI interpretation, and review routing.</p>
        </div>
        <span class="count">${state.messages.length}</span>
      </div>
      <div class="message-list">
        ${state.messages.map((message) => `
          <button class="message-row ${view.selectedMessage?.id === message.id ? "selected" : ""}" data-action="select-message" data-id="${message.id}">
            <span class="status-dot ${message.status}"></span>
            <span>
              <strong>${message.customerId ? customerName(message.customerId) : "Unknown customer"}</strong>
              <small>${message.text}</small>
            </span>
            <em>${Math.round(message.aiConfidence * 100)}%</em>
          </button>
        `).join("")}
      </div>
      <div class="detail-box">
        <span class="tag ${view.selectedMessage.status}">${statusLabel(view.selectedMessage.status)}</span>
        <h3>${view.selectedMessage.aiSummary}</h3>
        <p>${view.selectedMessage.text}</p>
        <dl>
          <div><dt>Language</dt><dd>${view.selectedMessage.detectedLanguage}</dd></div>
          <div><dt>Review reasons</dt><dd>${view.selectedMessage.reviewReasons.join(", ") || "None"}</dd></div>
          <div><dt>Auto reply</dt><dd>${view.selectedMessage.replyText || "Staff review required before reply"}</dd></div>
        </dl>
        ${view.selectedMessage.status === "needs_review" ? `
          <button class="primary" data-action="mark-reviewed" data-id="${view.selectedMessage.id}">Mark reviewed</button>
        ` : ""}
      </div>
      <form class="composer" data-action="compose">
        <label>From WhatsApp number<input name="phone" value="${state.composerPhone}" /></label>
        <label>Incoming message<textarea name="text" rows="3">${state.composerText}</textarea></label>
        <button class="primary" type="submit">Simulate webhook</button>
        <small>${state.lastOutbound}</small>
      </form>
    </section>
  `;
}

function renderOrderWorkspace(view) {
  return `
    <section class="panel orders-panel">
      <div class="panel-head">
        <div>
          <h2>Orders</h2>
          <p>Edit status, payment state, and staff notes for selected date.</p>
        </div>
      </div>
      <div class="order-table">
        <div class="table-head">
          <span>Customer</span><span>Items</span><span>Status</span><span>Payment</span><span>Total</span>
        </div>
        ${view.filteredOrders.map((order) => `
          <button class="table-row ${view.selectedOrder?.id === order.id ? "selected" : ""}" data-action="select-order" data-id="${order.id}">
            <span>${customerName(order.customerId)}</span>
            <span>${order.items.map((item) => `${item.quantity} ${productName(item.productId)}`).join(", ")}</span>
            <span><mark class="${order.orderStatus}">${statusLabel(order.orderStatus)}</mark></span>
            <span><mark class="${order.paymentStatus}">${statusLabel(order.paymentStatus)}</mark></span>
            <span>${money(order.totalAmount)}</span>
          </button>
        `).join("")}
      </div>
      <div class="detail-box order-edit">
        <h3>${customerName(view.selectedOrder.customerId)}</h3>
        <p>${view.selectedOrder.items.map((item) => `${item.quantity} ${item.unit} ${productName(item.productId)}`).join(", ")}</p>
        <div class="control-row">
          <label>Status
            <select data-action="order-status" data-id="${view.selectedOrder.id}">
              ${["confirmed", "needs_review", "cancelled", "delivered"].map((status) => `
                <option value="${status}" ${view.selectedOrder.orderStatus === status ? "selected" : ""}>${statusLabel(status)}</option>
              `).join("")}
            </select>
          </label>
          <label>Payment
            <select data-action="payment-status" data-id="${view.selectedOrder.id}">
              ${["unpaid", "partial", "paid", "credit"].map((status) => `
                <option value="${status}" ${view.selectedOrder.paymentStatus === status ? "selected" : ""}>${statusLabel(status)}</option>
              `).join("")}
            </select>
          </label>
        </div>
        <textarea data-action="notes" data-id="${view.selectedOrder.id}" rows="3">${view.selectedOrder.notes}</textarea>
      </div>
    </section>
  `;
}

function renderDailySummary(view) {
  return `
    <section class="panel summary-panel">
      <div class="panel-head">
        <div>
          <h2>Daily Summary</h2>
          <p>Packing totals and one-lorry delivery list.</p>
        </div>
      </div>
      <div class="split">
        <div>
          <h3>Packing totals</h3>
          ${view.packingTotals.map((row) => `
            <div class="total-row"><strong>${row.productName}</strong><span>${row.quantity} ${row.unit}</span></div>
          `).join("") || "<p>No confirmed packing needed for this date.</p>"}
        </div>
        <div>
          <h3>Delivery list</h3>
          ${view.deliveryList.map((row) => `
            <div class="delivery-row">
              <strong>${row.customerName}</strong>
              <span>${row.items}</span>
              <small>${row.area} · ${row.address}</small>
              <em>${row.paymentStatus} · collect ${money(row.amountToCollect)}</em>
            </div>
          `).join("") || "<p>No deliveries for this date.</p>"}
        </div>
      </div>
    </section>
  `;
}

function renderPayments(view) {
  return `
    <section class="panel payments-panel">
      <div class="panel-head">
        <div>
          <h2>Payments</h2>
          <p>Lightweight balances for office collection follow-up.</p>
        </div>
      </div>
      ${view.balances.map(({ customer, balance }) => `
        <div class="balance-row">
          <span>
            <strong>${customer.businessName}</strong>
            <small>${customer.paymentTerms} · ${customer.customerType}</small>
          </span>
          <mark class="${balance > 0 ? "partial" : "paid"}">${money(balance)}</mark>
        </div>
      `).join("")}
    </section>
  `;
}

function navIcon(item) {
  const icons = {
    Inbox: "M",
    Orders: "O",
    Customers: "C",
    Products: "P",
    "Daily Summary": "D",
    Payments: "$",
  };
  return `<i aria-hidden="true">${icons[item]}</i>`;
}

function attachEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "compose") return;
    if (action === "section") state = { ...state, activeSection: target.dataset.section };
    if (action === "select-message") state = { ...state, selectedMessageId: target.dataset.id };
    if (action === "select-order") state = { ...state, selectedOrderId: target.dataset.id };
    if (action === "mark-reviewed") {
      state = {
        ...state,
        messages: state.messages.map((message) =>
          message.id === target.dataset.id
            ? { ...message, status: "reviewed", aiConfidence: Math.max(message.aiConfidence, 0.75) }
            : message,
        ),
      };
    }
    render();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    if (action === "date") state = { ...state, selectedDate: target.value };
    if (action === "status-filter") state = { ...state, orderStatusFilter: target.value };
    if (action === "order-status" || action === "payment-status") {
      const key = action === "order-status" ? "orderStatus" : "paymentStatus";
      state = {
        ...state,
        orders: state.orders.map((order) =>
          order.id === target.dataset.id ? { ...order, [key]: target.value, updatedAt: new Date().toISOString() } : order,
        ),
      };
    }
    render();
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.action === "notes") {
      state = {
        ...state,
        orders: state.orders.map((order) =>
          order.id === target.dataset.id ? { ...order, notes: target.value } : order,
        ),
      };
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.dataset.action !== "compose") return;
    event.preventDefault();
    const form = new FormData(event.target);
    state = {
      ...state,
      composerPhone: form.get("phone").toString(),
      composerText: form.get("text").toString(),
    };
    state = receiveComposerMessage(state);
    render();
  });
}

if (typeof document !== "undefined") {
  attachEvents();
  render();
}
