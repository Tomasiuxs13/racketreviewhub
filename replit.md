# Padel Racket Affiliate Website

## Overview

This is a content-rich affiliate marketing platform for padel racket reviews and recommendations. The application provides expert reviews with detailed performance ratings, buying guides, brand information, and blog content. It features product comparison tools, affiliate link management, and an admin interface for importing racket data from spreadsheets.

The platform is designed as a product-first showcase inspired by modern review platforms (Wirecutter, TechRadar) with clean presentation, data visualization for racket performance metrics, and transparent pricing with affiliate monetization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool and dev server with HMR support
- Wouter for lightweight client-side routing (no React Router dependency)
- Single-page application (SPA) architecture with route-based code organization

**UI Component System**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- "New York" style variant with custom color system and spacing scale
- Typography using Inter (UI/body) and Space Grotesk (headings) from Google Fonts
- Responsive design with mobile-first breakpoints (md: 768px, lg: 1024px, xl: 1280px)

**State Management**
- TanStack Query (React Query) for server state management and caching
- Local component state with React hooks
- No global state management library (Redux/Zustand) - relies on React Query's cache

**Design System**
- Custom CSS variables for theming (light/dark mode support)
- Elevation system using shadow and opacity utilities (hover-elevate, active-elevate-2)
- Consistent spacing primitives (4, 6, 8, 12, 16, 24 Tailwind units)
- Maximum container width of 7xl (1280px) for content sections

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- ESM modules (type: "module" in package.json)
- Development server with tsx for TypeScript execution
- Production build using esbuild for server bundling

**API Design**
- RESTful API endpoints under `/api` prefix
- JSON request/response format
- File upload support using Multer (memory storage)
- Request logging middleware for API calls

**Key API Routes**
- `/api/rackets` - CRUD operations for racket catalog
- `/api/rackets/:id` - Individual racket details
- `/api/rackets/recent` - Latest racket additions
- `/api/rackets/related/:id` - Related racket recommendations
- `/api/brands` - Brand directory and information
- `/api/guides` - Buying guides and educational content
- `/api/blog` - Blog posts and news articles
- `/api/admin/upload-rackets` - Spreadsheet import for bulk racket data

**File Processing**
- Excel/Numbers file parsing for racket data import
- Support for .xlsx, .xls, and .numbers formats
- XLSX library for Excel parsing
- AdmZip for handling compressed Apple Numbers files
- Validation using Zod schemas before database insertion

### Data Storage Solutions

**Database Strategy**
- Drizzle ORM for type-safe database operations
- PostgreSQL as the primary database (via Neon serverless driver)
- Schema-first approach with TypeScript type inference
- Migrations stored in `/migrations` directory

**Data Models**
- **Rackets**: Core product catalog with performance ratings (power, control, rebound, maneuverability, sweet spot), pricing (original/current), affiliate links, and metadata
- **Guides**: Educational content with categories (beginners, intermediate, advanced, general)
- **Blog Posts**: News and article content with featured images
- **Brands**: Brand directory with logos, descriptions, and associated rackets

**Current Implementation**
- In-memory storage implementation (MemStorage class) for development
- Interface-based design (IStorage) allows easy swap to database implementation
- UUID-based primary keys for all entities
- Timestamps for created/updated tracking

**Schema Features**
- Calculated fields (overall rating as average of individual metrics)
- Decimal precision for pricing (10,2 scale)
- Text fields for rich content (reviews, guides, blog posts)
- Slug-based routing for SEO-friendly URLs

### External Dependencies

**Third-Party UI Libraries**
- Radix UI primitives for accessible components (accordion, dialog, dropdown, popover, etc.)
- Lucide React for icon system
- cmdk for command palette functionality
- react-day-picker for calendar/date selection
- Recharts for potential data visualization

**Database & ORM**
- @neondatabase/serverless - Serverless PostgreSQL driver optimized for edge/serverless environments
- Drizzle ORM for type-safe queries and schema management
- drizzle-kit for migrations and schema push commands

**File Processing**
- xlsx - Excel spreadsheet parsing
- adm-zip - ZIP archive handling for Apple Numbers files
- plist - Property list parsing for Numbers metadata
- multer - Multipart form data handling for file uploads

**Validation & Forms**
- Zod for runtime schema validation
- @hookform/resolvers for React Hook Form integration
- drizzle-zod for automatic schema generation from database models

**Development Tools**
- @replit/vite-plugin-runtime-error-modal - Error overlay in development
- @replit/vite-plugin-cartographer - Code mapping for Replit
- @replit/vite-plugin-dev-banner - Development environment indicator

**Session Management**
- express-session (implied by connect-pg-simple dependency)
- connect-pg-simple for PostgreSQL session storage

**Utility Libraries**
- class-variance-authority (cva) - Type-safe component variant management
- clsx & tailwind-merge - Conditional className utilities
- date-fns - Date manipulation and formatting
- nanoid - Unique ID generation

**Potential Future Integrations**
- Affiliate network APIs for dynamic pricing/availability
- Image CDN for racket photos
- Analytics platform integration
- Email service for newsletters
- Search/filtering service (Algolia/Meilisearch)