# Excel File Headers Guide

This document lists all supported column headers for uploading racket data via Excel files.

## How Column Names Work

The system normalizes column names by:
- Converting to lowercase
- Removing punctuation
- Replacing spaces with underscores

For example: `"Current price"` → `"current_price"`, `"Price1"` → `"price1"`

---

## Required Columns

These columns **must** be present in your Excel file:

| Column Name (Examples) | Description | Notes |
|------------------------|-------------|-------|
| `brand` or `Brand` or `Brand Name` | Brand name | Required |
| `model` or `Model` or `Model Name` | Model name | Required |
| `shape` or `Shape` | Racket shape | Must be: `diamond`, `round`, or `teardrop` |
| `currentPrice` or `Current price` or `Price` | Current selling price | Required, can include currency symbols (€, $, £) |

---

## Optional Columns

### Price Information

| Column Name (Examples) | Description |
|------------------------|-------------|
| `Previous price` or `Previous Price` | Previous/original price (most common) |
| `Price1` | Alternative name for previous price |
| `originalPrice` or `Original Price` | Original retail price |
| `oldPrice` or `Old Price` | Old price |
| `rrp` or `RRP` | Recommended retail price |
| `listPrice` or `List Price` | List price |
| `msrp` or `MSRP` | Manufacturer's suggested retail price |
| `retailPrice` or `Retail Price` | Retail price |

### Year

| Column Name (Examples) | Description |
|------------------------|-------------|
| `year` or `Year` | Release year | Defaults to current year if missing |
| `yearReleased` or `Year Released` | Release year |
| `ano` | Year (Spanish) |

### Performance Ratings (0-100)

All ratings are **optional** - they will be auto-estimated if missing.

| Column Name (Examples) | Description |
|------------------------|-------------|
| `powerRating` or `Power Rating` or `Power` | Power rating (0-100) |
| `controlRating` or `Control Rating` or `Control` | Control rating (0-100) |
| `reboundRating` or `Rebound Rating` or `Rebound` | Rebound rating (0-100) |
| `maneuverabilityRating` or `Maneuverability Rating` or `Maneuverability` | Maneuverability rating (0-100) |
| `sweetSpotRating` or `Sweet Spot Rating` or `Sweet Spot` | Sweet spot rating (0-100) |

### URLs and Links

| Column Name (Examples) | Description |
|------------------------|-------------|
| `imageUrl` or `Image URL` or `Image` | Image URL |
| `affiliateLink` or `Affiliate Link` or `Link` | Affiliate link |
| `titleUrl` or `Title URL` or `Title_URL` | Product URL from Excel |
| `url` | Generic URL |

### Review Content

| Column Name (Examples) | Description |
|------------------------|-------------|
| `reviewContent` or `Review Content` or `Review` | Review content (HTML supported) |
| `description` or `Description` | Description text |

### Specification Fields (All Optional)

| Column Name (Examples) | Description |
|------------------------|-------------|
| `color` or `Color` or `Colour` | Color |
| `balance` or `Balance` | Balance |
| `surface` or `Surface` | Surface type |
| `hardness` or `Hardness` | Hardness level |
| `finish` or `Finish` | Finish type |
| `playersCollection` or `Players Collection` or `Collection` | Players collection |
| `product` or `Product` | Product type |
| `core` or `Core` | Core material |
| `format` or `Format` | Format |
| `gameLevel` or `Game Level` or `Level` | Game level (e.g., "Advanced", "Beginner") |
| `gameType` or `Game Type` | Game type |
| `player` or `Player` or `Gender` | Player type: `man`, `woman`, or `both` |

---

## Example Excel File Structure

Here's an example of how your Excel file should look:

| Brand | Model | Shape | Current price | Previous price | Year | Image URL | Color | Balance |
|-------|-------|-------|---------------|----------------|------|-----------|-------|---------|
| Bullpadel | XPLO 25 | diamond | €149.95 | €339.95 | 2025 | https://... | Red | High |
| Head | Delta Elite | round | €199.99 | €299.99 | 2024 | https://... | Blue | Medium |

---

## Important Notes

1. **Case Insensitive**: Column names are case-insensitive (`Brand` = `brand` = `BRAND`)

2. **Spaces and Punctuation**: Spaces and punctuation are automatically handled (`Current price` = `Current_price` = `current-price`)

3. **Currency Symbols**: Prices can include currency symbols (€, $, £) - they will be automatically removed

4. **EU Number Format**: Supports comma as decimal separator (e.g., `149,95` = `149.95`)

5. **Empty Rows**: Empty rows are automatically skipped

6. **Auto-Estimation**: If ratings are missing, they will be automatically estimated based on brand and model

7. **Year Default**: If year is missing, it defaults to the current year

---

## Your Current File Format

Based on your file, these headers work:
- `Title` → Used for model name (if Model column not found)
- `Title_URL` → Used for product URL
- `Current price` → Current price ✅
- `Previous price` → Previous/original price ✅
- `Brand` → Brand name ✅
- `Model` → Model name ✅
- `Shape` → Racket shape ✅
- `Image_URL` → Image URL ✅
- `Color`, `Balance`, `Surface`, `Hardness`, `Finish`, etc. → Specification fields ✅

Your current file format is **fully supported**! ✅



