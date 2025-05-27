# EspressoLane

EspressoLane is a full-stack coffee shop management system that offers a comprehensive solution for coffee shops to manage their operations, including menu management, order processing, employee management, and customer rewards programs.

## 🚀 Features

- **Responsive Web Application** - Built with React and TypeScript
- **User Authentication** - Secure login and role-based access control with JWT
- **Menu Management** - Create, update, and manage menu items with customization options
- **Order Processing** - Handle customer orders with payment integration
- **Employee Management** - Manage staff roles and permissions
- **Customer Rewards System** - Comprehensive loyalty program with points, vouchers, and discounts
- **Profile Management** - User profiles with customization options
- **File Upload System** - Handle image uploads for products, users, and rewards
- **Dashboard Analytics** - Track sales, orders, and customer activity
- **Multi-Role Access** - Different views and permissions for managers, employees, cashiers, cooks, and customers

## 📚 Tech Stack

### Frontend
- React 19 with TypeScript
- React Router v7 for navigation
- Tailwind CSS for styling
- Vite as the build tool
- React Toastify for notifications
- UUID for generating unique identifiers

### Backend
- Node.js with Express
- MySQL database with connection pooling
- JWT for authentication
- Bcrypt for password hashing
- Multer for file uploads
- CORS for cross-origin resource sharing
- dotenv for environment variable management

## 🏗 Project Structure

```
espressolane/
├── src/                # Frontend source code
│   ├── assets/         # Static assets (images, icons)
│   ├── components/     # Reusable React components
│   ├── pages/          # Application pages
│   │   ├── Home.tsx             # Dashboard home page
│   │   ├── Menu.tsx             # Customer menu view
│   │   ├── EditMenu.tsx         # Manager menu editing
│   │   ├── Order.tsx            # Order management
│   │   ├── Rewards.tsx          # Customer rewards view
│   │   ├── EditRewards.tsx      # Manage rewards system
│   │   ├── Profile.tsx          # User profile management
│   │   ├── Employee.tsx         # Employee management
│   │   ├── Settings.tsx         # Application settings
│   │   ├── LandingPage.tsx      # Public landing page
│   │   └── [Other pages]
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main application component
│   ├── main.tsx        # Entry point
│   ├── types.ts        # TypeScript type definitions
│   └── index.css       # Global styles
│
├── backend/            # Backend source code
│   ├── server.js       # Express server setup and API endpoints
│   ├── db.js           # Database connection and configuration
│   ├── env.example     # Example environment variables
│   └── espressolane_db dump.sql # Database schema
│
├── uploads/            # Directory for uploaded files
│   └── README.md       # Documentation for file uploads
│
└── package.json        # Frontend dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/espressolane.git
   cd espressolane
   ```

2. Install frontend dependencies
   ```bash
   npm install
   ```

3. Set up the backend
   ```bash
   cd backend
   npm install
   ```

4. Configure the environment variables
   ```bash
   cp backend/env.example backend/.env
   ```
   Edit the `.env` file with your MySQL credentials and JWT secret.

5. Create the database and import the schema
   ```sql
   CREATE DATABASE espressolane_db;
   ```
   
   Then import the schema:
   ```bash
   mysql -u youruser -p espressolane_db < backend/espressolane_db\ dump.sql
   ```

### Running the Application

1. Start the backend server
   ```bash
   cd backend
   npm start
   ```

2. Start the frontend development server
   ```bash
   # From the project root
   npm run dev
   ```

3. Access the application at `http://localhost:5173`

## 🔌 Backend Configuration

The backend requires the following environment variables in the `.env` file:

```
DB_HOST=localhost          # Database host
DB_USER=your_mysql_user    # Database username
DB_PASSWORD=your_password  # Database password
DB_NAME=espressolane_db    # Database name
JWT_SECRET=your_secret_key # Secret key for JWT tokens
PORT=3001                  # Port for the backend server
```

## 🔒 User Roles and Access Control

EspressoLane implements a comprehensive role-based access control system:

### Manager
- **Access Level**: Full system access
- **Permissions**:
  - Manage all employees (add, edit, remove)
  - Full menu management (create, update, delete items)
  - Complete order management
  - Configure rewards and loyalty program
  - Access all reports and analytics
  - Modify system settings

### Employee
- **Access Level**: High access to customer-facing features
- **Permissions**:
  - Process orders
  - View and update menu
  - Customer service
  - Grant manual rewards
  - Limited reporting

### Cashier
- **Access Level**: Order processing focused
- **Permissions**:
  - Process and manage orders
  - Handle payments
  - Basic customer service
  - Apply rewards and discounts
  - View order history

### Cook
- **Access Level**: Kitchen operations
- **Permissions**:
  - View incoming orders
  - Update order status
  - View menu items
  - Basic reporting

### Customer
- **Access Level**: Self-service
- **Permissions**:
  - Browse menu
  - Place orders
  - View order history
  - Manage personal profile
  - Access rewards program
  - Redeem points and vouchers

## 📊 Database Schema

EspressoLane uses a MySQL database with the following core tables:

### Users Table
```sql
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('manager','employee','cashier','cook','customer') NOT NULL DEFAULT 'customer',
  `avatar_url` varchar(255) DEFAULT NULL,
  `loyalty_points` int(11) DEFAULT 0,
  `birth_date` date DEFAULT NULL,
  `purchases_this_month` int(11) DEFAULT 0,
  `lifetime_total_spend` decimal(10,2) DEFAULT 0.00,
  `lifetime_total_visits` int(11) DEFAULT 0,
  `membership_tier` varchar(50) DEFAULT NULL,
  `tier_join_date` date DEFAULT NULL,
  `join_date` datetime DEFAULT current_timestamp(),
  `phone_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `referral_code` varchar(20) DEFAULT NULL,
  `referrals_made` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
)
```

### Products Table
```sql
CREATE TABLE `products` (
  `product_id` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `base_price` decimal(8,2) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `category_id` int(11) NOT NULL,
  `availability` enum('available','unavailable') DEFAULT 'available',
  `tags` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
)
```

### Categories Table
```sql
CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
)
```

### Orders Table
```sql
CREATE TABLE `orders` (
  `order_id` varchar(255) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_name_snapshot` varchar(150) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  `ticket_number` varchar(50) NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `order_timestamp` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `original_amount` decimal(10,2) DEFAULT NULL
)
```

### Order Line Items Table
```sql
CREATE TABLE `orderlineitems` (
  `order_line_item_id` int(11) NOT NULL,
  `order_id` varchar(255) NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `product_name_snapshot` varchar(150) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price_snapshot` decimal(8,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `reward_id` varchar(255) DEFAULT NULL,
  `is_reward_item` tinyint(1) DEFAULT 0
)
```

### Rewards Table
```sql
CREATE TABLE `rewards` (
  `reward_id` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `type` enum('standard','voucher','discount_coupon','loyalty_tier_perk','manual_grant') NOT NULL,
  `criteria_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`criteria_json`)),
  `points_cost` int(11) DEFAULT NULL,
  `discount_percentage` decimal(5,2) DEFAULT NULL,
  `discount_fixed_amount` decimal(10,2) DEFAULT NULL,
  `earning_hint` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
)
```

### Customer Vouchers Table
```sql
CREATE TABLE `customervouchers` (
  `voucher_instance_id` varchar(255) NOT NULL,
  `reward_id` varchar(255) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name_snapshot` varchar(255) NOT NULL,
  `description_snapshot` text DEFAULT NULL,
  `granted_date` datetime DEFAULT current_timestamp(),
  `expiry_date` datetime DEFAULT NULL,
  `status` enum('active','claimed','expired') NOT NULL DEFAULT 'active',
  `granted_by_method` enum('system_earned','employee_granted','signup_bonus') NOT NULL,
  `employee_grant_user_id` int(11) DEFAULT NULL,
  `employee_grant_notes` text DEFAULT NULL,
  `claimed_date` timestamp NULL DEFAULT NULL,
  `order_id` varchar(255) DEFAULT NULL
)
```

### Loyalty Points Transactions Table
```sql
CREATE TABLE `loyalty_points_transactions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `points` int(11) NOT NULL,
  `transaction_type` enum('earned','redeemed','expired','adjusted') NOT NULL,
  `order_id` varchar(255) DEFAULT NULL,
  `reward_id` varchar(255) DEFAULT NULL,
  `transaction_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
)
```

### Product Option Groups Table
```sql
CREATE TABLE `optiongroups` (
  `option_group_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `selection_type` enum('radio','checkbox') NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT 0
)
```

### Options Table
```sql
CREATE TABLE `options` (
  `option_id` int(11) NOT NULL,
  `option_group_id` int(11) NOT NULL,
  `label` varchar(100) NOT NULL,
  `price_modifier` decimal(6,2) DEFAULT 0.00
)
```

## 🌐 API Documentation

### Authentication Endpoints

#### POST /api/login
- **Description**: Authenticates a user and returns a JWT token
- **Request Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "token": "JWT_TOKEN",
    "user": {
      "internalId": "1",
      "email": "user@example.com",
      "name": "User Name",
      "role": "customer",
      "avatar": "/uploads/avatar.jpg"
    }
  }
  ```

#### GET /api/auth/verify
- **Description**: Verifies a JWT token and returns user data
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Response**: 
  ```json
  {
    "user": {
      "internalId": "1",
      "email": "user@example.com",
      "name": "User Name",
      "role": "customer",
      "avatar": "/uploads/avatar.jpg"
    }
  }
  ```

### User Management Endpoints

#### POST /api/users
- **Description**: Creates a new user
- **Access**: Public (for signup)
- **Request Body**:
  ```json
  {
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User"
  }
  ```

#### GET /api/users/:userId
- **Description**: Gets user profile information
- **Access**: Authenticated user (own profile) or Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`

#### PUT /api/users/:userId
- **Description**: Updates user profile
- **Access**: Authenticated user (own profile) or Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: User profile fields to update

#### GET /api/users/search
- **Description**: Search for users
- **Access**: Manager, Employee, Cashier
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Query Parameters**: `q` (search term)

### Menu Management Endpoints

#### GET /api/products
- **Description**: Get all products
- **Access**: Public
- **Query Parameters**: 
  - `category` - Filter by category
  - `availability` - Filter by availability

#### POST /api/products
- **Description**: Add a new product
- **Access**: Manager, Employee
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Product details

#### PUT /api/products/:productId
- **Description**: Update a product
- **Access**: Manager, Employee
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Updated product details

#### DELETE /api/products/:productId
- **Description**: Remove a product
- **Access**: Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`

### Order Management Endpoints

#### POST /api/orders/checkout
- **Description**: Place a new order
- **Access**: Authenticated users
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Order details including items and customizations

#### GET /api/orders
- **Description**: Get orders
- **Access**: Manager, Employee, Cashier, Cook (all orders), Customer (own orders)
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Query Parameters**:
  - `status` - Filter by order status
  - `customerId` - Filter by customer
  - `startDate` - Filter by start date
  - `endDate` - Filter by end date

#### PUT /api/orders/:orderId
- **Description**: Update order status
- **Access**: Manager, Employee, Cashier, Cook
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Updated status and other details

### Rewards Management Endpoints

#### GET /api/rewards
- **Description**: Get all rewards
- **Access**: Public (visible rewards only)
- **Query Parameters**: 
  - `type` - Filter by reward type

#### POST /api/rewards
- **Description**: Create a new reward
- **Access**: Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Reward details

#### PUT /api/rewards/:rewardId
- **Description**: Update a reward
- **Access**: Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Updated reward details

#### DELETE /api/rewards/:rewardId
- **Description**: Delete a reward
- **Access**: Manager
- **Headers**: `Authorization: Bearer JWT_TOKEN`

#### POST /api/rewards/:rewardId/claim
- **Description**: Claim a reward
- **Access**: Authenticated customers
- **Headers**: `Authorization: Bearer JWT_TOKEN`

#### POST /api/rewards/grant
- **Description**: Grant a reward to a customer
- **Access**: Manager, Employee
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**:
  ```json
  {
    "customerId": "1",
    "rewardId": "reward_id",
    "notes": "Special reward for loyal customer"
  }
  ```

### Upload Endpoints

#### POST /api/upload
- **Description**: Upload an image
- **Access**: Authenticated users
- **Headers**: `Authorization: Bearer JWT_TOKEN`
- **Request Body**: Form data with `image` field

## 📁 File Upload System

The system supports image uploads with the following specifications:

### Upload Configuration
- **Maximum file size**: 5MB
- **Allowed file types**: JPEG, PNG, GIF, WebP
- **Storage location**: `/uploads` directory
- **Filename format**: `{fieldname}-{timestamp}-{random}.{extension}`

### Upload Categories
- **User Avatars**: Used for user profile pictures
- **Product Images**: Used for menu items
- **Category Images**: Used for menu categories
- **Reward Images**: Used for reward illustrations

### Security Measures
- File types are validated on both frontend and backend
- Original filenames are not preserved to prevent security issues
- Only authenticated users can upload files
- Files larger than 5MB are rejected

## 🔄 Frontend Type System

The application uses TypeScript with the following core interfaces:

### User Interface
```typescript
export interface User {
  internalId: string;
  email: string;
  name: string;
  role: 'manager' | 'employee' | 'cashier' | 'cook' | 'customer';
  referralCode?: string;
  avatar?: string;
  phone_number?: string;
  address?: string;
}
```

### Product Interface
```typescript
export interface Product {
  id: string; 
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  optionCategories?: OptionCategory[];
  availability?: 'available' | 'unavailable';
  tags?: string[];
}
```

### Order Interfaces
```typescript
export interface OrderItem {
  id: string;
  customerId: string;
  customerName: string; 
  items: {
    name: string;
    quantity: number;
    customizations: { group: string; option: string }[];
  }[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  timestamp: string;
  ticketNumber: string;
}

export interface NewOrderData {
  customerName: string;
  items: PlacedOrderItemDetail[];
  redeemedRewards?: RedeemedReward[];
  userId?: string;
}
```

### Reward Interfaces
```typescript
export interface ProcessedRewardItem {
    id: string;
    reward_id: string;
    name: string;
    description?: string;
    image: string;
    type: 'standard' | 'voucher' | 'discount_coupon' | 'loyalty_tier_perk' | 'manual_grant';
    pointsCost?: number;
    discountPercentage?: number;
    discountFixedAmount?: number;
    earningHint?: string;
    criteria?: RawRewardItemCriteria;
    freeMenuItemIds: string[];
}

export interface CustomerVoucher {
  instanceId: string;
  rewardId: string;
  customerId: string;
  name: string;
  description?: string;
  grantedDate: string;
  expiryDate?: string;
  status: 'active' | 'claimed' | 'expired';
  grantedBy: 'system_earned' | 'employee_granted' | 'signup_bonus';
  employeeGrantDetails?: { employeeId: string; notes?: string };
}
``` 
