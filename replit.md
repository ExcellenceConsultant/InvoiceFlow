# InvoiceFlow - Invoice Management System

## Overview

InvoiceFlow is a comprehensive invoice management application built with a modern tech stack. The system provides businesses with tools to manage customers, products, invoices, and promotional schemes while integrating with QuickBooks for seamless accounting workflows. The application features a React frontend with shadcn/ui components and an Express.js backend using Drizzle ORM for database operations.

## Current Status - All Systems Working ✅

**Last Updated**: October 6, 2025

All major functionality is fully operational:

### ✅ Completed Features
- **Excel Inventory Reporting**: Generate comprehensive inventory reports with Amount calculations (Qty × Base Price)
- **AP Journal Entry Integration**: Full AP invoice journal entries with COGS dr (173) → Account Payable cr (1150040005) 
- **AR Journal Entry Integration**: AR invoice journal entries with balanced accounting equation: AR Dr + Discount Dr = Sales Cr + Freight Cr
- **QuickBooks Customer/Vendor Sync**: Automatic customer and vendor creation with proper field mapping
- **Inventory Management**: Automatic stock quantity updates (AR invoices reduce, AP invoices increase inventory)
- **Packing List Generation**: PDF generation with exact format matching and last 5-digit product codes
- **Promotional Schemes**: Buy X get Y free functionality with automatic free item calculation
- **Invoice Type Support**: Both receivable (AR) and payable (AP) invoice types with proper categorization
- **Invoice PDF Export/Print**: Professional invoice printing with PDF generation capability
- **Invoice Discount Feature**: Editable discount field with 2% automatic default, properly reflected in all calculations and journal entries

### 📄 Invoice PDF/Print Formatting (Latest Implementation)

#### Pagination Rules
- **13 line items per page** with specific pagination logic:
  - Page 1: Shows up to 13 line items (filled with empty rows if fewer items)
  - Page 2+: Shows actual line items only (no empty row padding)
  - Minimum 2 pages always created (page 2 for summary even if ≤13 items)

#### Page Layout Structure
**Page 1:**
- Invoice header (company info, logo, invoice details)
- Customer shipping address and invoice details
- Line items table with headers (Sr. No., Product Code, Packing Size, Product Description, Qty (Carton), Rate per Carton, Total Amount)
- Up to 13 rows (with empty rows to fill if needed)
- NO summary, notes, or footer sections

**Page 2 (Always Present):**
- Invoice header (repeated on each page)
- Table headers (ONLY if there are product items on page 2, i.e., invoice has >13 items)
- Remaining product line items (if invoice has >13 items)
- Summary section with:
  - Total Carton count
  - Net Weight LBS
  - Gross Weight LBS
  - Amount in words (formatted with proper capitalization)
  - Subtotal, Discount, Grand Total
- Notes section
- Footer section with "Received By:" and "Total Pallets:" fields
- Company name at bottom

#### PDF Print Styling
- **A4 page size** with margins: 50mm top, 10mm sides, 40mm bottom
- **White backgrounds** throughout (no grey borders):
  - @page, html, body, container, invoice-page all set to white background
  - Notes section: transparent/white background, no borders in print mode
- **Page breaks**: Automatic page breaks between pages using `.page-break` class
- **Print-only elements**: Footer and summary appear only in print/PDF output
- **Hidden in print**: Navigation buttons and UI controls

#### Technical Implementation Details
- File: `client/src/pages/invoice-view.tsx`
- Conditional table rendering: Table headers only show on page 2 if product items exist
- Summary always renders on page 2 (pageIndex === 1)
- Print trigger: `window.print()` for native browser print dialog
- Category headers included in row count for pagination
- Empty rows use `&nbsp;` for proper spacing
- Currency formatting with proper decimal handling

#### Key Code Implementation (October 2, 2025)
```typescript
// Pagination logic - 13 rows per page
const ROWS_PER_PAGE = 13;
const pages = [];

// First page fills with empty rows, subsequent pages show actual items only
for (let i = 0; i < allRows.length; i += ROWS_PER_PAGE) {
  const pageRows = allRows.slice(i, i + ROWS_PER_PAGE);
  const pageIndex = pages.length;
  const emptyCount = pageIndex === 0 ? ROWS_PER_PAGE - pageRows.length : 0;
  pages.push({ rows: pageRows, emptyCount });
}

// Always ensure at least 2 pages (page 2 for summary/notes)
if (pages.length === 1) {
  pages.push({ rows: [], emptyCount: 0 });
}

// Conditional table rendering (page 1 always, page 2 only if items exist)
{(pageIndex === 0 || page.rows.length > 0 || page.emptyCount > 0) && (
  <table className="invoice-table">
    {/* Table content */}
  </table>
)}

// Summary always on page 2
{pageIndex === 1 && (
  <>
    {/* Summary Section */}
    {/* Notes Section */}
    {/* Footer Section */}
  </>
)}
```

#### Print CSS Specifications
```css
@media print {
  @page {
    size: A4;
    margin: 50mm 10mm 40mm 10mm;
  }
  
  html, body, .container, .invoice-page {
    background-color: white !important;
  }
  
  .notes-box {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
  
  .page-break {
    page-break-after: always;
  }
}
```

### 🔧 Recent Critical Fixes Applied
1. **QuickBooks Journal Entry Balancing**: Fixed accounting equation to ensure debits equal credits (AR Dr + Discount Dr = Sales Cr + Freight Cr)
2. **Journal Entry Update Logic**: System now updates existing journal entries instead of creating duplicates
3. **Discount Implementation**: Added editable discount field with 2% automatic default for new invoices
4. **Total Calculation**: Invoice totals now correctly calculate as: Subtotal + Freight - Discount

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