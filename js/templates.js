// Template Loading and Rendering System

/**
 * Load a template file and return its content as a string
 */
async function loadTemplate(templatePath) {
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${templatePath}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading template:', error);
    return '';
  }
}

/**
 * Render navigation menu from config
 */
function renderNavigation() {
  const navList = document.getElementById('main-nav');
  if (!navList || !NAVIGATION) return;

  navList.innerHTML = '';

  NAVIGATION.main.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav-item';

    const a = document.createElement('a');
    a.href = item.url;
    a.className = 'nav-link' + (item.hasDropdown ? ' has-dropdown' : '');
    a.textContent = item.label;
    li.appendChild(a);

    if (item.hasDropdown && item.items) {
      const dropdown = document.createElement('ul');
      dropdown.className = 'dropdown';
      
      item.items.forEach(subItem => {
        const subLi = document.createElement('li');
        const subA = document.createElement('a');
        subA.href = subItem.url;
        subA.className = 'dropdown-item';
        subA.textContent = subItem.label;
        subLi.appendChild(subA);
        dropdown.appendChild(subLi);
      });
      
      li.appendChild(dropdown);
    }

    navList.appendChild(li);
  });
}

/**
 * Render footer navigation
 */
function renderFooterNavigation() {
  const footerNav = document.getElementById('footer-nav');
  if (!footerNav || !NAVIGATION) return;

  footerNav.innerHTML = '';

  NAVIGATION.footer.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.url;
    a.textContent = item.label;
    li.appendChild(a);
    footerNav.appendChild(li);
  });
}

/**
 * Render product sidebar
 */
async function renderProductSidebar(productId) {
  try {
    if (typeof ensureProductsReady === 'function') {
      await ensureProductsReady();
    }

    const sidebar = document.getElementById('product-sidebar');
    if (!sidebar || !PRODUCTS || !PRODUCTS[productId]) return;

    const product = PRODUCTS[productId];

    let html = '';
    
    // Overall rating at the top
    if (product.ratings && typeof product.ratings.overall === 'number') {
      html += `<div class="sidebar-rating-top">${product.ratings.overall}/10</div>`;
    }
    
    html += `
      <div class="sidebar-price">From ${product.price || 'N/A'}</div>
    `;

    // Affiliate buttons
    if (product.affiliateLinks) {
      if (product.affiliateLinks.amazon) {
        const amazonUrl = AFFILIATE_LINKS.amazon.baseUrl + encodeURIComponent(product.affiliateLinks.amazon);
        html += `<a href="${amazonUrl}" class="btn btn-amazon" target="_blank" rel="nofollow">${AFFILIATE_LINKS.amazon.buttonText}</a>`;
      }
      if (product.affiliateLinks.padelNuestro) {
        const padelUrl = AFFILIATE_LINKS.padelNuestro.baseUrl + encodeURIComponent(product.affiliateLinks.padelNuestro);
        html += `<a href="${padelUrl}" class="btn btn-padel-nuestro" target="_blank" rel="nofollow">${AFFILIATE_LINKS.padelNuestro.buttonText}</a>`;
      }
    }

    // Ratings
    if (product.ratings) {
      html += '<div class="ratings">';
      const ratingLabels = {
        power: 'Power',
        control: 'Control',
        rebound: 'Rebound',
        maneuverability: 'Maneuverability',
        sweetSpot: 'Sweet Spot'
      };
      
      Object.entries(product.ratings).forEach(([key, value]) => {
        if (key === 'overall' || !ratingLabels[key] || typeof value !== 'number') {
          return;
        }
        const label = ratingLabels[key];
        const clampedValue = Math.max(0, Math.min(10, value));
        html += `
          <div class="rating-item">
            <span class="rating-label">${label}</span>
            <div class="rating-bar">
              <div class="rating-bar-fill" style="width: ${(clampedValue / 10) * 100}%"></div>
            </div>
            <span class="rating-value">${clampedValue.toFixed(1)}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    // Separator between ratings and specs
    if (product.ratings && product.specs) {
      html += '<div class="sidebar-separator"></div>';
    }

    // Specifications
    if (product.specs) {
      html += '<table class="specs-table">';
      const specLabels = {
        shape: 'Shape',
        weight: 'Weight',
        balance: 'Balance',
        touch: 'Touch',
        frame: 'Frame',
        faces: 'Faces',
        core: 'Core',
        level: 'Level'
      };
      
      Object.entries(product.specs).forEach(([key, value]) => {
        if (!value) return;
        const label = specLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
        html += `
          <tr>
            <th>${label}</th>
            <td>${value}</td>
          </tr>
        `;
      });
      html += '</table>';
    }

    // Verdict
    if (product.verdict) {
      html += `
        <div class="verdict-box">
          <div class="verdict-title">Summary</div>
          <div class="verdict-text">${product.verdict}</div>
        </div>
      `;
    }

    // Alternatives
    if (product.alternatives && product.alternatives.length > 0) {
      html += '<div class="alternatives">';
      html += '<div class="alternatives-title">Similar Rackets:</div>';
      product.alternatives.forEach(alt => {
        html += `<a href="${alt.url}" class="alternative-link">${alt.name}</a>`;
      });
      html += '</div>';
    }

    sidebar.innerHTML = html;
  } catch (error) {
    console.error('Error rendering product sidebar:', error);
  }
}

/**
 * Render hero section
 */
function renderHero(title, subtitle, image, verdict) {
  const heroSection = document.getElementById('hero-section');
  if (!heroSection) return;

  let html = '<div class="hero-content">';
  
  if (title) {
    html += `<h1 class="hero-title">${title}</h1>`;
  }
  
  if (subtitle) {
    html += `<p class="hero-subtitle">${subtitle}</p>`;
  }
  
  if (verdict) {
    html += `<div class="hero-verdict">${verdict}</div>`;
  }
  
  html += '</div>';
  
  heroSection.innerHTML = html;
}

/**
 * Render promotional sidebar for guide pages
 * Shows latest reviews and top padel racket
 */
async function renderPromotionalSidebar() {
  try {
    if (typeof ensureProductsReady === 'function') {
      await ensureProductsReady();
    }

    const sidebar = document.getElementById('promotional-sidebar');
    if (!sidebar || !PRODUCTS) return;

    let html = '';

    // Get all products and sort by rating to find top racket
    const allProducts = Object.values(PRODUCTS);
    if (allProducts.length === 0) {
      sidebar.innerHTML = html;
      return;
    }

    const sortedByRating = [...allProducts].sort((a, b) => {
      const ratingA = a.ratings?.overall || 0;
      const ratingB = b.ratings?.overall || 0;
      return ratingB - ratingA;
    });

    // Top Padel Racket Section
    if (sortedByRating.length > 0) {
      const topRacket = sortedByRating[0];
      const topRating = Math.round(topRacket.ratings?.overall || 0);
      const reviewUrl = `/articles/reviews/${topRacket.id}-review.html`;

      html += `
        <div class="promotional-sidebar-card">
          <h3 class="promotional-sidebar-title">Top Padel Racket</h3>
          <a href="${reviewUrl}" class="promotional-racket-link">
            <div class="promotional-racket-image-wrapper">
              <div class="promotional-racket-rating">${topRating}</div>
              <img src="${topRacket.image}" alt="${topRacket.name}" class="promotional-racket-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
            </div>
            <div class="promotional-racket-info">
              <p class="promotional-racket-brand">${topRacket.brand} / ${topRacket.year}</p>
              <h4 class="promotional-racket-name">${topRacket.name}</h4>
              <p class="promotional-racket-player">${topRacket.playerName || 'Professional Player'}</p>
              <div class="promotional-racket-price">${topRacket.price || ''}</div>
            </div>
          </a>
        </div>
      `;
    }

    // Latest Reviews Section
    const latestReviews = allProducts.slice(0, 5);
    if (latestReviews.length > 0) {
      html += `
        <div class="promotional-sidebar-card">
          <h3 class="promotional-sidebar-title">Latest Reviews</h3>
          <div class="promotional-reviews-list">
      `;

      latestReviews.forEach(product => {
        const rating = Math.round(product.ratings?.overall || 0);
        const reviewUrl = `/articles/reviews/${product.id}-review.html`;

        html += `
          <a href="${reviewUrl}" class="promotional-review-item">
            <div class="promotional-review-rating">${rating}</div>
            <img src="${product.image}" alt="${product.name}" class="promotional-review-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
            <div class="promotional-review-info">
              <p class="promotional-review-brand">${product.brand} / ${product.year}</p>
              <h4 class="promotional-review-name">${product.name}</h4>
            </div>
          </a>
        `;
      });

      html += `
          </div>
          <a href="/articles/reviews/" class="promotional-sidebar-link">View All Reviews →</a>
        </div>
      `;
    }

    sidebar.innerHTML = html;
  } catch (error) {
    console.error('Error rendering promotional sidebar:', error);
  }
}

/**
 * Initialize all templates
 */
async function initTemplates() {
  // Load header
  const headerTemplate = await loadTemplate('/templates/header.html');
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (headerPlaceholder) {
    headerPlaceholder.innerHTML = headerTemplate;
    renderNavigation();
  }

  // Load footer
  const footerTemplate = await loadTemplate('/templates/footer.html');
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    footerPlaceholder.innerHTML = footerTemplate;
    renderFooterNavigation();
  }

  // Load sidebar (if placeholder exists)
  const sidebarTemplate = await loadTemplate('/templates/sidebar.html');
  const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
  if (sidebarPlaceholder) {
    sidebarPlaceholder.innerHTML = sidebarTemplate;
  }
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
  window.renderProductSidebar = renderProductSidebar;
  window.renderHero = renderHero;
  window.renderPromotionalSidebar = renderPromotionalSidebar;
  window.initTemplates = initTemplates;
}

