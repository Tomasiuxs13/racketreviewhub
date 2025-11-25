/**
 * Cookie Consent Management System
 * GDPR-compliant cookie consent with category management
 */

const CookieConsent = {
  // Cookie categories
  categories: {
    necessary: {
      name: 'Necessary',
      description: 'Essential cookies required for the website to function properly. These cannot be disabled.',
      required: true,
      enabled: true
    },
    analytics: {
      name: 'Analytics',
      description: 'Help us understand how visitors interact with our website by collecting and reporting information anonymously.',
      required: false,
      enabled: false
    },
    marketing: {
      name: 'Marketing',
      description: 'Used to deliver personalized advertisements and track campaign performance.',
      required: false,
      enabled: false
    },
    functional: {
      name: 'Functional',
      description: 'Enable enhanced functionality and personalization, such as remembering your preferences.',
      required: false,
      enabled: false
    }
  },

  // Storage key
  storageKey: 'cookieConsent',

  /**
   * Initialize cookie consent system
   */
  init() {
    // Check if consent has been given
    const consent = this.getConsent();
    
    if (!consent) {
      // Show banner if no consent has been given
      this.showBanner();
    } else {
      // Apply saved consent preferences
      this.applyConsent(consent);
    }

    // Set up event listeners
    this.setupEventListeners();
  },

  /**
   * Show cookie consent banner
   */
  showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.add('active');
      banner.setAttribute('aria-hidden', 'false');
    }
  },

  /**
   * Hide cookie consent banner
   */
  hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.remove('active');
      banner.setAttribute('aria-hidden', 'true');
    }
  },

  /**
   * Show preferences modal
   */
  showPreferences() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      
      // Populate preferences based on current consent
      this.populatePreferences();
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Hide preferences modal
   */
  hidePreferences() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      
      // Restore body scroll
      document.body.style.overflow = '';
    }
  },

  /**
   * Populate preferences modal with current settings
   */
  populatePreferences() {
    const consent = this.getConsent() || {};
    
    Object.keys(this.categories).forEach(categoryKey => {
      const checkbox = document.getElementById(`cookie-${categoryKey}`);
      if (checkbox) {
        const category = this.categories[categoryKey];
        checkbox.checked = consent[categoryKey] !== undefined 
          ? consent[categoryKey] 
          : category.enabled;
        checkbox.disabled = category.required;
      }
    });
  },

  /**
   * Accept all cookies
   */
  acceptAll() {
    const consent = {};
    Object.keys(this.categories).forEach(key => {
      consent[key] = true;
    });
    
    this.saveConsent(consent);
    this.applyConsent(consent);
    this.hideBanner();
    
    // Trigger custom event
    this.triggerConsentEvent('acceptAll', consent);
  },

  /**
   * Reject all optional cookies
   */
  rejectAll() {
    const consent = {};
    Object.keys(this.categories).forEach(key => {
      const category = this.categories[key];
      consent[key] = category.required; // Only necessary cookies are enabled
    });
    
    this.saveConsent(consent);
    this.applyConsent(consent);
    this.hideBanner();
    
    // Trigger custom event
    this.triggerConsentEvent('rejectAll', consent);
  },

  /**
   * Save preferences from modal
   */
  savePreferences() {
    const consent = {};
    
    Object.keys(this.categories).forEach(categoryKey => {
      const checkbox = document.getElementById(`cookie-${categoryKey}`);
      if (checkbox) {
        consent[categoryKey] = checkbox.checked;
      } else {
        // Fallback to default
        const category = this.categories[categoryKey];
        consent[categoryKey] = category.required ? true : false;
      }
    });
    
    this.saveConsent(consent);
    this.applyConsent(consent);
    this.hidePreferences();
    this.hideBanner();
    
    // Trigger custom event
    this.triggerConsentEvent('savePreferences', consent);
  },

  /**
   * Save consent to localStorage
   */
  saveConsent(consent) {
    const consentData = {
      consent: consent,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(consentData));
    } catch (e) {
      console.error('Failed to save cookie consent:', e);
    }
  },

  /**
   * Get consent from localStorage
   */
  getConsent() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        return data.consent;
      }
    } catch (e) {
      console.error('Failed to read cookie consent:', e);
    }
    return null;
  },

  /**
   * Apply consent preferences
   */
  applyConsent(consent) {
    if (!consent) return;
    
    // Apply each category
    Object.keys(consent).forEach(categoryKey => {
      if (consent[categoryKey]) {
        this.enableCategory(categoryKey);
      } else {
        this.disableCategory(categoryKey);
      }
    });
  },

  /**
   * Enable a cookie category
   */
  enableCategory(categoryKey) {
    // Trigger custom event for category enable
    const event = new CustomEvent('cookieCategoryEnabled', {
      detail: { category: categoryKey }
    });
    document.dispatchEvent(event);
    
    // You can add specific logic here to load scripts for each category
    switch (categoryKey) {
      case 'analytics':
        // Load analytics scripts (e.g., Google Analytics)
        this.loadAnalytics();
        break;
      case 'marketing':
        // Load marketing scripts (e.g., Facebook Pixel, Google Ads)
        this.loadMarketing();
        break;
      case 'functional':
        // Load functional scripts
        this.loadFunctional();
        break;
    }
  },

  /**
   * Disable a cookie category
   */
  disableCategory(categoryKey) {
    // Trigger custom event for category disable
    const event = new CustomEvent('cookieCategoryDisabled', {
      detail: { category: categoryKey }
    });
    document.dispatchEvent(event);
    
    // You can add specific logic here to unload scripts for each category
    // This is a placeholder - actual implementation depends on your scripts
  },

  /**
   * Check if a category is enabled
   */
  hasConsent(categoryKey) {
    const consent = this.getConsent();
    if (!consent) return false;
    
    // Necessary cookies are always enabled
    if (categoryKey === 'necessary') return true;
    
    return consent[categoryKey] === true;
  },

  /**
   * Load analytics scripts (placeholder - customize as needed)
   */
  loadAnalytics() {
    // Example: Load Google Analytics
    // if (typeof gtag === 'undefined') {
    //   // Load GA script
    // }
    
    // For now, just log that analytics should be loaded
    console.log('Analytics cookies enabled - load your analytics scripts here');
  },

  /**
   * Load marketing scripts (placeholder - customize as needed)
   */
  loadMarketing() {
    // Example: Load Facebook Pixel, Google Ads, etc.
    // For now, just log that marketing should be loaded
    console.log('Marketing cookies enabled - load your marketing scripts here');
  },

  /**
   * Load functional scripts (placeholder - customize as needed)
   */
  loadFunctional() {
    // Example: Load functional scripts
    // For now, just log that functional should be loaded
    console.log('Functional cookies enabled - load your functional scripts here');
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Accept all button
    const acceptAllBtn = document.getElementById('cookie-accept-all');
    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', () => this.acceptAll());
    }

    // Reject all button
    const rejectAllBtn = document.getElementById('cookie-reject-all');
    if (rejectAllBtn) {
      rejectAllBtn.addEventListener('click', () => this.rejectAll());
    }

    // Manage preferences button
    const manageBtn = document.getElementById('cookie-manage');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.showPreferences());
    }

    // Save preferences button
    const savePrefsBtn = document.getElementById('cookie-save-preferences');
    if (savePrefsBtn) {
      savePrefsBtn.addEventListener('click', () => this.savePreferences());
    }

    // Close modal button
    const closeModalBtn = document.getElementById('cookie-close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.hidePreferences());
    }

    // Close modal on backdrop click
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hidePreferences();
        }
      });
    }

    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('cookie-preferences-modal');
        if (modal && modal.classList.contains('active')) {
          this.hidePreferences();
        }
      }
    });
  },

  /**
   * Reset consent (clear stored preferences)
   */
  resetConsent() {
    try {
      localStorage.removeItem(this.storageKey);
      // Show banner again
      this.showBanner();
      // Disable all optional categories
      Object.keys(this.categories).forEach(key => {
        if (!this.categories[key].required) {
          this.disableCategory(key);
        }
      });
    } catch (e) {
      console.error('Failed to reset cookie consent:', e);
    }
  },

  /**
   * Trigger consent event
   */
  triggerConsentEvent(type, consent) {
    const event = new CustomEvent('cookieConsentUpdated', {
      detail: {
        type: type,
        consent: consent,
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(event);
  }
};

// Export for use in other files
if (typeof window !== 'undefined') {
  window.CookieConsent = CookieConsent;
}

