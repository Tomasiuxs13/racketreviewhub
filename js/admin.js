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
  if (!user || !user.email) return false;
  
  // Check against admin config
  if (typeof ADMIN_CONFIG !== 'undefined' && ADMIN_CONFIG.isAdmin) {
    return ADMIN_CONFIG.isAdmin(user.email);
  }
  
  // Fallback: check if email matches admin list
  const adminEmails = ['tomasnorkuss@gmail.com'];
  return adminEmails.some(email => 
    email.toLowerCase() === user.email.toLowerCase()
  );
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
      if (isAdminUser(session.user)) {
        showAdminPanel(session.user);
      } else {
        showAccessRestricted();
      }
    } else {
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
      if (isAdminUser(data.user)) {
        showAdminPanel(data.user);
      } else {
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
  // Initialize templates
  if (typeof initTemplates === 'function') {
    initTemplates();
  }

  // Check authentication status
  checkAuth();

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

