// Main JavaScript functionality

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize templates
  if (typeof initTemplates === 'function') {
    await initTemplates();
  }

  // Ensure product catalog is available before rendering UI that depends on it
  if (typeof ensureProductsReady === 'function') {
    await ensureProductsReady();
  }

  // Mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navList = document.getElementById('main-nav');
  
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', function() {
      navList.classList.toggle('active');
      const isActive = navList.classList.contains('active');
      menuToggle.textContent = isActive ? '✕' : '☰';
      menuToggle.setAttribute('aria-expanded', isActive);
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.nav') && navList.classList.contains('active')) {
        navList.classList.remove('active');
        menuToggle.textContent = '☰';
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close menu when clicking a link
    navList.addEventListener('click', function(event) {
      if (event.target.tagName === 'A') {
        navList.classList.remove('active');
        menuToggle.textContent = '☰';
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // Initialize rating bars animation on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const ratingBar = entry.target.querySelector('.rating-bar-fill');
        if (ratingBar) {
          const width = ratingBar.style.width;
          ratingBar.style.width = '0';
          setTimeout(() => {
            ratingBar.style.width = width;
          }, 100);
        }
      }
    });
  }, observerOptions);

  // Observe all rating bars
  document.querySelectorAll('.rating-item').forEach(item => {
    observer.observe(item);
  });

  // Handle product sidebar data attribute
  const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
  if (sidebarPlaceholder) {
    const productId = sidebarPlaceholder.getAttribute('data-product-id');
    if (productId && typeof renderProductSidebar === 'function') {
      // Wait a bit for templates to load
      setTimeout(() => {
        renderProductSidebar(productId);
      }, 100);
    }
  }

  // Handle hero section data attributes
  const heroPlaceholder = document.getElementById('hero-placeholder');
  if (heroPlaceholder && typeof renderHero === 'function') {
    const title = heroPlaceholder.getAttribute('data-title');
    const subtitle = heroPlaceholder.getAttribute('data-subtitle');
    const image = heroPlaceholder.getAttribute('data-image');
    const verdict = heroPlaceholder.getAttribute('data-verdict');
    
    if (title || subtitle || image || verdict) {
      setTimeout(() => {
        renderHero(title, subtitle, image, verdict);
      }, 100);
    }
  }

  // Render latest reviews on homepage
  renderLatestReviews();

  // Render buyers guide cards on homepage
  renderBuyersGuideCards();

  // Render guide cards on guides page
  renderGuidesPageCards();

  // Render guide cards on blog page
  renderBlogPageCards();

  // Render promotional sidebar for guide pages
  if (typeof renderPromotionalSidebar === 'function') {
    const promotionalSidebar = document.getElementById('promotional-sidebar');
    if (promotionalSidebar) {
      renderPromotionalSidebar();
    }
  }

  // Initialize search functionality
  initSearch();

  // Initialize cookie consent system
  if (typeof CookieConsent !== 'undefined') {
    CookieConsent.init();
    
    // Handle close banner button
    const closeBannerBtn = document.getElementById('cookie-close-banner');
    if (closeBannerBtn) {
      closeBannerBtn.addEventListener('click', function() {
        CookieConsent.rejectAll(); // Reject all optional cookies when closing
      });
    }
    
    // Handle cancel preferences button
    const cancelPrefsBtn = document.getElementById('cookie-cancel-preferences');
    if (cancelPrefsBtn) {
      cancelPrefsBtn.addEventListener('click', function() {
        CookieConsent.hidePreferences();
      });
    }
    
    // Listen for consent updates to load scripts conditionally
    document.addEventListener('cookieConsentUpdated', function(e) {
      console.log('Cookie consent updated:', e.detail);
      // You can add logic here to conditionally load scripts based on consent
    });
    
    // Example: Check consent before loading analytics
    if (CookieConsent.hasConsent('analytics')) {
      // Load analytics scripts here
      console.log('Analytics consent granted - loading analytics scripts');
    }
    
    // Handle reset cookie consent links (using event delegation for dynamically loaded footer)
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href*="reset-cookie-consent"]');
      if (link) {
        e.preventDefault();
        CookieConsent.resetConsent();
      }
    });
    
    // Handle manage cookie preferences links (using event delegation for dynamically loaded footer)
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href*="cookie-preferences"]');
      if (link) {
        e.preventDefault();
        CookieConsent.showPreferences();
      }
    });
  }
});

/**
 * Render latest reviews grid on homepage
 */
function renderLatestReviews() {
  const reviewsGrid = document.getElementById('latest-reviews');
  if (!reviewsGrid || !PRODUCTS) return;

  // Get first 8 products for display
  const productIds = Object.keys(PRODUCTS || {}).slice(0, 8);
  if (productIds.length === 0) {
    reviewsGrid.innerHTML = '';
    return;
  }
  
  let html = '';
  productIds.forEach(productId => {
    const product = PRODUCTS[productId];
    const overallRating = typeof product.ratings?.overall === 'number' ? product.ratings.overall : 0;
    const rating = Math.round(overallRating);
    const playerName = product.playerName || 'Professional Player';
    
    html += `
      <article class="review-card">
        <div class="review-rating">${rating}</div>
        <img src="${product.image}" alt="${product.name}" class="review-card-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
        <div class="review-card-info">
          <p class="review-card-brand">${product.brand} / ${product.year}</p>
          <h3 class="review-card-title">${product.name}</h3>
          <p class="review-card-player">${playerName}</p>
        </div>
        <a href="/articles/reviews/${productId}-review.html" class="review-card-link"></a>
      </article>
    `;
  });

  reviewsGrid.innerHTML = html;
}

/**
 * Initialize search functionality
 */
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchResults) return;

  let searchTimeout;

  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim().toLowerCase();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Hide results if query is empty
    if (query.length === 0) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('active');
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      performSearch(query, searchResults);
    }, 200);
  });

  // Hide results when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-container')) {
      searchResults.classList.remove('active');
    }
  });

  // Handle Enter key to navigate to first result
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstResult = searchResults.querySelector('.search-result-item');
      if (firstResult) {
        const link = firstResult.querySelector('a');
        if (link) {
          window.location.href = link.href;
        }
      }
    }
  });
}

/**
 * Perform search and display results
 */
function performSearch(query, resultsContainer) {
  if (!PRODUCTS || typeof PRODUCTS !== 'object') {
    resultsContainer.innerHTML = '<div class="search-no-results">No products available</div>';
    resultsContainer.classList.add('active');
    return;
  }

  const results = [];
  const queryLower = query.toLowerCase();

  // Search through products
  Object.keys(PRODUCTS).forEach(productId => {
    const product = PRODUCTS[productId];
    let score = 0;
    let matchedFields = [];

    // Check name
    if (product.name && product.name.toLowerCase().includes(queryLower)) {
      score += 10;
      matchedFields.push('name');
    }

    // Check brand
    if (product.brand && product.brand.toLowerCase().includes(queryLower)) {
      score += 8;
      matchedFields.push('brand');
    }

    // Check player name
    if (product.playerName && product.playerName.toLowerCase().includes(queryLower)) {
      score += 5;
      matchedFields.push('player');
    }

    // Check specs
    if (product.specs) {
      Object.values(product.specs).forEach(spec => {
        if (spec && spec.toString().toLowerCase().includes(queryLower)) {
          score += 3;
        }
      });
    }

    // If there's a match, add to results
    if (score > 0) {
      results.push({
        product: product,
        score: score,
        matchedFields: matchedFields
      });
    }
  });

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  // Display results
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results">No rackets found</div>';
  } else {
    let html = '';
    const maxResults = 5;
    const displayResults = results.slice(0, maxResults);
    
    displayResults.forEach(result => {
      const product = result.product;
      const reviewUrl = `/articles/reviews/${product.id}-review.html`;
      
      html += `
        <div class="search-result-item">
          <a href="${reviewUrl}" class="search-result-link">
            <div class="search-result-image">
              <img src="${product.image}" alt="${product.name}" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
            </div>
            <div class="search-result-info">
              <div class="search-result-name">${product.name}</div>
              <div class="search-result-brand">${product.brand} • ${product.year}</div>
              ${product.ratings && product.ratings.overall ? `<div class="search-result-rating">Rating: ${product.ratings.overall}/10</div>` : ''}
            </div>
          </a>
        </div>
      `;
    });

    if (results.length > maxResults) {
      html += `<div class="search-result-more"><a href="/articles/reviews/?q=${encodeURIComponent(query)}">View all ${results.length} results →</a></div>`;
    }

    resultsContainer.innerHTML = html;
  }

  resultsContainer.classList.add('active');
}

/**
 * Render buyers guide cards on homepage
 */
function renderBuyersGuideCards() {
  const guideCards = document.getElementById('buyers-guide-cards');
  if (!guideCards) return;

  const guides = [
    {
      category: "Best RACKETS INTERMEDIATE",
      title: "Best Padel Rackets for Intermediate Players [2024]",
      description: "Discover the perfect rackets for players looking to take their game to the next level.",
      image: "/images/placeholders/rackets-court.jpg",
      url: "/articles/best-lists/best-for-intermediates.html"
    },
    {
      category: "How to CHOOSE PADEL SHOES",
      title: "How To Choose Padel Shoes: Expert Tips for Optimal Performance",
      description: "Find the right footwear to enhance your performance on the padel court.",
      image: "/images/placeholders/padel-shoes.jpg",
      url: "/articles/guides/choose-padel-shoes.html"
    },
    {
      category: "How to CHOOSE A PADEL RACKET",
      title: "How To Choose A Padel Racket: Tips For The Perfect Selection",
      description: "Complete guide to selecting the perfect padel racket for your playing style.",
      image: "/images/placeholders/rackets-balls.jpg",
      url: "/articles/guides/buying-guide-beginners.html"
    },
    {
      category: "Best RACKETS",
      title: "The 5 Best Padel Rackets of 2024",
      description: "Our top picks for the best padel rackets tested and reviewed by experts.",
      image: "/images/placeholders/multiple-rackets.jpg",
      url: "/articles/best-lists/best-padel-rackets-2025.html"
    }
  ];

  let html = '';
  guides.forEach(guide => {
    html += `
      <article class="guide-card">
        <div class="guide-card-category">${guide.category}</div>
        <img src="${guide.image}" alt="${guide.title}" class="guide-card-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
        <div class="guide-card-content">
          <h3 class="guide-card-title">${guide.title}</h3>
          <p class="guide-card-description">${guide.description}</p>
        </div>
        <a href="${guide.url}" class="guide-card-link"></a>
      </article>
    `;
  });

  guideCards.innerHTML = html;
}

/**
 * Render guide cards on guides page
 */
function renderGuidesPageCards() {
  const guideCards = document.getElementById('guides-page-cards');
  if (!guideCards) return;

  const guides = [
    {
      category: "How to CHOOSE A PADEL RACKET",
      title: "How To Choose A Padel Racket: Tips For The Perfect Selection",
      description: "Complete guide to selecting the perfect padel racket for your playing style. Learn about shapes, weights, balance, materials, and how to match a racket to your skill level.",
      image: "/images/placeholders/rackets-balls.jpg",
      url: "/articles/guides/buying-guide-beginners.html"
    },
    {
      category: "How to CHOOSE PADEL SHOES",
      title: "How To Choose Padel Shoes: Expert Tips for Optimal Performance",
      description: "Find the right footwear to enhance your performance on the padel court. Learn about grip, cushioning, durability, and fit.",
      image: "/images/placeholders/padel-shoes.jpg",
      url: "/articles/guides/choose-padel-shoes.html"
    },
    {
      category: "PADEL RACKET SHAPES",
      title: "Padel Racket Shapes Explained: Round, Teardrop & Diamond",
      description: "Understand the differences between round, teardrop, and diamond-shaped rackets. Learn which shape suits your playing style best.",
      image: "/images/placeholders/rackets-court.jpg",
      url: "/articles/guides/shapes-explained.html"
    },
    {
      category: "MATERIALS & TECHNOLOGY",
      title: "Padel Racket Materials & Technology Guide",
      description: "Discover the latest materials and technologies used in modern padel rackets. From carbon fiber to EVA cores, understand what makes a great racket.",
      image: "/images/placeholders/multiple-rackets.jpg",
      url: "/articles/guides/materials-technology.html"
    },
    {
      category: "PADEL TECHNIQUES",
      title: "Padel Techniques & Strategies Guide",
      description: "Master essential padel techniques and strategies. From smashes to lobs, learn how to improve your game with expert tips.",
      image: "/images/placeholders/padel-player.jpg",
      url: "/articles/guides/padel-techniques.html"
    },
    {
      category: "Best RACKETS INTERMEDIATE",
      title: "Best Padel Rackets for Intermediate Players [2024]",
      description: "Discover the perfect rackets for players looking to take their game to the next level. Expert recommendations for intermediate players.",
      image: "/images/placeholders/rackets-court.jpg",
      url: "/articles/best-lists/best-for-intermediates.html"
    },
    {
      category: "Best RACKETS",
      title: "The 5 Best Padel Rackets of 2024",
      description: "Our top picks for the best padel rackets tested and reviewed by experts. Find the perfect racket for your game.",
      image: "/images/placeholders/multiple-rackets.jpg",
      url: "/articles/best-lists/best-padel-rackets-2025.html"
    }
  ];

  let html = '';
  guides.forEach(guide => {
    html += `
      <article class="guide-card">
        <div class="guide-card-category">${guide.category}</div>
        <img src="${guide.image}" alt="${guide.title}" class="guide-card-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
        <div class="guide-card-content">
          <h3 class="guide-card-title">${guide.title}</h3>
          <p class="guide-card-description">${guide.description}</p>
        </div>
        <a href="${guide.url}" class="guide-card-link"></a>
      </article>
    `;
  });

  guideCards.innerHTML = html;
}

/**
 * Render guide cards on blog page
 */
function renderBlogPageCards() {
  const guideCards = document.getElementById('blog-page-cards');
  if (!guideCards) return;

  const guides = [
    {
      category: "How to CHOOSE A PADEL RACKET",
      title: "How To Choose A Padel Racket: Tips For The Perfect Selection",
      description: "Complete guide to selecting the perfect padel racket for your playing style. Learn about shapes, weights, balance, materials, and how to match a racket to your skill level.",
      image: "/images/placeholders/rackets-balls.jpg",
      url: "/articles/guides/buying-guide-beginners.html"
    },
    {
      category: "Best RACKETS",
      title: "The 5 Best Padel Rackets of 2024",
      description: "Our top picks for the best padel rackets tested and reviewed by experts. Find the perfect racket for your game.",
      image: "/images/placeholders/multiple-rackets.jpg",
      url: "/articles/best-lists/best-padel-rackets-2025.html"
    },
    {
      category: "Best RACKETS INTERMEDIATE",
      title: "Best Padel Rackets for Intermediate Players [2024]",
      description: "Discover the perfect rackets for players looking to take their game to the next level. Expert recommendations for intermediate players.",
      image: "/images/placeholders/rackets-court.jpg",
      url: "/articles/best-lists/best-for-intermediates.html"
    },
    {
      category: "How to CHOOSE PADEL SHOES",
      title: "How To Choose Padel Shoes: Expert Tips for Optimal Performance",
      description: "Find the right footwear to enhance your performance on the padel court. Learn about grip, cushioning, durability, and fit.",
      image: "/images/placeholders/padel-shoes.jpg",
      url: "/articles/guides/choose-padel-shoes.html"
    },
    {
      category: "PADEL RACKET SHAPES",
      title: "Padel Racket Shapes Explained: Round, Teardrop & Diamond",
      description: "Understand the differences between round, teardrop, and diamond-shaped rackets. Learn which shape suits your playing style best.",
      image: "/images/placeholders/rackets-court.jpg",
      url: "/articles/guides/shapes-explained.html"
    },
    {
      category: "MATERIALS & TECHNOLOGY",
      title: "Padel Racket Materials & Technology Guide",
      description: "Discover the latest materials and technologies used in modern padel rackets. From carbon fiber to EVA cores, understand what makes a great racket.",
      image: "/images/placeholders/multiple-rackets.jpg",
      url: "/articles/guides/materials-technology.html"
    },
    {
      category: "PADEL TECHNIQUES",
      title: "Padel Techniques & Strategies Guide",
      description: "Master essential padel techniques and strategies. From smashes to lobs, learn how to improve your game with expert tips.",
      image: "/images/placeholders/padel-player.jpg",
      url: "/articles/guides/padel-techniques.html"
    }
  ];

  let html = '';
  guides.forEach(guide => {
    html += `
      <article class="guide-card">
        <div class="guide-card-category">${guide.category}</div>
        <img src="${guide.image}" alt="${guide.title}" class="guide-card-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
        <div class="guide-card-content">
          <h3 class="guide-card-title">${guide.title}</h3>
          <p class="guide-card-description">${guide.description}</p>
        </div>
        <a href="${guide.url}" class="guide-card-link"></a>
      </article>
    `;
  });

  guideCards.innerHTML = html;
}

// Utility function to get product data
function getProductData(productId) {
  if (typeof PRODUCTS !== 'undefined' && PRODUCTS[productId]) {
    return PRODUCTS[productId];
  }
  return null;
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.getProductData = getProductData;
}

