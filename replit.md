# InvoiceFlow - Invoice Management System

## Overview

InvoiceFlow is a comprehensive invoice management application built with a modern tech stack. The system provides businesses with tools to manage customers, products, invoices, and promotional schemes while integrating with QuickBooks for seamless accounting workflows. The application features a React frontend with shadcn/ui components and an Express.js backend using Drizzle ORM for database operations.

## Current Status - All Systems Working ✅

**Last Updated**: September 16, 2025

All major functionality is fully operational:

### ✅ Completed Features
- **Excel Inventory Reporting**: Generate comprehensive inventory reports with Amount calculations (Qty × Base Price)
- **AP Journal Entry Integration**: Full AP invoice journal entries with COGS dr (173) → Account Payable cr (1150040005) 
- **AR Journal Entry Integration**: AR invoice journal entries with Account Receivable dr (1150040004) → Sales cr (135)
- **QuickBooks Customer/Vendor Sync**: Automatic customer and vendor creation with proper field mapping
- **Inventory Management**: Automatic stock quantity updates (AR invoices reduce, AP invoices increase inventory)
- **Packing List Generation**: PDF generation with exact format matching and last 5-digit product codes
- **Promotional Schemes**: Buy X get Y free functionality with automatic free item calculation
- **Invoice Type Support**: Both receivable (AR) and payable (AP) invoice types with proper categorization

### 🔧 Recent Critical Fixes Applied
1. **QuickBooks API Integration**: Removed problematic "Name" property from customer/vendor creation requests
2. **Database Field Consistency**: Aligned field names to use "quickbooksInvoiceId" throughout the system
3. **Journal Entry Processing**: Fixed AP/AR journal entry creation and database updates
4. **Vendor Entity References**: Proper vendor entity inclusion in AP journal entries

### 💾 Data Integrity
- All database operations use consistent field naming
- QuickBooks integration uses only validated API properties
- Inventory tracking maintains accuracy across all invoice types
- Journal entries properly reference customer/vendor entities

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using React with TypeScript and follows a component-based architecture:

- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized builds

The application uses a modular structure with clear separation between pages, components, and utilities. The UI follows a consistent design system with support for light/dark themes.

### Backend Architecture
The backend follows a RESTful API design pattern:

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with QuickBooks OAuth integration
- **File Structure**: Modular route handlers with separation of concerns
- **Middleware**: Custom logging, error handling, and request parsing

The server implements a clean separation between route handlers, business logic, and data access layers.

### Database Design
The database schema supports multi-tenant functionality with user-scoped data:

- **Users**: Core user accounts with QuickBooks integration tokens
- **Customers**: Customer information with address data stored as JSONB
- **Products**: Product catalog with categories and pricing
- **Product Variants**: SKU-based inventory tracking with stock quantities
- **Product Schemes**: Promotional offers (buy X get Y free)
- **Invoices**: Invoice management with status tracking
- **Invoice Line Items**: Detailed line items with product references

All tables use UUID primary keys and include audit timestamps.

### Authentication & Authorization
The system implements OAuth 2.0 integration with QuickBooks:

- **QuickBooks OAuth**: Complete authorization flow for accessing QuickBooks APIs
- **Token Management**: Secure storage and automatic refresh of access tokens
- **Company Integration**: Links user accounts to specific QuickBooks company IDs
- **Session Management**: Express sessions with PostgreSQL storage

### Development Environment
The project uses modern development tooling:

- **Package Management**: npm with lockfile for dependency consistency
- **Build Process**: Dual build system for client (Vite) and server (esbuild)
- **Database Migrations**: Drizzle Kit for schema management
- **Development Server**: Hot reload with Vite middleware integration
- **Type Safety**: Shared TypeScript types between client and server

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver optimized for serverless environments
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management and caching
- **axios**: HTTP client for API requests
- **wouter**: Lightweight React router

### UI Framework
- **@radix-ui/***: Comprehensive set of unstyled, accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **clsx**: Conditional className utility

### Form Management
- **react-hook-form**: Performant forms with minimal re-renders
- **@hookform/resolvers**: Integration with validation libraries
- **zod**: TypeScript-first schema validation

### QuickBooks Integration
- **QuickBooks OAuth API**: Authentication and authorization
- **QuickBooks Accounting API**: Data synchronization for customers, items, and invoices

### Development Tools
- **vite**: Build tool and development server
- **esbuild**: Fast JavaScript bundler for server builds
- **typescript**: Static type checking
- **drizzle-kit**: Database schema management and migrations

### Database
- **PostgreSQL**: Primary database with JSONB support for flexible data structures
- **connect-pg-simple**: PostgreSQL session store for Express

The application is designed to be deployed on platforms that support Node.js applications with PostgreSQL databases, with particular optimization for Replit's environment.