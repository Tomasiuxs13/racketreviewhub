// Site Configuration
const SITE_CONFIG = {
  name: "Padel Racket Review Hub",
  description: "Expert reviews, comparisons, and buying guides for padel rackets",
  url: "https://yourdomain.com",
  author: "Padel Racket Review Hub"
};

// Admin Configuration
const ADMIN_CONFIG = {
  // List of administrator email addresses
  adminEmails: [
    'tomasnorkuss@gmail.com'
  ],
  
  // Check if an email is an admin
  isAdmin: function(email) {
    if (!email) return false;
    return this.adminEmails.some(adminEmail => 
      adminEmail.toLowerCase() === email.toLowerCase()
    );
  }
};

// Navigation Structure
const NAVIGATION = {
  main: [
    {
      label: "Best Rackets",
      url: "/articles/reviews/",
      hasDropdown: true,
      items: [
        { label: "Head Delta Pro", url: "/articles/reviews/head-delta-pro-review.html" },
        { label: "Adidas Metalbone CTRL 3.3", url: "/articles/reviews/adidas-metalbone-ctrl-3.3-review.html" },
        { label: "Nox AT10 Genius Arena", url: "/articles/reviews/nox-at10-genius-arena-review.html" },
        { label: "Bullpadel Hack 03", url: "/articles/reviews/bullpadel-hack-03-review.html" },
        { label: "Siux Diablo Revolution", url: "/articles/reviews/siux-diablo-revolution-review.html" }
      ]
    },
    {
      label: "Brands",
      url: "/articles/brands/",
      hasDropdown: true,
      items: [
        { label: "Bullpadel", url: "/articles/best-lists/best-padel-rackets-bullpadel.html" },
        { label: "Head", url: "/articles/best-lists/best-padel-rackets-head.html" },
        { label: "Adidas", url: "/articles/best-lists/best-padel-rackets-adidas.html" },
        { label: "Nox", url: "/articles/best-lists/best-padel-rackets-nox.html" },
        { label: "Siux", url: "/articles/best-lists/best-padel-rackets-siux.html" },
        { label: "Wilson", url: "/articles/best-lists/best-padel-rackets-wilson.html" }
      ]
    },
    {
      label: "Guides",
      url: "/articles/guides/",
      hasDropdown: true,
      items: [
        { label: "Buying Guide", url: "/articles/guides/buying-guide-beginners.html" },
        { label: "Shapes Explained", url: "/articles/guides/shapes-explained.html" },
        { label: "Materials & Technology", url: "/articles/guides/materials-technology.html" },
        { label: "Padel Techniques", url: "/articles/guides/padel-techniques.html" }
      ]
    },
    {
      label: "Blog",
      url: "/blog/",
      hasDropdown: false
    }
  ],
  footer: [
    { label: "About", url: "/about.html" },
    { label: "Contact", url: "/contact.html" },
    { label: "Privacy Policy", url: "/privacy.html" },
    { label: "Terms of Use", url: "/terms.html" },
    { label: "Affiliate Disclosure", url: "/affiliate-disclosure.html" }
  ]
};

// Affiliate Link Configuration
const AFFILIATE_LINKS = {
  amazon: {
    baseUrl: "https://www.amazon.com/s?k=",
    buttonClass: "btn-amazon",
    buttonText: "View on Amazon",
    color: "#FF9900"
  },
  padelNuestro: {
    baseUrl: "https://padelnuestro.com/search?q=",
    buttonClass: "btn-padel-nuestro",
    buttonText: "View on Padel Nuestro",
    color: "#0066CC"
  },
  compare: {
    baseUrl: "#",
    buttonClass: "btn-compare",
    buttonText: "Compare Prices",
    color: "#333333"
  }
};

const PRODUCT_DATA_PATH = "/data/merged-products.json";
let PRODUCTS = {};
const isBrowser = typeof window !== 'undefined';

function createProductStore() {
  let cache = {};
  let loadPromise = null;

  async function loadProducts() {
    if (!isBrowser) {
      return cache;
    }

    if (loadPromise) {
      return loadPromise;
    }

    const dataUrl = window.PRODUCTS_DATA_URL || PRODUCT_DATA_PATH;

    // Use default cache behavior - browser will cache the response
    // This significantly reduces egress usage by allowing cached responses
    loadPromise = fetch(dataUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load product data (${response.status})`);
        }
        return response.json();
      })
      .then(json => {
        cache = json || {};
        PRODUCTS = cache;
        window.PRODUCTS = cache;

        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('productsLoaded', {
            detail: { total: Object.keys(cache).length }
          }));
        }

        return cache;
      })
      .catch(error => {
        console.error('[ProductStore] Unable to load product data:', error);
        cache = {};
        PRODUCTS = {};
        window.PRODUCTS = {};
        return cache;
      });

    return loadPromise;
  }

  function getAll() {
    return cache;
  }

  function getById(id) {
    return cache[id];
  }

  return { load: loadProducts, getAll, getById };
}

if (isBrowser) {
  const store = createProductStore();
  window.ProductStore = store;
  window.PRODUCTS = PRODUCTS;
  window.PRODUCTS_READY = store.load();

  window.ensureProductsReady = async function ensureProductsReady() {
    if (window.ProductStore && typeof window.ProductStore.load === 'function') {
      try {
        await window.ProductStore.load();
      } catch (error) {
        console.error('[ProductStore] Failed to ensure product data is loaded:', error);
      }
    }
    return window.PRODUCTS || {};
  };
} else {
  try {
    PRODUCTS = require('../data/merged-products.json');
  } catch (error) {
    PRODUCTS = {};
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SITE_CONFIG, NAVIGATION, AFFILIATE_LINKS, PRODUCTS, ADMIN_CONFIG };
}

// Make admin config available globally in browser
if (isBrowser) {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
}
