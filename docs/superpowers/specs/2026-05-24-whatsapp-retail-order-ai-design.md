# WhatsApp Retail Order AI Design

Date: 2026-05-24

## Goal

Build an AI-assisted WhatsApp ordering system for a coconut retail and supply business. The first version is for internal company use with 30 to 60 regular customers such as restaurants, markets, and cafes. The system should later be sellable to other businesses, so the design should avoid hard-coding coconut-only assumptions.

The app should receive customer orders from WhatsApp, identify items and quantities, confirm clear orders automatically, and help office staff combine daily orders into packing and delivery summaries.

## Recommended Approach

Build a WhatsApp-connected AI order system with an admin dashboard.

This approach fits the business because customers already order through WhatsApp, office staff need one place to review orders, and the company needs a nightly combined summary by item. The system should be designed as multi-business ready, but the first release should enable only one business account to keep the build focused.

Alternative approaches considered:

- Manual copy/paste from WhatsApp into a dashboard. This is faster to build but does not solve the automation goal.
- Full SaaS product from the beginning. This is useful later, but too large for the first version.

## Users

Version 1 supports admin and office staff users.

Admin and office staff can:

- Review WhatsApp messages and AI-created orders.
- Add and edit customers.
- Add and edit products.
- Manage customer-specific prices.
- Confirm, edit, cancel, and deliver orders.
- Track payment status and customer balances.
- Generate packing totals and a delivery list.

Driver login is not included in Version 1. Staff can print or send the delivery list to the driver.

## Core Workflow

1. Customer sends an order through WhatsApp.
2. The app receives the message through the WhatsApp Business Cloud API webhook.
3. The app matches the WhatsApp number to an existing customer.
4. AI extracts product, quantity, delivery date, and notes.
5. If the order is clear, the app saves it and automatically replies to confirm item, quantity, and delivery date.
6. If the order is unclear, the AI asks a short follow-up question.
7. If the message is risky or still unclear, it goes to a Needs Review queue for office staff.
8. Office staff review, edit, and manage orders in the dashboard.
9. At night or in the morning, staff generate a selected-date summary with total quantities by item and a customer delivery list.
10. Staff track payment status and outstanding balances.

## WhatsApp And AI Behavior

The AI should act like an order clerk, not a general chatbot.

It should understand:

- English, Malay, Chinese, and mixed-language messages.
- Product names and common nicknames.
- Quantities.
- Delivery dates such as today, tomorrow, or a specific date.
- Customer notes.

It should reply in the same language as the customer when possible.

For clear orders, the reply should only confirm item, quantity, and delivery date. It should not show the price in Version 1.

Example:

> Confirmed: 80 young coconuts for delivery tomorrow. Reply CHANGE if wrong.

For unclear orders, the AI should ask one short clarification question.

Example:

> Do you mean 80 young coconuts or 80 old coconuts?

Messages should go to Needs Review when they include:

- Unknown customer.
- Unknown item.
- Missing quantity.
- Confusing delivery date.
- Unusually large or suspicious quantity.
- Price disputes.
- Complaints.
- Payment disputes.
- Anything the AI cannot confidently classify as a normal order.

## App Structure

### WhatsApp Inbox

Shows incoming WhatsApp messages, AI interpretation, confirmation status, linked customer, linked order, and messages needing staff review.

### Orders

Shows orders by date, customer, order status, and payment status. Staff can edit product, quantity, delivery date, notes, and payment details.

### Customers

Stores customer business name, WhatsApp number, contact person, address, area, customer type, payment terms, and outstanding balance.

### Products

Stores sellable items, unit type, default price, and active status.

### Daily Summary

Shows total quantity needed per item for a selected delivery date. Also shows a customer-by-customer delivery list with address, phone, items, quantities, and notes.

### Payments

Shows unpaid, partial, paid, weekly credit, monthly credit, and customer balances.

## Data Model

### Business

Prepared for future multi-business support.

- id
- name
- WhatsApp business account settings
- active status

Version 1 can create a single business record.

### User

- id
- business id
- name
- email or login identifier
- role: admin or staff
- active status

### Customer

- id
- business id
- business name
- WhatsApp phone number
- contact person
- address
- area
- customer type: restaurant, market, cafe, other
- payment terms: per order, weekly, monthly
- active status

### Product

- id
- business id
- name
- aliases or nicknames
- unit: piece, box, bottle, kg, or custom
- default price
- active status

### Customer Special Price

- id
- customer id
- product id
- price
- active status

When pricing an order item, customer special price should be used first. If no special price exists, use product default price. Staff can manually override the price in the dashboard.

### Order

- id
- business id
- customer id
- source: WhatsApp or manual
- delivery date
- order status: draft, confirmed, needs review, cancelled, delivered
- payment status: unpaid, partial, paid, credit
- amount paid
- total amount calculated internally
- notes
- created time
- updated time

### Order Item

- id
- order id
- product id
- quantity
- unit
- unit price used internally
- manual price override flag

### Message

- id
- business id
- customer id when known
- WhatsApp message id
- direction: inbound or outbound
- message text
- detected language
- AI confidence
- linked order id when available
- created time

### Payment

- id
- business id
- customer id
- order id when linked to a specific order
- amount
- method: cash, bank transfer, e-wallet, credit, other
- payment date
- notes

## Payment Tracking

Version 1 should include lightweight payment tracking, not full accounting.

Each order should support:

- total amount
- amount paid
- amount still owing
- payment status
- payment method
- payment notes

Each customer should support:

- outstanding balance
- payment history
- payment terms such as per order, weekly, or monthly

The app should make it easy to see who owes money, but it does not need invoices, tax reports, or accounting exports in Version 1.

## Delivery And Packing

The business currently has one lorry driver, so Version 1 should not include driver assignment or route optimization.

For each selected delivery date, the app should generate:

- Packing total by item.
- Customer delivery list.
- Address and phone number for each customer.
- Items and quantities per customer.
- Notes for delivery.
- Payment status or amount to collect when useful for staff.

Later versions can add driver login, multiple lorries, route planning, and delivery proof.

## Error Handling And Review Rules

The system should prefer safe review over wrong automation.

Needs Review should be used when:

- Customer cannot be matched by WhatsApp number.
- Product cannot be matched confidently.
- Quantity is missing or ambiguous.
- Delivery date is missing and cannot be safely assumed.
- Message includes more than one possible meaning.
- Customer asks about pricing, complaints, or payment problems.
- AI confidence is below the configured threshold.

Office staff should be able to edit the AI result and send a corrected confirmation.

## Version 1 Scope

Included:

- WhatsApp Business Cloud API connection.
- AI order extraction from English, Malay, Chinese, and mixed messages.
- Auto-confirmation for clear orders.
- Review queue for unclear or risky messages.
- Admin and office staff dashboard.
- Customer management.
- Product management.
- Customer-specific pricing.
- Order management.
- Delivery date filtering.
- Daily item total summary.
- Customer delivery list.
- Payment tracking.
- Outstanding balance by customer.
- Single business enabled, with database structure prepared for multiple businesses later.

Not included:

- Driver login.
- Route optimization.
- Multiple lorry or driver assignment.
- Full accounting system.
- Customer mobile app.
- Online payment gateway.
- Subscription billing for selling the system.
- Multi-company SaaS administration dashboard.

## Success Criteria

The first version is successful when:

- Office staff can manage 30 to 60 regular customers.
- Customers can send WhatsApp orders in English, Malay, Chinese, or mixed language.
- Clear orders are automatically confirmed without staff typing a reply.
- Unclear orders are visible in a review queue.
- Staff can generate a selected-date total by item.
- Staff can generate a delivery list for the single lorry driver.
- Staff can track paid, unpaid, partial, and credit orders.
- Customer-specific prices are used internally without showing price in the WhatsApp confirmation.

## Future Expansion

After the internal version works, the app can become a sellable product by adding:

- Multi-company signup and onboarding.
- Business-specific WhatsApp setup.
- Subscription billing.
- More roles and permissions.
- Driver app or driver login.
- Route planning.
- Reports and accounting exports.
- Business-specific AI training and templates.
