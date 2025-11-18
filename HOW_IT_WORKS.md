# How Racket Review Hub Works

## Overview

Racket Review Hub is a full-stack web application for reviewing and comparing padel rackets. It provides detailed ratings, expert reviews, buying guides, brand information, and blog content. The application features an admin panel for bulk uploading racket data via Excel/Numbers files.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight routing
- **TanStack Query (React Query)** - Data fetching and caching
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Pre-built UI components

### Backend
- **Express.js** - Web server framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM (configured for PostgreSQL)
- **Multer** - File upload handling
- **XLSX** - Excel file parsing
- **Adm-Zip** - ZIP archive handling (for .numbers files)

### Database
- **PostgreSQL** (via Drizzle ORM)
- Currently using in-memory storage (`MemStorage`) for development
- Schema defined in `shared/schema.ts`

## Architecture

### Project Structure

```
racketreviewhub/
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utilities and config
│   │   └── App.tsx     # Main app component
│   └── index.html      # HTML entry point
├── server/             # Backend Express application
│   ├── index.ts        # Server entry point
│   ├── routes.ts       # API route definitions
│   ├── storage.ts      # Data access layer
│   ├── vite.ts         # Vite dev server integration
│   └── numbersParser.ts # Apple Numbers file parser
├── shared/             # Shared code between frontend/backend
│   └── schema.ts       # Database schema and types
└── attached_assets/    # Static assets (images, etc.)
```

## Database Schema

The application uses four main data models:

### 1. Rackets (`rackets` table)
- **id**: UUID primary key
- **brand**: Brand name (e.g., "Babolat", "Bullpadel")
- **model**: Model name (e.g., "Technical Viper")
- **year**: Release year
- **shape**: Racket shape (diamond, round, teardrop)
- **Ratings** (0-100 scale):
  - `powerRating`
  - `controlRating`
  - `reboundRating`
  - `maneuverabilityRating`
  - `sweetSpotRating`
- **overallRating**: Calculated average of all ratings
- **originalPrice**: Original retail price
- **currentPrice**: Current selling price
- **imageUrl**: Product image URL
- **affiliateLink**: Affiliate purchase link
- **reviewContent**: HTML review text
- **createdAt**, **updatedAt**: Timestamps

### 2. Guides (`guides` table)
- **id**: UUID primary key
- **title**: Guide title
- **slug**: URL-friendly identifier
- **excerpt**: Short description
- **content**: Full HTML content
- **category**: beginners, intermediate, advanced, general
- **featuredImage**: Image URL
- **publishedAt**, **updatedAt**: Timestamps

### 3. Blog Posts (`blog_posts` table)
- **id**: UUID primary key
- **title**: Post title
- **slug**: URL-friendly identifier
- **excerpt**: Short description
- **content**: Full HTML content
- **author**: Author name
- **featuredImage**: Image URL
- **publishedAt**, **updatedAt**: Timestamps

### 4. Brands (`brands` table)
- **id**: UUID primary key
- **name**: Brand name
- **slug**: URL-friendly identifier
- **description**: Brand description
- **logoUrl**: Brand logo URL
- **articleContent**: Full brand story/article (HTML)
- **createdAt**: Timestamp

## Frontend Architecture

### Routing

The app uses **Wouter** for client-side routing:

- `/` - Home page with hero section, recent rackets, and guides
- `/rackets` - Browse all rackets with filtering
- `/rackets/:id` - Individual racket detail page
- `/guides` - List of buying guides
- `/guides/:slug` - Individual guide page
- `/brands` - List of brands
- `/brands/:slug` - Brand detail page with rackets
- `/blog` - Blog post listing
- `/blog/:slug` - Individual blog post
- `/admin` - Admin panel for uploading rackets

### Data Fetching

**TanStack Query** handles all data fetching:

- Queries are keyed by API endpoint (e.g., `["/api/rackets"]`)
- Automatic caching and background refetching
- Optimistic updates for mutations
- Query invalidation after file uploads

Example:
```typescript
const { data: rackets } = useQuery<Racket[]>({
  queryKey: ["/api/rackets"],
});
```

### Component Structure

- **Header**: Navigation bar with links to main sections
- **Footer**: Site footer with links and info
- **RacketCard**: Reusable card component for displaying rackets
- **RatingBar**: Visual rating display component
- **UI Components**: shadcn/ui components (Button, Card, Dialog, etc.)

## Backend Architecture

### Server Setup (`server/index.ts`)

1. **Express app initialization**
   - JSON body parsing
   - URL-encoded form parsing
   - Request logging middleware
   - Error handling middleware

2. **Route registration**
   - All API routes registered via `registerRoutes()`
   - Returns HTTP server instance

3. **Vite integration** (development only)
   - Vite dev server middleware for HMR
   - Serves React app with hot reloading

4. **Static file serving** (production)
   - Serves built files from `dist/public`
   - Fallback to `index.html` for client-side routing

### API Routes (`server/routes.ts`)

#### Rackets Endpoints
- `GET /api/rackets` - Get all rackets
- `GET /api/rackets/recent` - Get recent rackets (limit: 10)
- `GET /api/rackets/:id` - Get single racket by ID
- `GET /api/rackets/related/:id` - Get related rackets (same brand, limit: 4)

#### Guides Endpoints
- `GET /api/guides` - Get all guides
- `GET /api/guides/recent` - Get recent guides (limit: 8)
- `GET /api/guides/:slug` - Get guide by slug

#### Brands Endpoints
- `GET /api/brands` - Get all brands
- `GET /api/brands/:slug` - Get brand by slug
- `GET /api/brands/:slug/rackets` - Get rackets for a brand

#### Blog Endpoints
- `GET /api/blog` - Get all blog posts
- `GET /api/blog/:slug` - Get blog post by slug

#### Admin Endpoints
- `POST /api/admin/upload-rackets` - Upload Excel/Numbers file to create/update rackets

### Storage Layer (`server/storage.ts`)

Currently implements **in-memory storage** (`MemStorage` class):

- Uses JavaScript `Map` objects for data storage
- Seeded with sample data on initialization
- Implements `IStorage` interface for future database migration
- Methods for CRUD operations on all entities

**Key Methods:**
- `getAllRackets()` - Returns all rackets sorted by creation date
- `getRacket(id)` - Get single racket
- `getRacketByBrandAndModel()` - Find existing racket for updates
- `createRacket()` - Create new racket (calculates overallRating)
- `updateRacket()` - Update existing racket (recalculates overallRating)
- Similar methods for guides, blog posts, and brands

**Note:** The codebase is configured for PostgreSQL via Drizzle ORM, but currently uses in-memory storage. To switch to database:
1. Set `DATABASE_URL` environment variable
2. Replace `MemStorage` with database-backed implementation
3. Run `npm run db:push` to sync schema

## Key Features

### 1. Racket Upload System

The admin panel (`/admin`) allows bulk uploading rackets via Excel or Numbers files.

**File Processing Flow:**
1. User uploads file via drag-and-drop or file picker
2. File validated (size limit: 10MB, extensions: .xlsx, .xls, .numbers)
3. File parsed using XLSX library
4. Column names normalized (case-insensitive, punctuation removed)
5. Each row validated using Zod schema
6. For each racket:
   - If ratings missing → estimated based on brand/model (deterministic)
   - Check if racket exists (by brand + model)
   - If exists → update (prices, ratings, etc.)
   - If new → create
7. Results returned: created count, updated count, errors

**Column Mapping:**
The system is flexible with column names:
- `brand` / `brand_name` / `marca`
- `model` / `model_name` / `modelo`
- `shape` / `forma` / `shape_type` (normalized to: diamond, round, teardrop)
- `currentPrice` / `current_price` / `price` / `precio`
- Ratings: `powerRating`, `controlRating`, etc. (various formats)
- Optional: `year`, `originalPrice`, `imageUrl`, `affiliateLink`, `reviewContent`

**Rating Estimation:**
If ratings are missing, the system estimates them based on brand reputation:
- High-end brands (Nox, Bullpadel, Head): 80-95 range
- Premium brands (Babolat, Adidas, Wilson): 75-90 range
- Mid-tier brands (Dunlop, Prince, Tecnifibre): 70-85 range
- Other brands: 70-85 range (wider variance)

Estimates are deterministic (same brand+model = same ratings).

### 2. Filtering and Sorting

The rackets page (`/rackets`) provides:
- **Brand filter**: Multi-select checkboxes
- **Shape filter**: Diamond, Round, Teardrop
- **Rating filter**: Minimum overall rating (75+, 80+, 85+, 90+)
- **Sort options**:
  - Newest (by year, then creation date)
  - Highest Rated
  - Price: Low to High
  - Price: High to Low

Filters work client-side on fetched data.

### 3. Related Rackets

Racket detail pages show related rackets:
- Same brand
- Sorted by overall rating
- Limit: 4 rackets

### 4. Responsive Design

- Mobile-first approach
- Mobile filters in slide-out sheet
- Desktop filters in sidebar
- Responsive grid layouts

## Data Flow

### Reading Data
1. User navigates to page
2. React component calls `useQuery()` hook
3. TanStack Query checks cache
4. If not cached, fetches from API endpoint
5. Express route handler calls storage method
6. Storage returns data (from memory or database)
7. Data flows back through API → React Query → Component
8. UI updates

### Writing Data (File Upload)
1. User selects/drops file in admin panel
2. `useMutation()` hook triggered
3. File sent as FormData to `/api/admin/upload-rackets`
4. Multer middleware handles file upload
5. File parsed row by row
6. Each row validated and processed
7. Storage methods called (create/update)
8. Results returned to frontend
9. React Query cache invalidated
10. UI refreshes with new data

## Development Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
- Starts Express server on port 5000 (or PORT env var)
- Vite dev server with HMR
- Frontend accessible at `http://localhost:5000`

### Building
```bash
npm run build
```
- Builds React app to `dist/public`
- Bundles server code to `dist/index.js`

### Production
```bash
npm start
```
- Runs built server from `dist/index.js`
- Serves static files from `dist/public`

### Database (Future)
```bash
npm run db:push
```
- Pushes schema changes to PostgreSQL database
- Requires `DATABASE_URL` environment variable

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - PostgreSQL connection string (for future database migration)

## File Upload Format

### Required Columns
- `brand` - Brand name
- `model` - Model name
- `shape` - One of: diamond, round, teardrop
- `currentPrice` - Current price (number)

### Optional Columns
- `year` - Release year (defaults to current year)
- `originalPrice` - Original retail price
- `powerRating` - Power rating 0-100 (auto-estimated if missing)
- `controlRating` - Control rating 0-100 (auto-estimated if missing)
- `reboundRating` - Rebound rating 0-100 (auto-estimated if missing)
- `maneuverabilityRating` - Maneuverability rating 0-100 (auto-estimated if missing)
- `sweetSpotRating` - Sweet spot rating 0-100 (auto-estimated if missing)
- `imageUrl` - Product image URL
- `affiliateLink` - Affiliate purchase link
- `reviewContent` - HTML review text

### Example Excel Row
```
brand          | model           | year | shape    | currentPrice | powerRating | controlRating
Babolat        | Technical Viper | 2024 | diamond  | 189.99      | 95          | 75
```

## Future Enhancements

1. **Database Migration**: Replace `MemStorage` with PostgreSQL via Drizzle ORM
2. **User Authentication**: Add user accounts and authentication
3. **User Reviews**: Allow users to submit reviews and ratings
4. **Search**: Full-text search across rackets, guides, and blog posts
5. **Price Tracking**: Track price history and alerts
6. **Comparison Tool**: Side-by-side racket comparison
7. **Wishlist**: Save favorite rackets
8. **Email Notifications**: Price drop alerts, new reviews

## Notes

- Currently uses in-memory storage (data lost on server restart)
- Apple Numbers (.numbers) file parsing is limited - users should export to Excel
- All ratings are on a 0-100 scale
- Overall rating is calculated as the average of all 5 rating categories
- The application is designed to be easily migrated to a database-backed storage system






