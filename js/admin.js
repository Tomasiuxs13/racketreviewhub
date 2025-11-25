/**
 * Admin Panel Authentication and Management
 * Uses Supabase for authentication
 */

// Initialize Supabase client
let supabase = null;

// Initialize Supabase
function initSupabase() {
  // Get Supabase credentials from environment or config
  const supabaseUrl = window.SUPABASE_URL || (typeof process !== 'undefined' && process.env?.SUPABASE_URL);
  const supabaseAnonKey = window.SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
    return null;
  }

  // Check if Supabase library is loaded
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded. Make sure the Supabase CDN script is included.');
    return null;
  }

  if (!supabase) {
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabase;
}

// Check if user is admin
function isAdminUser(user) {
  if (!user) {
    console.log('[Admin Check] No user object provided');
    return false;
  }
  
  // Get email from user object (could be user.email or user.user_metadata.email)
  const userEmail = user.email || user.user_metadata?.email || user.user_metadata?.full_name || '';
  
  if (!userEmail) {
    console.log('[Admin Check] No email found in user object:', user);
    return false;
  }
  
  console.log('[Admin Check] Checking email:', userEmail);
  
  // Check against admin config (try both window.ADMIN_CONFIG and ADMIN_CONFIG)
  const adminConfig = window.ADMIN_CONFIG || (typeof ADMIN_CONFIG !== 'undefined' ? ADMIN_CONFIG : null);
  
  if (adminConfig && adminConfig.isAdmin) {
    const isAdmin = adminConfig.isAdmin(userEmail);
    console.log('[Admin Check] ADMIN_CONFIG check result:', isAdmin, 'for email:', userEmail);
    if (isAdmin) return true;
  } else {
    console.log('[Admin Check] ADMIN_CONFIG not available, using fallback');
  }
  
  // Fallback: check if email matches admin list (always check this as backup)
  const adminEmails = ['tomasnorkuss@gmail.com'];
  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const isAdminFallback = adminEmails.some(email => 
    email.toLowerCase().trim() === normalizedUserEmail
  );
  console.log('[Admin Check] Fallback check:', {
    userEmail: userEmail,
    normalizedUserEmail: normalizedUserEmail,
    adminEmails: adminEmails,
    isAdmin: isAdminFallback
  });
  return isAdminFallback;
}

// Check authentication status
async function checkAuth() {
  const client = initSupabase();
  if (!client) {
    showError('Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
    return;
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error) {
      console.error('Auth error:', error);
      showLogin();
      return;
    }

    if (session && session.user) {
      // User is authenticated, check if admin
      console.log('[Auth Check] User authenticated:', session.user.email || session.user.user_metadata?.email);
      console.log('[Auth Check] Full user object:', session.user);
      if (isAdminUser(session.user)) {
        console.log('[Auth Check] User is admin, showing admin panel');
        showAdminPanel(session.user);
      } else {
        console.log('[Auth Check] User is not admin, showing access restricted');
        showAccessRestricted();
      }
    } else {
      console.log('[Auth Check] No session, showing login');
      showLogin();
    }
  } catch (error) {
    console.error('Error checking auth:', error);
    showLogin();
  }
}

// Show login form
function showLogin() {
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('access-restricted').style.display = 'none';
  document.getElementById('admin-content').style.display = 'none';
}

// Show access restricted message
function showAccessRestricted() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('access-restricted').style.display = 'block';
  document.getElementById('admin-content').style.display = 'none';
}

// Show admin panel
function showAdminPanel(user) {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('access-restricted').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
  
  // Load admin stats
  loadAdminStats();
}

// Handle login
async function handleLogin(email, password) {
  const client = initSupabase();
  if (!client) {
    showLoginError('Supabase not configured.');
    return;
  }

  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      showLoginError(error.message);
      return;
    }

    if (data.user) {
      // Check if user is admin
      console.log('[Login] User logged in:', data.user.email || data.user.user_metadata?.email);
      console.log('[Login] Full user object:', data.user);
      if (isAdminUser(data.user)) {
        console.log('[Login] User is admin, showing admin panel');
        showAdminPanel(data.user);
      } else {
        console.log('[Login] User is not admin, showing access restricted');
        showAccessRestricted();
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError('An error occurred during login. Please try again.');
  }
}

// Handle logout
async function handleLogout() {
  const client = initSupabase();
  if (!client) return;

  try {
    await client.auth.signOut();
    showLogin();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Show login error
function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

// Load admin statistics
async function loadAdminStats() {
  const statsContainer = document.getElementById('admin-stats');
  
  // Load product stats if available
  if (typeof ensureProductsReady === 'function') {
    try {
      await ensureProductsReady();
      const products = window.PRODUCTS || {};
      const productCount = Object.keys(products).length;
      
      statsContainer.innerHTML = `
        <div class="stat-card">
          <h3>${productCount}</h3>
          <p>Total Products</p>
        </div>
        <div class="stat-card">
          <h3>${new Date().toLocaleDateString()}</h3>
          <p>Last Updated</p>
        </div>
      `;
    } catch (error) {
      console.error('Error loading stats:', error);
      statsContainer.innerHTML = '<p>Unable to load statistics.</p>';
    }
  } else {
    statsContainer.innerHTML = '<p>Statistics not available.</p>';
  }
}

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit to ensure config.js is loaded
  setTimeout(() => {
    // Verify ADMIN_CONFIG is available
    const adminConfig = window.ADMIN_CONFIG || (typeof ADMIN_CONFIG !== 'undefined' ? ADMIN_CONFIG : null);
    if (!adminConfig) {
      console.warn('[Admin] ADMIN_CONFIG not found, using fallback admin list');
    } else {
      console.log('[Admin] ADMIN_CONFIG loaded:', adminConfig.adminEmails);
    }
    
    // Initialize templates
    if (typeof initTemplates === 'function') {
      initTemplates();
    }

    // Check authentication status
    checkAuth();
  }, 100);

  // Listen for auth state changes
  const client = initSupabase();
  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        showLogin();
      } else if (event === 'SIGNED_IN' && session) {
        if (isAdminUser(session.user)) {
          showAdminPanel(session.user);
        } else {
          showAccessRestricted();
        }
      }
    });
  }

  // Handle login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      handleLogin(email, password);
    });
  }

  // Handle logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

