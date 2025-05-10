# EspressoLane POS & Management System

This is a comprehensive web application designed for EspressoLane, a modern coffee shop. It aims to streamline operations, manage sales, employees, inventory, and customer rewards.

## Key Features

### Core Functionality
*   **User Authentication:** Secure login and logout for different user roles.
*   **Role-Based Access Control:** Differentiated access and features for Managers, Employees (Barista, Cashier, Cook, Shift Lead), and Customers.

### Pages & Modules
*   **Home/Dashboard:** Overview page (details to be defined).
*   **Menu Page:**
    *   View products and categories.
    *   Customize menu items with available options.
    *   Add items to an order.
*   **Order Management:**
    *   View current and past orders.
    *   Update order status (e.g., "Pending", "Preparing", "Ready", "Completed", "Cancelled").
*   **Employee Management:**
    *   View a list of all employees with their details.
    *   Search for specific employees.
    *   **Add New Employees:** A modal-based flow to select an existing user and assign employee-specific details (Employee ID, Position, Phone, Hire Date, Status, System Role).
    *   **Edit Existing Employees:** Modify employee details.
    *   Delete employee records (reverts user role to 'Customer').
*   **Rewards Program:**
    *   Customers can view their accumulated points and available rewards.
*   **User Profile:** View and manage user-specific information.
*   **Settings Page:**
    *   **General:** General account settings.
    *   **Display:** Customize application appearance (e.g., theme, profile banner).
    *   **Privacy and Security:** Change account password and manage security preferences.
*   **Manager-Specific Modules:**
    *   **Edit Menu:**
        *   Manage Products (add, edit, delete, assign to categories, manage option groups).
        *   Manage Categories (add, edit, delete).
        *   Manage Option Groups and Options (add, edit, delete).
    *   **Edit Rewards:** Define and manage reward tiers and point requirements.

### Backend & API
*   **RESTful API:** Backend services built with Node.js and Express.js.
*   **Database:** MySQL database for persistent storage.
*   **Input Validation:** Server-side validation for incoming data.
*   **Authorization:** Protecting API endpoints based on user roles.
*   **CRUD Operations:** Endpoints for managing:
    *   Users (Authentication)
    *   Employees
    *   Products, Categories, Option Groups, Options
    *   Orders and Order Items
    *   Rewards Definitions
    *   Customer Rewards

## Tech Stack

*   **Frontend:**
    *   React (v18+)
    *   TypeScript
    *   Vite (Build tool and development server)
    *   React Router DOM (v6+ for navigation)
    *   Tailwind CSS (for styling and UI components)
*   **Backend:**
    *   Node.js (v18+)
    *   Express.js
    *   MySQL2 (MySQL driver)
    *   jsonwebtoken (for JWT handling)
    *   bcryptjs (for password hashing)
*   **Database:**
    *   MySQL

## Project Structure (Simplified)

```
espressolane/
├── public/               # Static assets
├── src/
│   ├── assets/           # Images, fonts, etc.
│   ├── components/       # Shared React components
│   ├── contexts/         # React context providers (e.g., AuthContext)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions, API helpers
│   ├── pages/            # Page-level components (routed)
│   ├── services/         # API service functions (old, consider consolidating into lib/api)
│   ├── styles/           # Global styles, Tailwind base
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main application component with routing
│   ├── main.tsx          # Entry point of the React application
│   └── vite-env.d.ts     # Vite environment types
├── server/
│   ├── config/           # Database configuration
│   ├── middleware/       # Express middleware (auth, error handling)
│   ├── models/           # Database interaction logic (data access layer)
│   ├── routes/           # API route definitions
│   └── server.js         # Express server setup and entry point
├── .env.example          # Environment variable template for server
├── .eslintrc.cjs         # ESLint configuration
├── .gitignore
├── index.html            # Main HTML file for Vite
├── package.json          # Frontend dependencies and scripts
├── README.md             # This file
├── tailwind.config.js    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration (frontend)
└── tsconfig.node.json    # TypeScript configuration (Vite specific)
```

## Setup and Installation

### Prerequisites
*   Node.js (v18+ recommended)
*   npm (comes with Node.js) or yarn
*   MySQL Server

### Backend Setup
1.  Navigate to the `server` directory: `cd server`
2.  Install dependencies: `npm install` (or `yarn install`)
3.  Create a `.env` file in the `server` directory by copying `.env.example`.
4.  Update the `.env` file with your MySQL database credentials and a `JWT_SECRET`.
    ```env
    DB_HOST=localhost
    DB_USER=your_mysql_user
    DB_PASSWORD=your_mysql_password
    DB_NAME=espressolane_db # or your chosen database name
    JWT_SECRET=your_very_secret_jwt_key_here
    PORT=3001 # Or any port you prefer for the backend
    ```
5.  Ensure your MySQL server is running and you have created the database specified in `.env`.
    *   You might need to run the SQL schema initialization script if one is provided (e.g., `schema.sql`) or set up tables manually based on `server/models/*` and `server/routes/*` if no script exists yet. (Currently, tables are expected to exist as per API logic).
6.  Start the backend server: `npm start` (or `node server.js`)
    *   The server typically runs on `http://localhost:3001`.

### Frontend Setup
1.  Navigate to the root project directory (if not already there): `cd ..` (if you were in `server`) or `cd espressolane`
2.  Install dependencies: `npm install` (or `yarn install`)
3.  Start the frontend development server: `npm run dev`
    *   The application will typically be available at `http://localhost:5173` (or another port specified by Vite).

## Running the Application
1.  Ensure the backend server is running (see Backend Setup).
2.  Ensure the frontend development server is running (see Frontend Setup).
3.  Open your browser and navigate to the frontend URL (e.g., `http://localhost:5173`).

## API Endpoints Overview

The backend provides RESTful API endpoints under the `/api` prefix. Key resource endpoints include:

*   `/api/auth/login` (POST): User login.
*   `/api/users/available` (GET): Get users not yet employees.
*   `/api/employees` (GET, POST): Manage employees.
*   `/api/employees/:id` (GET, PUT, DELETE): Manage a specific employee.
*   `/api/products` (GET, POST): Manage products.
*   `/api/products/:id` (GET, PUT, DELETE): Manage a specific product.
*   `/api/categories` (GET, POST): Manage categories.
*   `/api/categories/:id` (GET, PUT, DELETE): Manage a specific category.
*   `/api/optiongroups` (GET, POST): Manage option groups.
*   `/api/optiongroups/:id` (GET, PUT, DELETE): Manage a specific option group.
*   `/api/options` (GET, POST): Manage options within groups.
*   `/api/options/:id` (PUT, DELETE): Manage a specific option.
*   `/api/orders` (GET, POST): Manage orders.
*   `/api/orders/:id` (GET, PUT): Manage a specific order.
*   `/api/rewards/definitions` (GET, POST): Manage reward definitions.
*   `/api/rewards/definitions/:id` (PUT, DELETE): Manage a specific reward definition.
*   `/api/rewards/my-rewards` (GET): Get rewards for the logged-in customer.
*   `/api/profile` (GET, PUT): Manage user profile.
*   `/api/settings/change-password` (POST): Change user password.

*Authentication*: Most endpoints require a JWT token passed in the `Authorization: Bearer <token>` header.

## Database Schema Highlights

Key tables in the MySQL database (`espressolane_db` or as configured):
*   `Users`: Stores user accounts (id, name, email, password_hash, role).
*   `Employees`: Stores employee-specific details, linked to `Users` (employee_internal_id, user_id, employee_id_code, position, status, phone_number, hire_date).
*   `Products`: Menu items (product_id, name, description, price, category_id, image_url, availability_status).
*   `Categories`: Product categories (category_id, name, description).
*   `OptionGroups`: Groups of choices for products (option_group_id, name, selection_type - e.g., 'single', 'multiple').
*   `Options`: Individual choices within an OptionGroup (option_id, option_group_id, name, additional_price).
*   `ProductOptionGroups`: Links products to option groups (product_id, option_group_id).
*   `Orders`: Customer orders (order_id, user_id, order_date, total_amount, status, payment_method, delivery_address, notes).
*   `OrderItems`: Items within an order (order_item_id, order_id, product_id, quantity, unit_price, subtotal).
*   `OrderItemOptions`: Selected options for an order item.
*   `RewardsDefinitions`: Defines available rewards (reward_definition_id, name, points_required, description, discount_amount, discount_percentage).
*   `CustomerRewards`: Tracks customer points and redeemed rewards (customer_reward_id, user_id, points_balance).

## Current Development Focus & TODOs

*   **Phase 1: Critical Security & Core Backend Implementation (In Progress)**
    1.  **Backend for Core Missing CRUD Operations:** (Largely complete for Menu, Employees, Orders, Rewards)
    2.  **Backend Input Validation:** (Partially implemented, ongoing).
    3.  **Backend Authorization:** (Implemented for most routes, ongoing review).
    4.  **Frontend for Core Missing CRUD Operations:**
        *   Employee Page: Add/Edit Employee modal flow (implemented, minor refinements needed).
        *   Order Management: UI for status updates (implemented).
        *   Menu Editing: UI for Products, Categories, Option Groups (implemented).
        *   Rewards Editing: UI for Reward Definitions (implemented).
*   **Phase 2: Enhancements & User Experience**
    *   Refine UI/UX across all modules.
    *   Implement real-time updates (e.g., for order status using WebSockets).
    *   Inventory Management module.
    *   Advanced Reporting and Analytics.
    *   Full-text search enhancements.
*   **Phase 3: Stability & Performance**
    *   Comprehensive testing (unit, integration, E2E).
    *   Performance optimization (database queries, API response times, frontend rendering).
    *   Security hardening (penetration testing, dependency audits).
    *   Deployment strategy and CI/CD pipeline.

---

*This README provides a snapshot of the project. Refer to commit history and code for the most detailed information.*

