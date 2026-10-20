# HS Library Management System 📚✨

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20SQLite%20Fallback-blue.svg)](https://www.mysql.com/)
[![Tests](https://img.shields.io/badge/Test%20Suite-54%2F54%20Passing-brightgreen.svg)](backend/test_suite.js)
[![Quality Architecture](https://img.shields.io/badge/TQM%20Q09-Defect%20Prevention%20Hardened-orange.svg)](backend/validator.js)
[![Version](https://img.shields.io/badge/Release-v2.5.1-purple.svg)](package.json)

A modern, full-stack **Multi-Library Management System** built with **vanilla JavaScript, responsive HTML5/CSS3, Node.js/Express REST API**, and a resilient **Dual Database Architecture (MySQL + persistent SQLite fallback)**. Engineered with **Total Quality Management (TQM Q09)** principles and **Poka-Yoke (mistake-proofing)** validation across every layer.

---

## 🌟 Key Features

### 1. 🏢 Multi-Tenant Multi-Library Architecture
* **Isolated Library Spaces:** Each registered library has its own independent catalog, student directory, issues/returns ledger, and statistics.
* **Role-Based Access Control:** Secure JWT authentication with strict library scoping. Librarians cannot view or modify records belonging to other institutions.
* **Zero-Collision Foreign Keys:** Data isolation enforced at database constraint level with cascaded deletions.

### 2. 📖 Curated K-12 School Curriculum Collection
* **Pre-Seeded Curricula:** Includes curated books spanning **Nursery to Class 12th** across both **Hindi** and **English** mediums.
* **Categorized Sections:**
  * **Pre-Primary / Primary (Classes 1–5):** Rhymes, Balgeet, Panchatantra, Primary English, Hindi Varnamala.
  * **Middle School (Classes 6–8):** NCERT Science, Mathematics, Vasant Hindi, Honeycomb English, Social Studies.
  * **Secondary (Classes 9–10):** Kshitij, Sparsh, First Flight, Footprints Without Feet, Foundation Science.
  * **Senior Secondary (Classes 11–12):** Antra, Aroh, Flamingo, Physics, Chemistry, Mathematics, Accountancy, Computer Science.
* **Automated Multi-Library Seeding:** New libraries automatically inherit curated curriculum books on registration.

### 3. 🛡️ Poka-Yoke (Mistake-Proofing) Input Validation
* **ISBN Checksum Algorithms:** Full mathematical checksum validation supporting both **ISBN-10** (modulo 11 with 'X' check digit) and **ISBN-13** (EAN-13 alternating weights 1 and 3 modulo 10).
* **Canonical ISBN Hyphenation:** Automatic formatting into standard `978-X-XX-XXXXXX-X` standard.
* **Title Case Normalization:** String sanitization formatting author and book titles cleanly.
* **Publication Year Sanity:** Guards rejecting invalid historical boundaries or future years beyond $+1$.
* **Phone Number Normalization:** Standardizes $+91$ and 10-digit Indian mobile formats while stripping illegal characters.
* **Real-time Client-Side Hooks:** Live visual feedback on forms preventing invalid submissions before network requests.

### 4. 🔄 Circulation & Lending Operations
* **Borrowing & Returns:** Issue books to registered students with automated availability tracking.
* **Atomic Transactions:** Relational database transactions guarantee no orphan records on network interrupts.
* **Overdue Fine Computation:** Automated fine calculation with configurable grace periods.

### 5. 🗄️ Dual Database Architecture (Zero-Downtime Guarantee)
* **High-Speed MySQL:** Primary relational database engine supporting connection pooling and high concurrency.
* **Zero-Config Persistent SQLite Fallback:** If MySQL is offline (e.g. `ECONNREFUSED` on port 3306), the system automatically falls back to an embedded relational SQLite engine (`backend/hs_library.db`) with zero downtime and complete feature parity.
* **Database Health Monitoring:** Real-time health check reporting connection status and database integrity (`PRAGMA integrity_check`).

### 6. 📊 TQM Q09 Defect Tracking & Audit Dashboard
* **Built-in Quality Telemetry:** Track, report, filter, and resolve bugs directly within the library admin console.
* **Sensitive Log Sanitization:** Automatic scrubbing of passwords, authorization tokens, and API keys from error telemetry to prevent credential leakage.

---

## 🏗️ Project Architecture

```
HS-Library-Management-System/
├── backend/
│   ├── curatedBooks.js      # Baseline curated library books collection
│   ├── schoolBooks.js       # Curated K-12 Nursery to 12th collection (Hindi & English)
│   ├── db.js                # Dual-engine database adapter (MySQL + SQLite fallback)
│   ├── errors.js            # Custom error classes (Validation, Auth, Database)
│   ├── logger.js            # Structured logger with credential redaction
│   ├── schema.sql           # Complete MySQL DDL relational database schema
│   ├── server.js            # Express API server (authentication, books, circulation, reports)
│   ├── test_suite.js        # Comprehensive Node test runner (54 automated tests)
│   ├── test_api.js          # API endpoint sanity tests
│   ├── test_multilib.js     # Multi-library isolation verification
│   ├── validator.js         # Poka-Yoke validators (ISBN checksums, Title case, Phone)
│   ├── package.json         # Backend dependencies & script definitions
│   └── .env.example         # Environment template
├── uploads/
│   └── covers/              # Statically served book cover image assets
├── index.html               # Responsive single-page application interface
├── script.js                # Frontend client logic (views, forms, API client, search)
├── style.css                # Responsive stylesheet with high-contrast accessibility
├── test_all_features.js     # End-to-end integration test runner
├── package.json             # Root lifecycle scripts
└── README.md                # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0.0 or higher.
* *(Optional)* [MySQL Server](https://dev.mysql.com/downloads/) 8.0+ running on port 3306. If MySQL is not installed, the application automatically boots into zero-config persistent SQLite mode.

### 1. Clone the Repository
```bash
git clone https://github.com/harshitsanwal99/HS-Library-Management-System.git
cd HS-Library-Management-System
```

### 2. Install Dependencies
```bash
npm install
```
*(Or install specifically in the backend directory)*:
```bash
cd backend
npm install
cd ..
```

### 3. Environment Configuration (Optional)
Copy `.env.example` to `.env` inside the `backend/` directory if you wish to configure custom database credentials:
```bash
cp backend/.env.example backend/.env
```

### 4. Start the Application
Run the backend server from root:
```bash
npm start
```
The server will initialize and output:
```
==================================================
  HS Library Management System - API Server v2.5.1
==================================================
[HS Library DB] Operating in persistent SQLite mode [hs_library.db].
[HS Library Server] Running at: http://localhost:5000
```

### 5. Access the Web Application
Open your browser and navigate to:
```
http://localhost:5000
```
Or open [`index.html`](index.html) directly in any modern web browser.

---

## 🧪 Automated Testing

The repository includes a comprehensive, zero-dependency automated test runner executing 54 unit and integration tests across 8 test suites:

```bash
npm test
```

### Test Coverage Highlights:
1. **Authentication Module & Access Control:** Registration, login, password length, token validation, duplicate detection.
2. **Books Module & Strict Input Validation:** ISBN-10/13 checksum algorithms, publication year bounds, title-case formatting.
3. **Multi-Tenant Library Isolation:** Strict record segregation across separate library accounts.
4. **Member / Student Registry:** Mobile number normalization, unique admission numbers.
5. **Circulation Desk Operations:** Borrowing, returns, overdue fine calculations.
6. **Search & Category Filtering:** Multi-field real-time catalog queries.
7. **Bug Tracker Module (TQM Q09):** Defect reporting, status updates, severity categorization.
8. **Quality Dashboard & Transaction Safety:** Atomic rollbacks and credential-scrubbed telemetry.

---

## 📡 REST API Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new library and librarian account | No |
| `POST` | `/api/auth/login` | Authenticate librarian and receive JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated librarian profile | Yes (Bearer) |
| `GET` | `/api/books` | List books (supports search & filters) | Yes (Bearer) |
| `POST` | `/api/books` | Add a new book with cover upload & validation | Yes (Bearer) |
| `PUT` | `/api/books/:id` | Update book metadata | Yes (Bearer) |
| `DELETE` | `/api/books/:id` | Remove book from catalog | Yes (Bearer) |
| `GET` | `/api/students` | List registered students | Yes (Bearer) |
| `POST` | `/api/students` | Register student with normalized phone | Yes (Bearer) |
| `POST` | `/api/issues` | Issue book to student (atomic transaction) | Yes (Bearer) |
| `POST` | `/api/issues/return` | Return book and calculate overdue fines | Yes (Bearer) |
| `GET` | `/api/reports` | Scoped library analytics and counts | Yes (Bearer) |
| `GET` | `/api/bugs` | Retrieve bug defects for library | Yes (Bearer) |
| `POST` | `/api/bugs` | Log a defect into TQM tracker | Yes (Bearer) |
| `GET` | `/api/health` | Public server & database health report | No |

---

## 👤 Author
* **Harshit Sanwal** ([@harshitsanwal99](https://github.com/harshitsanwal99))
