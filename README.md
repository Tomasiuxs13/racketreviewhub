# Padel Racket Review Hub

A modern, template-based static HTML website for padel racket reviews, comparisons, and buying guides. Built with vanilla HTML, CSS, and JavaScript for fast performance and easy customization.

## Features

- **Template-based architecture** - Reusable templates for easy content management
- **Config-driven content** - Navigation, affiliate links, and product data in easy-to-edit config files
- **Responsive design** - Mobile-first approach with breakpoints for all devices
- **SEO optimized** - Semantic HTML, meta tags, and structured data (JSON-LD)
- **Two-column layout** - Main content with sticky sidebar for product specs and affiliate links
- **Clean navigation** - Dropdown menus with organized structure
- **Fast loading** - Vanilla JavaScript, no frameworks, optimized CSS

## Project Structure

```
/
├── index.html                    # Homepage
├── articles/
│   ├── reviews/                  # Individual racket reviews
│   ├── best-lists/              # "Best of" articles
│   ├── guides/                  # Buying guides and educational content
│   └── comparisons/             # Head-to-head comparisons
├── templates/
│   ├── header.html              # Site header/navigation
│   ├── footer.html              # Site footer
│   ├── sidebar.html             # Product sidebar template
│   └── hero.html                # Hero section template
├── css/
│   ├── main.css                 # Base styles and variables
│   ├── components.css           # Component-specific styles
│   └── responsive.css           # Mobile breakpoints
├── js/
│   ├── config.js                # Site configuration (navigation, products, links)
│   ├── templates.js              # Template loading and rendering
│   └── main.js                  # Main functionality
└── images/
    ├── products/                # Product images
    ├── logos/                   # Brand logos
    └── placeholders/            # Placeholder images
```

## Setup Instructions

### 1. Local Development

Since this is a static HTML site, you can run it locally using any web server:

**Option A: Python Simple Server**
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Option B: Node.js http-server**
```bash
# Install globally
npm install -g http-server

# Run
http-server -p 8000
```

**Option C: VS Code Live Server**
- Install the "Live Server" extension
- Right-click on `index.html` and select "Open with Live Server"

Then open `http://localhost:8000` in your browser.

### 2. Configuration

#### Update Site Information
Edit `js/config.js` to customize:
- Site name and description
- Navigation structure
- Affiliate link configurations
- Product data loading behavior (defaults to `/data/merged-products.json`)

#### Sync Product Catalog From Excel
Product entries now live in `/data/merged-products.json`, which is generated automatically from the latest Padeln Nuestro export. To update pricing, specs, verdicts, or add new rackets:

1. Place your source file in `/data/` (or note its absolute path). The script supports both Excel (`.xlsx`) and Numbers (`.numbers`) file formats.

3. Install dependencies once: `npm install`

4. Run the importer:
   ```bash
   npm run sync:padel -- --source "/absolute/path/to/Padel Rackets - Online Shopping _ Pādel Nuestro.xlsx"
   ```

5. The script will:
   - Parse the spreadsheet into `data/parsed-rackets.json` for reference
   - Merge updates into `data/merged-products.json`, preserving any existing ratings or alternatives
   - Report how many products were added or updated

**Column Mapping**: The script expects these column names:
- `Model` - Product name (required)
- `Title_URL` - Product URL for affiliate links
- `Brand` - Brand name
- `Current price` - Product price
- `Short description` - Brief product description
- `Description` - Full product description/verdict
- `Player` - Associated player name
- `Shape`, `Balance`, `Hardness`, `Surface`, `Core`, `Game level` - Product specifications
- `Image_URL` - Product image URL

Additional options:
- `--dry-run` – preview changes without writing files
- `--parsed <path>` / `--merged <path>` – override output locations

#### Update Product Years
Since the source file doesn't include release years, you can manually set them in `data/product-years.json`:

```json
{
  "adidas-metalbone-09-2025": "2025",
  "bullpadel-vertex-03": "2024",
  "nox-at10-genius-18k": "2024"
}
```

After updating the year mapping file, run the sync script again to apply the changes. The script will:
1. Check `product-years.json` first
2. Then use existing year from merged data
3. Then try to infer from product name/description
4. Only default to current year as last resort

#### Update Navigation
Edit the `NAVIGATION` object in `js/config.js` to add or modify menu items.

### 3. Creating New Articles

#### Review Article Template
1. Copy an existing review from `articles/reviews/`
2. Update the meta tags (title, description, keywords)
3. Set the product ID in the sidebar placeholder: `<div id="sidebar-placeholder" data-product-id="product-id"></div>`
4. Update hero section data attributes
5. Write your review content

#### Best List Article
1. Copy `articles/best-lists/best-padel-rackets-2025.html`
2. Update meta tags and content
3. Add product cards or comparison tables
4. Link to individual reviews

#### Guide Article
1. Copy `articles/guides/buying-guide-beginners.html`
2. Update meta tags and content
3. Structure with clear headings and sections
4. Add internal links to relevant reviews

### 4. Adding Images

1. Place product images in `images/products/`
2. Use descriptive filenames (e.g., `bullpadel-hack-03.jpg`)
3. Update image paths in your Excel source or directly in `data/merged-products.json`
4. Recommended image size: 800x800px or larger
5. Use placeholder images in `images/placeholders/` for missing images

### 5. Customization

#### Colors and Styling
Edit CSS variables in `css/main.css`:

```css
:root {
  --color-primary: #0066CC;
  --color-secondary: #FF9900;
  /* ... more variables */
}
```

#### Typography
Update font variables in `css/main.css`:

```css
--font-primary: Your-Font, sans-serif;
--font-heading: Your-Heading-Font, sans-serif;
```

#### Layout
Modify grid settings in `css/main.css`:

```css
--sidebar-width: 30%;
--content-width: 70%;
```

## Deployment

### GitHub Pages

1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select your branch and folder (usually `main` and `/ (root)`)
4. Your site will be available at `https://username.github.io/repository-name`

### Hostinger (Static HTML)

1. **Upload Files:**
   - Connect via FTP or use Hostinger's File Manager
   - Upload all files to the `public_html` folder (or your domain's root folder)

2. **File Structure on Server:**
   ```
   public_html/
   ├── index.html
   ├── articles/
   ├── templates/
   ├── css/
   ├── js/
   └── images/
   ```

3. **Update Paths (if needed):**
   - If deploying to a subdirectory, update paths in HTML files
   - Change `/css/main.css` to `./css/main.css` or use relative paths

4. **Test:**
   - Visit your domain to verify everything works
   - Check that templates load correctly
   - Test navigation and links

### Important Notes for Deployment

- **Template Loading:** The site uses `fetch()` to load templates. Some servers may require proper MIME types. Ensure your server serves `.html` files with `text/html` content type.
- **CORS:** If templates don't load, you may need to configure CORS headers on your server.
- **HTTPS:** For production, use HTTPS to avoid mixed content issues.

## SEO Optimization

The site includes:
- Semantic HTML5 structure
- Meta tags (title, description, keywords, Open Graph)
- JSON-LD structured data (Product, Review, Article schemas)
- Proper heading hierarchy
- Clean URL structure
- Alt text for images (add descriptive alt attributes)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Maintenance

### Adding New Content
1. Run `npm run sync:padel` to refresh `data/merged-products.json`
2. Create new article HTML files
3. Update navigation in `js/config.js` if needed
4. Add images to the appropriate folders

### Updating Affiliate Links
Edit the `AFFILIATE_LINKS` object in `js/config.js` to update base URLs or add new affiliate partners.

### Updating Navigation
Modify the `NAVIGATION` object in `js/config.js`. Changes will automatically reflect across all pages.

## Troubleshooting

**Templates not loading:**
- Check browser console for errors
- Verify file paths are correct
- Ensure server is running (not just opening HTML files)
- Check CORS settings if using a server

**Sidebar not showing:**
- Verify `data/merged-products.json` includes the product ID used in `data-product-id`
- Confirm the JSON file loads successfully (check the network tab for `/data/merged-products.json`)
- Check that `data-product-id` attribute is set correctly
- Ensure `js/config.js` is loaded before `js/templates.js`

**Product names showing URLs:**
- Check that your Excel file has a `Model` column (not `Title_URL` in the Model column)
- Verify the column mapping in `scripts/sync-padel-data.js` matches your Excel file structure
- Run with `--dry-run` to preview what will be imported

**All products showing year 2025:**
- Update `data/product-years.json` with correct release years for each product
- Check product IDs in `data/merged-products.json` to find the correct IDs to use
- Run the sync script again after updating the year mapping file

**Mobile menu not working:**
- Check that `js/main.js` is loaded
- Verify menu toggle button exists
- Check for JavaScript errors in console

## License

This project is provided as-is for use in building affiliate review websites.

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify all file paths are correct
3. Ensure all JavaScript files are loaded in the correct order
4. Test with a local server (not just opening HTML files)

---

**Built with:** HTML5, CSS3, Vanilla JavaScript  
**No frameworks or dependencies required**


