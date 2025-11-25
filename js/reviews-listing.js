// Reviews Listing Page Functionality

document.addEventListener('DOMContentLoaded', async function() {
  if (typeof ensureProductsReady === 'function') {
    await ensureProductsReady();
  }

  if (!PRODUCTS || Object.keys(PRODUCTS).length === 0) {
    const grid = document.getElementById('reviews-grid');
    if (grid) {
      grid.innerHTML = '<p class="reviews-empty-state">Product data is not available right now. Please try again later.</p>';
    }
    return;
  }

  let allProducts = Object.values(PRODUCTS);
  let filteredProducts = [...allProducts];
  let currentSort = 'rating-desc';

  // Initialize filters
  initFilters();
  
  // Apply brand filter from URL parameter (returns true if filter was applied)
  const brandFilterApplied = applyBrandFromURL();
  
  // Apply initial sort and render (only if brand filter wasn't already applied)
  if (!brandFilterApplied) {
    applySort();
  }

  // Filter toggle
  const filterToggle = document.getElementById('filter-toggle');
  const filtersPanel = document.getElementById('filters-panel');
  
  if (filterToggle && filtersPanel) {
    filterToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      filtersPanel.classList.toggle('active');
      const icon = filterToggle.querySelector('.filter-toggle-icon');
      if (icon) {
        icon.textContent = filtersPanel.classList.contains('active') ? '▲' : '▼';
      }
    });

    // Close filters panel when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.filters-left') && filtersPanel.classList.contains('active')) {
        filtersPanel.classList.remove('active');
        const icon = filterToggle.querySelector('.filter-toggle-icon');
        if (icon) {
          icon.textContent = '▼';
        }
      }
    });
  }

  // Filter checkboxes
  const filterCheckboxes = document.querySelectorAll('.filter-checkbox');
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      applyFilters();
    });
  });

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      currentSort = this.value;
      applySort();
    });
  }

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
      filterCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      applyFilters();
    });
  }

  /**
   * Initialize filters with brand options
   */
  function initFilters() {
    const brandFiltersContainer = document.getElementById('brand-filters');
    if (!brandFiltersContainer) return;

    // Get unique brands
    const brands = [...new Set(allProducts.map(p => p.brand))].sort();
    
    brands.forEach(brand => {
      const label = document.createElement('label');
      label.className = 'filter-option';
      label.innerHTML = `
        <input type="checkbox" name="brand" value="${brand.toLowerCase()}" class="filter-checkbox">
        <span>${brand}</span>
      `;
      brandFiltersContainer.appendChild(label);
    });

    // Add event listeners to new checkboxes
    const newCheckboxes = brandFiltersContainer.querySelectorAll('.filter-checkbox');
    newCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        applyFilters();
      });
    });
  }

  /**
   * Apply brand filter from URL parameter
   * @returns {boolean} True if a brand filter was applied, false otherwise
   */
  function applyBrandFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const brandParam = urlParams.get('brand');
    
    if (brandParam) {
      const brandValue = brandParam.toLowerCase();
      const brandCheckbox = document.querySelector(`input[name="brand"][value="${brandValue}"]`);
      
      if (brandCheckbox) {
        brandCheckbox.checked = true;
        applyFilters();
        
        // Open filters panel to show the active filter
        const filtersPanel = document.getElementById('filters-panel');
        if (filtersPanel) {
          filtersPanel.classList.add('active');
          const filterToggle = document.getElementById('filter-toggle');
          if (filterToggle) {
            const icon = filterToggle.querySelector('.filter-toggle-icon');
            if (icon) {
              icon.textContent = '▲';
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Apply filters to products
   */
  function applyFilters() {
    const selectedShapes = Array.from(document.querySelectorAll('input[name="shape"]:checked')).map(cb => cb.value);
    const selectedRatings = Array.from(document.querySelectorAll('input[name="rating"]:checked')).map(cb => parseFloat(cb.value));
    const selectedBrands = Array.from(document.querySelectorAll('input[name="brand"]:checked')).map(cb => cb.value);
    const selectedLevels = Array.from(document.querySelectorAll('input[name="level"]:checked')).map(cb => cb.value);

    filteredProducts = allProducts.filter(product => {
      // Shape filter
      if (selectedShapes.length > 0) {
        const productShape = (product.specs?.shape || '').toLowerCase();
        if (!selectedShapes.some(shape => productShape.includes(shape))) {
          return false;
        }
      }

      // Rating filter
      if (selectedRatings.length > 0) {
        const productRating = product.ratings?.overall || 0;
        if (!selectedRatings.some(minRating => productRating >= minRating)) {
          return false;
        }
      }

      // Brand filter
      if (selectedBrands.length > 0) {
        const productBrand = (product.brand || '').toLowerCase();
        if (!selectedBrands.includes(productBrand)) {
          return false;
        }
      }

      // Level filter
      if (selectedLevels.length > 0) {
        const productLevel = (product.specs?.level || '').toLowerCase();
        if (!selectedLevels.some(level => productLevel.includes(level))) {
          return false;
        }
      }

      return true;
    });

    applySort();
  }

  /**
   * Apply sorting to filtered products
   */
  function applySort() {
    const sorted = [...filteredProducts];

    switch (currentSort) {
      case 'rating-desc':
        sorted.sort((a, b) => (b.ratings?.overall || 0) - (a.ratings?.overall || 0));
        break;
      case 'rating-asc':
        sorted.sort((a, b) => (a.ratings?.overall || 0) - (b.ratings?.overall || 0));
        break;
      case 'name-asc':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name-desc':
        sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'price-desc':
        sorted.sort((a, b) => {
          const priceA = parseFloat((a.price || '0').replace(/[^\d.]/g, '')) || 0;
          const priceB = parseFloat((b.price || '0').replace(/[^\d.]/g, '')) || 0;
          return priceB - priceA;
        });
        break;
      case 'price-asc':
        sorted.sort((a, b) => {
          const priceA = parseFloat((a.price || '0').replace(/[^\d.]/g, '')) || 0;
          const priceB = parseFloat((b.price || '0').replace(/[^\d.]/g, '')) || 0;
          return priceA - priceB;
        });
        break;
      case 'power-desc':
        sorted.sort((a, b) => (b.ratings?.power || 0) - (a.ratings?.power || 0));
        break;
      case 'control-desc':
        sorted.sort((a, b) => (b.ratings?.control || 0) - (a.ratings?.control || 0));
        break;
      default:
        sorted.sort((a, b) => (b.ratings?.overall || 0) - (a.ratings?.overall || 0));
    }

    renderProducts(sorted);
  }

  /**
   * Render products grid
   */
  function renderProducts(products) {
    const grid = document.getElementById('reviews-grid');
    const noResults = document.getElementById('no-results');
    const resultsCount = document.getElementById('results-count');

    if (!grid) return;

    // Update results count
    if (resultsCount) {
      resultsCount.textContent = products.length;
    }

    // Show/hide no results message
    if (noResults) {
      noResults.style.display = products.length === 0 ? 'block' : 'none';
    }

    if (products.length === 0) {
      grid.innerHTML = '';
      return;
    }

    let html = '';
    products.forEach(product => {
      const rating = Math.round(product.ratings?.overall || 0);
      const playerName = product.playerName || 'Professional Player';
      const reviewUrl = `/articles/reviews/${product.id}-review.html`;
      
      // Format price
      const price = product.price || 'N/A';
      const priceDisplay = price !== 'N/A' ? price : '';

      html += `
        <article class="review-listing-card">
          <a href="${reviewUrl}" class="review-listing-link">
            <div class="review-listing-rating">${rating}</div>
            <img src="${product.image}" alt="${product.name}" class="review-listing-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
            <div class="review-listing-info">
              <p class="review-listing-brand">${product.brand} / ${product.year}</p>
              <h3 class="review-listing-title">${product.name}</h3>
              <p class="review-listing-player">${playerName}</p>
              
              <div class="review-listing-metrics">
                <div class="review-metric">
                  <span class="metric-label">PWR</span>
                  <span class="metric-value">${Math.round(product.ratings?.power || 0)}</span>
                </div>
                <div class="review-metric">
                  <span class="metric-label">CTL</span>
                  <span class="metric-value">${Math.round(product.ratings?.control || 0)}</span>
                </div>
                <div class="review-metric">
                  <span class="metric-label">RBD</span>
                  <span class="metric-value">${Math.round(product.ratings?.rebound || 0)}</span>
                </div>
                <div class="review-metric">
                  <span class="metric-label">MAN</span>
                  <span class="metric-value">${Math.round(product.ratings?.maneuverability || 0)}</span>
                </div>
                <div class="review-metric">
                  <span class="metric-label">SS</span>
                  <span class="metric-value">${Math.round(product.ratings?.sweetSpot || 0)}</span>
                </div>
              </div>

              ${priceDisplay ? `<div class="review-listing-price">${priceDisplay}</div>` : ''}
            </div>
          </a>
        </article>
      `;
    });

    grid.innerHTML = html;
  }
});

