# Design Guidelines: Padel Racket Affiliate Website

## Design Approach

**Reference-Based Design** inspired by Padelful.com and modern product review platforms (Wirecutter, TechRadar). This is a content-rich affiliate platform requiring clean product presentation, intuitive filtering, and trust-building elements.

**Core Design Principles:**
- Product-first showcase with high-quality racket imagery
- Data visualization for performance metrics
- Clear hierarchy between reviews, guides, and promotional content
- Trust signals through detailed ratings and transparent pricing

---

## Typography

**Font Stack:**
- Primary: 'Inter' (Google Fonts) - UI, body text, product specs
- Headings: 'Inter' with varied weights (600-700)
- Accent: 'Space Grotesk' (Google Fonts) - Hero headlines, section titles

**Hierarchy:**
- Hero headline: text-5xl to text-6xl, font-bold
- Section titles: text-3xl to text-4xl, font-semibold
- Product titles: text-xl, font-semibold
- Body text: text-base, font-normal
- Metadata/specs: text-sm, font-medium
- Labels/badges: text-xs, font-semibold, uppercase tracking-wide

---

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Card gaps: gap-6 to gap-8
- Element spacing: space-y-4 to space-y-6

**Container Widths:**
- Full width sections: max-w-7xl mx-auto px-6
- Content sections: max-w-6xl mx-auto
- Product grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

---

## Component Library

### Navigation Header
- Sticky header with logo left, main menu center, search/CTA right
- Menu items: Padel Rackets, Guides, Brands, Blog
- Search bar with icon, expandable on mobile
- Trust indicator: "1,200+ Rackets Reviewed" badge

### Hero Section (Homepage)
- Full-width hero with dramatic padel court/player background image
- Centered headline: "Find Your Perfect Padel Racket"
- Subheadline highlighting USP: "Expert reviews, detailed ratings, best prices"
- Primary CTA: "Browse All Rackets" + Secondary: "Take Our Quiz"
- Hero height: min-h-[500px] lg:min-h-[600px]

### Product Cards (Racket Reviews)
- Card structure: image top, content bottom, white background, subtle border
- Racket image: aspect-ratio-3/4, object-contain, centered
- Brand tag: top-left badge with logo
- Product name: text-xl font-semibold
- Rating display: 5 horizontal metric bars (Power, Control, Rebound, Maneuverability, Sweet Spot)
  - Each bar: h-2, rounded-full, filled portion in accent color
  - Label: text-xs, 3-letter abbreviation (PWR, CTL, RBD, MAN, SS)
  - Value: text-sm, aligned right
- Pricing: Original price (strikethrough), current price (large, bold), discount badge
- Overall score: circular badge (text-2xl) positioned top-right
- Hover: subtle lift (transform hover:-translate-y-1) and shadow increase

### Recent Reviews Section (Homepage)
- Grid layout: 5 columns on desktop (2 rows = 10 items), 2-3 on tablet, 1 on mobile
- Section title: "Latest Racket Reviews"
- "View All Reviews" link positioned top-right

### CTA Section
- Full-width with gradient or solid background treatment
- Centered content: headline + supporting text + email capture form
- Email input + submit button inline on desktop, stacked on mobile
- Trust elements below: "Join 25,000+ players" + social proof icons

### Guides Section (Homepage)
- Grid: 4 columns on desktop (8 guides in 2 rows), 2 on tablet
- Guide cards: featured image, category badge, title, excerpt, "Read More" link
- Images: aspect-ratio-16/9

### Filter Sidebar (Rackets Page)
- Fixed width sidebar (w-64 to w-72) on desktop, collapsible drawer on mobile
- Filter groups: Shape (checkboxes), Rating (range slider), Season (year buttons), Brand (checkboxes with brand logos)
- Active filters displayed as removable chips above product grid
- "Clear All Filters" link

### Racket Detail Page
- Split layout: Large racket image left (60%), specifications right (40%)
- Image gallery: main image + 3-4 thumbnails below
- Specs panel: Rating bars (full-size), price, affiliate "Buy Now" button (prominent)
- Tabs below: Full Review, Specifications, User Comments
- Related rackets carousel at bottom

### Brand Page
- Brand header: logo, description, "Top Rated" count
- Featured article section: hero-style layout with brand's story
- "Top Rackets from [Brand]" grid: 6-12 products, sorted by rating
- Comparison table: side-by-side specs of top 3 rackets

### Admin Upload Interface
- Drag-drop zone for Excel file upload
- Table preview showing rackets to be created/updated
- Status indicators: "New", "Price Update", "No Change"
- Confirm/cancel actions with clear feedback

### Footer
- Multi-column layout: About, Quick Links, Popular Brands, Newsletter Signup
- Social media icons
- Disclaimer: "As an Amazon Associate, we earn from qualifying purchases"
- Copyright and legal links

---

## Visual Elements

### Icons
- Heroicons via CDN for UI elements (filters, navigation, actions)
- Sport-specific icons for metrics where appropriate

### Rating Visualization
- Horizontal progress bars for individual metrics (Power, Control, etc.)
- Overall score: large circular badge with number (out of 100)
- Color coding: 85+ (excellent), 75-84 (good), below 75 (average)

### Badges & Labels
- "New 2024" seasonal badges
- Discount percentages in contrasting accent
- Player level tags: "Beginner", "Intermediate", "Advanced"

---

## Images

**Hero Image:**
- Large, high-quality padel court action shot with players
- Slightly darkened overlay for text readability
- Buttons on hero use backdrop-blur-sm with semi-transparent backgrounds

**Product Images:**
- Clean product photos on white/transparent background
- Consistent aspect ratio (3:4) across all rackets
- High resolution for zoom capability on detail pages

**Guide Images:**
- Lifestyle/action shots showing rackets in use
- Featured images for each guide article (16:9 ratio)

**Brand Logos:**
- SVG format for crisp rendering at any size
- Used in filters, product cards, and brand pages

---

## Key Interactions

- Smooth page transitions
- Instant filter updates (no page reload)
- Card hover effects: subtle elevation and shadow
- Sticky header on scroll
- Lazy loading for product images
- Rating bars animate on scroll into view
- Excel upload shows progress indicator

---

**Design Tone:** Professional yet approachable, data-driven but visually engaging, trustworthy affiliate platform for serious padel players.