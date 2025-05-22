# EspressoLane - Coffee Shop Management System

EspressoLane is a comprehensive coffee shop management system built with React, TypeScript, and Node.js. It provides a complete solution for managing coffee shop operations, including order management, employee management, customer loyalty, and menu management.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [User Roles](#user-roles)
- [Features in Detail](#features-in-detail)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Features
- **Order Management**
  - Real-time order tracking
  - Order status updates
  - Order history and analytics
  - Custom order options and modifiers

- **Menu Management**
  - Dynamic menu creation and editing
  - Product categories and options
  - Price management
  - Availability control

- **Employee Management**
  - Role-based access control
  - Employee scheduling 
  - Performance tracking
  - Employee profiles

- **Customer Loyalty System**
  - Points-based rewards
  - Voucher management
  - Tier-based benefits (not fully implemented)
  - Referral system (not yet)

- **User Management**
  - Multi-role support
  - Profile management
  - Authentication and authorization
  - Password reset functionality

### Additional Features
- Real-time notifications (not yet)
- Image upload and management
- Responsive design 
- Dark/Light theme support (not yet)
- Customizable settings (not yet)

## Tech Stack

### Frontend
- React 19.0.0
- TypeScript
- TailwindCSS 4.0.16
- Vite 6.2.0
- React Router DOM 7.4.0

### Backend
- Node.js
- MySQL
- Express.js
- JWT Authentication
- Multer (for file uploads)

### Development Tools
- ESLint
- TypeScript
- Vite
- SWC

## Project Structure

```
espressolane/
├── src/                    # Frontend source code
│   ├── components/        # Reusable components
│   ├── pages/            # Page components
│   ├── types.ts          # TypeScript type definitions
│   └── utils/            # Utility functions
├── backend/              # Backend source code
│   ├── server.js        # Main server file
│   └── db.js            # Database configuration
├── uploads/             # File upload directory
├── public/              # Static assets
└── config/             # Configuration files
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/espressolane.git
cd espressolane
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=espressolane
DB_PORT=3306
JWT_SECRET=your_jwt_secret
```

4. Start the development server:
```bash
npm run dev
```

## Configuration

### Database Configuration
The database configuration is managed through environment variables in the `.env` file. The system uses MySQL with the following configuration options:

- `DB_HOST`: Database host
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `DB_PORT`: Database port

### File Upload Configuration
The system uses the `uploads` directory for storing uploaded files. Configure the following in your environment:

- Maximum file size: 5MB
- Allowed file types: JPEG, PNG, GIF, WebP
- Storage path: `/uploads`

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Order Endpoints
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order status
- `DELETE /api/orders/:id` - Archive order

### Menu Endpoints
- `GET /api/products` - Get all products
- `POST /api/products` - Add new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Employee Endpoints
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Add new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Rewards Endpoints
- `GET /api/rewards` - Get all rewards
- `POST /api/rewards` - Create new reward
- `PUT /api/rewards/:id` - Update reward
- `DELETE /api/rewards/:id` - Delete reward

## User Roles

The system supports multiple user roles with different permissions:

### Manager
- Full system access
- Employee management
- Menu management
- Order management
- Reports and analytics

### Employee
- Order processing
- Basic customer service
- Limited menu management
- View reports

### Cashier
- Order processing
- Payment handling
- Basic customer service

### Cook
- Order preparation
- Menu item status updates
- Inventory management

### Customer
- Place orders
- View order history
- Manage profile
- Use loyalty rewards

## Features in Detail

### Order Management
- Real-time order tracking
- Custom order options
- Status updates
- Order history
- Analytics and reporting

### Menu Management
- Product categories
- Custom options and modifiers
- Price management
- Availability control
- Image management

### Employee Management
- Role-based access
- Scheduling
- Performance tracking
- Profile management

### Customer Loyalty
- Points system
- Voucher management
- Tier benefits
- Referral rewards

## Development

### Code Style
The project uses ESLint for code style enforcement. Run the linter:
```bash
npm run lint
```

### TypeScript
The project is written in TypeScript. Type definitions are available in `src/types.ts`.

### Testing
Run tests:
```bash
npm test
```

## Deployment

### Production Build
Create a production build:
```bash
npm run build
```

