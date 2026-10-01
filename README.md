# E-Shop World

A full-stack e-commerce application: an Angular 20 storefront and admin panel on top of a Node.js / Express 5 REST API and a MySQL database.

Customers browse a catalogue, build a cart, check out with three payment methods, follow their orders, request returns and write reviews. Admins run the store from a dedicated panel: products and stock, orders, payments, returns, discount codes, categories, reviews and sales analytics.

**Live demo:** https://e-shop-world.vercel.app

| | Email | Password |
|---|---|---|
| Admin panel (read-only demo account) | `demo@e-shop.example` | `Demo1234` |

The demo account opens every admin page but cannot change anything, and customer details are masked. To try the shopping flow (cart, checkout, order tracking, cancellation), register an account of your own. Registration sends a verification email that has to be confirmed before the first order; it may land in the spam folder. Returns and reviews need an order that an admin has marked as delivered, so they are shown in the screenshots below.

> The API runs on a free Render instance that sleeps when idle, so the first request can take 30–60 seconds. The interface is in Greek.

![Storefront](screenshots/home.png)

---

## Table of Contents

- [Highlights](#highlights)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database](#database)
- [Getting Started](#getting-started)
- [Admin Access](#admin-access)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

---

## Highlights

The parts of the project that took the most thought:

- **Orders are transactional.** Checkout runs in a single MySQL transaction with `SELECT ... FOR UPDATE` row locks on the products, size stock and discount code, so two customers cannot buy the last item or both use the last redemption of a code. Prices and totals are always recomputed on the server; the client only sends product ids, sizes and quantities.
- **Per-item returns with partial approval.** A customer returns individual lines of a delivered order, each with its own reason. The admin approves or rejects every line separately. Approved lines go back into stock, the refund is reduced proportionally to any discount on the order, and the payment status becomes `refunded` or `partially_refunded`.
- **Enforced order lifecycle.** Status changes follow a fixed transition map (`pending → processing → shipped → delivered`, cancellation only before shipping). Cancelling restores stock and releases the discount code. A bank-transfer order cannot be marked delivered until the payment is confirmed.
- **Cookie-based authentication.** The JWT lives in an `httpOnly` cookie (`secure` + `sameSite=none` in production) rather than in `localStorage`, so scripts cannot read it. The admin route guard re-checks the role against the server on every navigation instead of trusting cached client state.
- **Hardened endpoints.** Helmet, CORS limited to the frontend origin, rate limiters on login, registration, password reset and discount validation, password-reset and resend-verification responses that do not reveal whether an email is registered, and image uploads verified by magic bytes rather than by extension or MIME type.
- **Sizes with their own stock.** Clothing and shoes carry a stock count per size, which is validated and decremented per size in the same order transaction.
- **Read-only demo role.** A third role next to `user` and `admin` lets anyone look around the live admin panel safely: the auth middleware rejects every write request from a demo account, and the API masks names, emails, phone numbers and addresses before they leave the server.
- **187 backend tests** (Jest + Supertest) covering the auth, order, return, discount and admin routes.

---

## Features

### Storefront

- Product grid with search (accent-insensitive), category filter, price range slider and sorting; filters are kept in the URL so a filtered view can be shared or reloaded
- Product page with image gallery, size picker with per-size availability, ratings, related products and recently viewed products
- Cart as a full page and as a slide-in sidebar; works for guests and is merged into the account on login
- Wishlist for guests (local) and signed-in users (server), also merged on login
- Pagination, skeleton loaders, toast notifications, confirmation dialogs, breadcrumbs, per-page titles and a 404 page
- Responsive layout, tested on a real phone

### Checkout

- Recipient details pre-filled from the profile, with the option to ship to someone else
- Live address preview on an OpenStreetMap map (Leaflet + Nominatim geocoding) with a warning when the postal code does not match
- Shipping: standard courier, express courier or in-store pickup
- Payment: cash on delivery, card (simulated) or bank transfer with IBAN checksum validation (MOD-97)
- Discount codes: percentage or fixed amount, minimum order amount, expiry date, total usage cap and one use per customer
- Gift option with a personal message

### Account

- Registration with email verification; an order cannot be placed until the email is verified
- Forgot / reset password through single-use, expiring email links
- Profile editing, saved address and password change
- Order history with a status timeline, order details and a downloadable PDF receipt
- Order cancellation while the order has not shipped
- Return requests per item, with their own history page
- Reviews limited to products from delivered orders, one per product, editable and removable

### Admin Panel

- Dashboard with totals, alerts for pending orders, payments and returns, and charts (Chart.js) for revenue, orders per day, order status breakdown and top five products over a selectable period
- Products: create, edit, delete, image upload with a multi-image gallery, sizes with per-size stock
- Categories: create, edit, delete (blocked while products still use the category)
- Orders: searchable list with status filters, full order view, status changes, bank-transfer payment confirmation, CSV export
- Returns: per-line approve / reject, note to the customer, automatic refund and restock
- Discount codes: create, edit, activate / deactivate, delete
- Reviews: moderation of all reviews
- Users: customer list with order counts and totals

### Transactional Email

Branded HTML emails for email verification, password reset, order confirmation, order status changes and return decisions. Sent through SendGrid or any SMTP server; with neither configured, the backend falls back to an Ethereal test inbox and prints a preview link to the console.

---

## Screenshots

| Storefront | Admin dashboard |
|---|---|
| ![Product details](screenshots/product-details.png) | ![Admin dashboard](screenshots/admin-dashboard.png) |
| ![Checkout](screenshots/checkout.png) | ![Sales analytics](screenshots/admin-charts.png) |

<details>
<summary><b>Storefront</b></summary>

| | |
|---|---|
| Product grid with filters<br>![Home](screenshots/home.png) | Product page<br>![Product details](screenshots/product-details.png) |
| Product reviews<br>![Product reviews](screenshots/product-reviews.png) | Wishlist<br>![Wishlist](screenshots/wishlist.png) |
| Cart sidebar<br>![Cart sidebar](screenshots/cart-sidebar.png) | Cart page<br>![Cart page](screenshots/cart-page.png) |

</details>

<details>
<summary><b>Checkout</b></summary>

| | |
|---|---|
| Recipient, address and order summary<br>![Checkout](screenshots/checkout.png) | Address map, shipping and payment<br>![Checkout payment](screenshots/checkout-payment.png) |
| Card payment<br>![Card payment](screenshots/checkout-card.png) | Bank transfer<br>![Bank transfer](screenshots/checkout-bank-transfer.png) |
| Discount code applied<br>![Discount code](screenshots/checkout-discount.png) | |

</details>

<details>
<summary><b>Account and authentication</b></summary>

| | |
|---|---|
| Register<br>![Register](screenshots/register.png) | Login<br>![Login](screenshots/login.png) |
| Email verification<br>![Verify email](screenshots/verify-email.png) | Forgot password<br>![Forgot password](screenshots/forgot-password.png) |
| Reset password<br>![Reset password](screenshots/reset-password.png) | Change password<br>![Profile security](screenshots/profile-security.png) |
| Profile<br>![Profile](screenshots/profile.png) | |

</details>

<details>
<summary><b>Orders, returns and reviews</b></summary>

| | |
|---|---|
| Order history<br>![Orders](screenshots/orders.png) | Order details<br>![Order details](screenshots/order-details.png) |
| PDF receipt<br>![PDF receipt](screenshots/order-receipt-pdf.png) | Return request<br>![Return request](screenshots/return-request-form.png) |
| My returns<br>![My returns](screenshots/my-returns.png) | My reviews<br>![My reviews](screenshots/my-reviews.png) |

</details>

<details>
<summary><b>Admin panel</b></summary>

| | |
|---|---|
| Dashboard<br>![Admin dashboard](screenshots/admin-dashboard.png) | Analytics<br>![Admin charts](screenshots/admin-charts.png) |
| Orders<br>![Admin orders](screenshots/admin-orders.png) | Order details<br>![Admin order details](screenshots/admin-order-details.png) |
| Products<br>![Admin products](screenshots/admin-products.png) | Product form<br>![Admin product form](screenshots/admin-product-form.png) |
| Returns<br>![Admin returns](screenshots/admin-returns.png) | Return decision per item<br>![Admin return decision](screenshots/admin-return-decision.png) |
| Discount codes<br>![Admin discounts](screenshots/admin-discounts.png) | Discount code form<br>![Admin discount form](screenshots/admin-discount-form.png) |
| Categories<br>![Admin categories](screenshots/admin-categories.png) | Category form<br>![Admin category form](screenshots/admin-category-form.png) |
| Reviews<br>![Admin reviews](screenshots/admin-reviews.png) | Users<br>![Admin users](screenshots/admin-users.png) |
| Order CSV export<br>![Order CSV](screenshots/admin-order-csv.png) | |

</details>

<details>
<summary><b>Emails</b></summary>

| | |
|---|---|
| Email verification<br>![Verification email](screenshots/email-verification.png) | Order confirmation<br>![Order confirmation email](screenshots/email-order-confirmation.png) |

</details>

<details>
<summary><b>Mobile</b></summary>

<p>
  <img src="screenshots/mobile-home.png" alt="Mobile home" width="260">
  <img src="screenshots/mobile-product.png" alt="Mobile product" width="260">
  <img src="screenshots/mobile-checkout.png" alt="Mobile checkout" width="260">
</p>

</details>

Personal data in the screenshots is masked.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 (standalone components, lazy-loaded routes), TypeScript 5.9, RxJS 7.8 |
| Forms and UI | Reactive Forms, plain CSS with shared design tokens, Chart.js, Leaflet |
| Backend | Node.js, Express 5 |
| Database | MySQL 8 through `mysql2` (connection pool, parameterised queries, transactions) |
| Auth and security | JWT in an `httpOnly` cookie, bcrypt, Helmet, CORS, `express-rate-limit` |
| Files | Multer (in memory) with Cloudinary storage, local disk fallback in development |
| Email | SendGrid or Nodemailer (SMTP), Ethereal fallback in development |
| Documents | PDFKit for receipts, CSV export |
| Testing | Jest + Supertest (backend), Karma + Jasmine (frontend) |
| Hosting | Vercel (frontend), Render (API), Clever Cloud (MySQL) |

---

## Architecture

```
Browser ── Angular SPA (Vercel)
              │  HTTPS, JSON, httpOnly auth cookie
              ▼
          Express REST API (Render) ──► MySQL
              │
              ├──► Cloudinary   product images
              └──► SendGrid     transactional email
```

```
E-Shop-World/
├── src/app/                 Angular application
│   ├── admin/               admin pages (dashboard, products, orders, returns, ...)
│   ├── checkout/            checkout form
│   ├── product-list/        storefront grid and filters
│   ├── guards/              auth, admin and guest route guards
│   ├── services/            API clients, cart, wishlist, auth, HTTP interceptor
│   ├── shared/              reusable components, pipes and helpers
│   └── app.routes.ts        route table (lazy-loaded pages)
├── backend/
│   ├── routes/              customer routes
│   │   └── admin/           admin-only routes
│   ├── middleware/          JWT auth, role check, rate limiters, upload validation
│   ├── utils/               mailer, stock, discount rules, formatting
│   ├── schema.sql           database schema
│   └── server.js            Express entry point
└── screenshots/
```

Test files sit next to the code they test (`orders.js` / `orders.test.js`).

---

## Database

Fifteen tables, defined in [`backend/schema.sql`](backend/schema.sql):

| Area | Tables |
|---|---|
| Users and auth | `users`, `email_verification_tokens`, `password_reset_tokens` |
| Catalogue | `categories`, `products`, `product_images`, `product_size_stock` |
| Orders | `orders`, `order_items` |
| Returns | `return_requests`, `return_request_items` |
| Discounts | `discount_codes`, `discount_code_usages` |
| Engagement | `reviews`, `wishlists` |

Order items store the unit price at the time of purchase, so later price changes do not alter past orders. Unique keys enforce one review per customer per product and one use of a discount code per customer.

---

## Getting Started

### Prerequisites

- Node.js 20.19 or newer
- MySQL 8

### 1. Clone

```bash
git clone https://github.com/theopap7/E-Shop-World.git
cd E-Shop-World
```

### 2. Database

```bash
mysql -u root -p < backend/schema.sql
```

This creates the `ecommerce` database, all tables and five starter categories.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env    # then edit the values
npm run dev
```

The API starts on `http://localhost:3000`.

| Variable | Required | Purpose |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | MySQL connection |
| `JWT_SECRET` | yes | Signing key for the auth token |
| `PORT` | no | API port, defaults to `3000` |
| `FRONTEND_URL` | no | Allowed CORS origin and base of email links, defaults to `http://localhost:4200` |
| `NODE_ENV` | no | Set to `production` on the live host to enable secure cookies |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | no | Send email through SendGrid |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | no | Send email through SMTP |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | Store images on Cloudinary instead of `backend/uploads/` |

Email and image storage work without any third-party account: emails go to an Ethereal test inbox (the preview link is printed in the backend console) and images are saved to `backend/uploads/`.

### 4. Frontend

In a second terminal, from the project root:

```bash
npm install
npm start
```

The app opens on `http://localhost:4200`.

---

## Admin Access

**Locally.** Register an account through the app, then promote it:

```sql
UPDATE users SET role = 'admin', email_verified = TRUE WHERE email = 'you@example.com';
```

Log out and back in, and a "Διαχείριση" (Admin) button appears in the header. A fresh database has no products, so the first step is to add a few from **Admin → Products**.

**Read-only demo account.** Setting `role = 'demo'` instead of `'admin'` gives an account that can open the admin panel but not modify anything:

- every `POST`, `PUT`, `PATCH` and `DELETE` request from that account is rejected with `403` in the auth middleware, including its own profile and password
- customer names, emails, phone numbers, addresses and IBANs are masked in admin responses, the CSV export and the PDF receipt
- password reset is disabled for it

**On the live demo.** Sign in with the demo account listed at the top of this page. New registrations are regular customer accounts for the shopping flow. Full admin access is not public, because it allows destructive actions and shows customer data.

---

## Testing

```bash
# Backend: 187 tests in 17 suites (Jest + Supertest, database mocked)
cd backend
npm test

# Frontend: 44 specs (Karma + Jasmine), from the project root
cd ..
npm test
```

The backend suites exercise the routes through HTTP: authentication, order creation and stock checks, cancellation, returns and refunds, discount rules, and every admin route including role checks and the read-only demo account.

---

## Deployment

| Part | Host | Notes |
|---|---|---|
| Frontend | Vercel | `ng build`, SPA rewrite to `index.html` (see `vercel.json`) |
| API | Render | `npm start` in `backend/`, environment variables set on the service |
| Database | Clever Cloud (MySQL) | Schema applied from `backend/schema.sql` |
| Images | Cloudinary | Needed because the Render disk is not persistent |

The production build swaps `src/environments/environment.ts` for `environment.prod.ts`, which points to the deployed API.

---

## Known Limitations

- Card payment is simulated; no payment provider is integrated.
- The cart is stored in the browser per account, not on the server, so it does not follow the user across devices.
- There is no migration tool; schema changes are applied to the live database by hand.
- The catalogue is filtered and paginated on the client, which suits a small catalogue but not a very large one.
- The interface is available in Greek only.
