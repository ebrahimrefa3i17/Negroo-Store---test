// public/js/auth.js

/**
 * Parses a JWT token to extract its payload.
 * @param {string} token - The JWT token string.
 * @returns {object|null} The decoded payload object or null if parsing fails.
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        // Replace URL-safe characters with standard base64 characters
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Decode base64 and then decode URI components
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error parsing JWT token:", e); // Log error for debugging
        return null;
    }
}

// Global state variables for authentication
window.isAuthenticated = false;
window.currentAuthToken = null;
window.currentUser = null;

/**
 * Checks if the user is currently logged in by validating the JWT token in localStorage.
 * Updates global authentication state variables.
 * @returns {boolean} True if the user is authenticated and the token is valid, false otherwise.
 */
window.isLoggedIn = () => {
    const token = localStorage.getItem('token');
    if (token) {
        const decodedToken = parseJwt(token);
        // Check if token is decoded and not expired
        if (decodedToken && (decodedToken.exp * 1000 > Date.now())) {
            window.isAuthenticated = true;
            window.currentAuthToken = token;
            // ✅ MODIFIED: window.currentUser should be read from localStorage 'user' key
            // This ensures it contains the full user object (including shippingAddress)
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                window.currentUser = JSON.parse(storedUser);
            } else {
                // If 'user' is not in localStorage but token is valid, try to fetch it
                // This scenario is handled by updateNavbar in main.js
                window.currentUser = decodedToken; // Fallback to decoded token info
            }
            return true;
        }
    }
    // If no token, invalid token, or expired token, clear local storage and reset state
    window.isAuthenticated = false;
    window.currentAuthToken = null;
    window.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Also remove stored user data
    return false;
};

/**
 * Retrieves the current authenticated user's data.
 * @returns {object|null} The current user object or null if not logged in.
 */
window.getCurrentUser = () => {
    window.isLoggedIn(); // Ensure authentication state is up-to-date
    return window.currentUser;
};

/**
 * Logs out the current user by clearing local storage and resetting authentication state.
 * Redirects to the homepage or updates the navbar based on the current page.
 */
window.logoutUser = async () => {
    // إرسال طلب إلى الواجهة الخلفية لإلغاء صلاحية التوكن إذا كان هناك آلية لذلك
    try {
        await fetch('http://localhost:3000/api/auth/logout', { // افترض وجود مسار logout في الباك إند
            method: 'POST',
            headers: window.getAuthHeaders()
        });
    } catch (error) {
        console.error('Error during backend logout:', error);
        // لا تمنع تسجيل الخروج من الواجهة الأمامية حتى لو فشل طلب الباك إند
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('guestId'); // إزالة معرف الضيف عند تسجيل الخروج الكامل

    // تحديث شريط التنقل بعد تسجيل الخروج
    if (window.updateNavbar) {
        await window.updateNavbar();
    }
    // تحديث عدد عناصر السلة
    if (window.updateCartCount) {
        await window.updateCartCount();
    }
    // إظهار رسالة نجاح
    if (window.showToast) {
        window.showToast('You have been logged out successfully!', 'info');
    }

    // إعادة التوجيه إلى صفحة تسجيل الدخول أو الرئيسية
    setTimeout(() => {
        window.location.href = 'login.html'; // أو 'index.html'
    }, 500);
};

/**
 * Generates authentication headers for API requests.
 * @returns {object} An object containing 'Content-Type' and 'Authorization' headers.
 */
window.getAuthHeaders = () => {
    window.isLoggedIn(); // Ensure authentication state is up-to-date
    return {
        'Content-Type': 'application/json',
        'Authorization': window.currentAuthToken ? `Bearer ${window.currentAuthToken}` : undefined,
        'X-Guest-ID': localStorage.getItem('guestId') || undefined // أضف معرف الضيف
    };
};

/**
 * A wrapper around the native `fetch` API that automatically includes authentication headers.
 * Handles unauthorized or forbidden responses by logging out the user.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options object (e.g., method, body, headers).
 * @returns {Promise<Response>} The fetch Response object.
 * @throws {Error} If the response status is 401 or 403, or if a network error occurs.
 */
window.fetchWithAuth = async (url, options = {}) => {
    window.isLoggedIn(); // Check authentication status and update current token
    const token = window.currentAuthToken; // Use the updated token

    if (token) {
        // Merge existing headers with Authorization header
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    try {
        const response = await fetch(url, options);
        // Handle unauthorized or forbidden access
        if (response.status === 401 || response.status === 403) {
            console.error('Unauthorized or forbidden access. Token might be invalid or missing.');
            if (window.showToast) {
                window.showToast('Session expired or unauthorized. Please log in again.', 'danger');
            }
            window.logoutUser(); // Log out the user
            throw new Error('Unauthorized or Forbidden'); // Throw an error to stop further processing
        }
        return response;
    } catch (error) {
        console.error('Error in fetchWithAuth:', error);
        throw error; // Re-throw the error to be handled by the calling functions
    }
};


window.isLoggedIn(); // Initial call to set up window.currentAuthToken

// --- UI-related functions (kept as per user's request) ---

// Note: These functions were originally in auth.js and are kept here based on user's explicit request
// to retain the full original file structure. However, for optimal separation of concerns,
// UI update logic is typically better placed in a dedicated UI script like main.js.

window.updateCartCount = async () => {
    const cartItemCountSpan = document.getElementById('cart-item-count');
    if (!cartItemCountSpan) return;

    if (!window.isLoggedIn()) {
        if (typeof window.loadCart === 'function') {
            await window.loadCart();
        } else {
            console.warn('window.loadCart is not defined. Cannot accurately load guest cart.');
        }

        if (typeof window.getCartItemCount === 'function') {
            cartItemCountSpan.textContent = window.getCartItemCount();
        } else {
            cartItemCountSpan.textContent = '0';
        }
        if (typeof window.getCartItems === 'function' && typeof window.updateMiniCart === 'function') {
            window.updateMiniCart({ items: window.getCartItems() });
        } else {
            window.updateMiniCart(null);
        }
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/cart', {
            headers: window.getAuthHeaders()
        });
        if (response.ok) {
            const cart = await response.json();
            const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            cartItemCountSpan.textContent = totalItems;
            if (typeof window.updateMiniCart === 'function') { // Ensure updateMiniCart is available
                window.updateMiniCart(cart);
            }
        } else {
            console.error('Failed to fetch cart for count:', response.status);
            cartItemCountSpan.textContent = '0';
            if (typeof window.updateMiniCart === 'function') {
                window.updateMiniCart(null);
            }
        }
    } catch (error) {
        console.error('Error fetching cart count:', error);
        cartItemCountSpan.textContent = '0';
        if (typeof window.updateMiniCart === 'function') {
            window.updateMiniCart(null);
        }
    }
};

window.updateNotificationCount = async () => {
    const notificationCountSpan = document.getElementById('notification-count');
    if (!notificationCountSpan) return;

    if (!window.isLoggedIn()) {
        notificationCountSpan.textContent = '0';
        notificationCountSpan.style.display = 'none';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/notifications?read=false', {
            headers: window.getAuthHeaders()
        });

        if (response.ok) {
            const notifications = await response.json();
            const unreadCount = notifications.length;
            notificationCountSpan.textContent = unreadCount;
            notificationCountSpan.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        } else {
            console.error('Failed to fetch notification count:', response.status);
            notificationCountSpan.textContent = '0';
            notificationCountSpan.style.display = 'none';
        }
    }
     catch (error) {
        console.error('Error fetching notification count:', error);
        notificationCountSpan.textContent = '0';
        notificationCountSpan.style.display = 'none';
    }
};

// This is the primary updateNavbar function that will now manage the header UI
window.updateNavbar = async () => {
    // Desktop elements
    const desktopUserIcons = document.getElementById('desktop-user-icons');
    const desktopAuthIcons = document.getElementById('desktop-auth-icons');
    const navProfileIcon = document.getElementById('nav-profile-icon');
    const navWishlistIcon = document.getElementById('nav-wishlist-icon');
    const navMyOrdersIcon = document.getElementById('nav-myorders-icon');
    const navNotificationsIcon = document.getElementById('nav-notifications-icon');
    const adminDashboardIcon = document.getElementById('admin-dashboard-icon');
    const logoutIconButton = document.getElementById('logout-icon-button'); // Desktop logout icon button
    const navLoginIcon = document.getElementById('nav-login-icon');
    const navRegisterIcon = document.getElementById('nav-register-icon');

    // Mobile menu elements (these are still text links in the mobile menu)
    const mobileNavProfileLink = document.getElementById('mobile-nav-profile-link');
    const mobileNavWishlistLink = document.getElementById('mobile-nav-wishlist-link');
    const mobileNavMyOrdersLink = document.getElementById('mobile-nav-myorders-link');
    const mobileNavNotificationsLink = document.getElementById('mobile-nav-notifications-link');
    const mobileAdminDashboardLink = document.getElementById('mobile-admin-dashboard-link');
    const mobileNavLoginLink = document.getElementById('mobile-nav-login-link');
    const mobileNavRegisterLink = document.getElementById('mobile-nav-register-link');
    const mobileNavLogoutLink = document.getElementById('mobile-nav-logout-link'); // Mobile logout link


    if (window.isLoggedIn()) {
        try {
            let userFetched = null;
            // Fetch user profile to get the most up-to-date isAdmin status
            const response = await fetch('http://localhost:3000/api/users/profile', {
                headers: window.getAuthHeaders()
            });

            if (response.ok) {
                userFetched = await response.json();
                localStorage.setItem('user', JSON.stringify(userFetched)); // Update local storage user data
            } else {
                console.error('Failed to fetch current user data from profile API. Logging out.', await response.json());
                window.logoutUser(); // Log out if user data cannot be fetched
                return;
            }

            // Desktop Icons: Show user-specific icons, hide auth icons
            if (desktopUserIcons) desktopUserIcons.classList.remove('hidden');
            if (desktopAuthIcons) desktopAuthIcons.classList.add('hidden');

            if (navProfileIcon) navProfileIcon.classList.remove('hidden');
            if (navWishlistIcon) navWishlistIcon.classList.remove('hidden');
            if (navNotificationsIcon) navNotificationsIcon.classList.remove('hidden');
            if (navMyOrdersIcon) navMyOrdersIcon.classList.remove('hidden');
            if (logoutIconButton) logoutIconButton.classList.remove('hidden');


            // Show admin dashboard icon only for admins
            if (adminDashboardIcon) {
                if (userFetched && userFetched.isAdmin) {
                    adminDashboardIcon.classList.remove('hidden');
                } else {
                    adminDashboardIcon.classList.add('hidden');
                }
            }

            // Mobile menu links: Show user-specific links, hide auth links
            if (mobileNavLoginLink) mobileNavLoginLink.classList.add('hidden');
            if (mobileNavRegisterLink) mobileNavRegisterLink.classList.add('hidden');
            if (mobileNavProfileLink) mobileNavProfileLink.classList.remove('hidden');
            if (mobileNavWishlistLink) mobileNavWishlistLink.classList.remove('hidden');
            if (mobileNavMyOrdersLink) mobileNavMyOrdersLink.classList.remove('hidden');
            if (mobileNavNotificationsLink) mobileNavNotificationsLink.classList.remove('hidden');
            if (mobileNavLogoutLink) mobileNavLogoutLink.classList.remove('hidden'); // Mobile logout link should be visible when logged in

            if (mobileAdminDashboardLink) {
                if (userFetched && userFetched.isAdmin) {
                    mobileAdminDashboardLink.classList.remove('hidden');
                } else {
                    mobileAdminDashboardLink.classList.add('hidden');
                }
            }

            // Update cart and notification counts using functions from cart.js and notifications.js
            window.updateCartCount();
            window.updateNotificationCount();

        } catch (error) {
            console.error('Error fetching current user for navbar update. Logging out.', error);
            window.logoutUser(); // Log out if there's an error fetching user data
        }
    } else {
        // User is not logged in, show login/register icons/links and hide user-specific ones
        if (desktopUserIcons) desktopUserIcons.classList.add('hidden');
        if (desktopAuthIcons) desktopAuthIcons.classList.remove('hidden');

        if (navLoginIcon) navLoginIcon.classList.remove('hidden');
        if (navRegisterIcon) navRegisterIcon.classList.remove('hidden');

        // Hide all user-specific icons
        if (navProfileIcon) navProfileIcon.classList.add('hidden');
        if (navWishlistIcon) navWishlistIcon.classList.add('hidden');
        if (navNotificationsIcon) navNotificationsIcon.classList.add('hidden');
        if (adminDashboardIcon) adminDashboardIcon.classList.add('hidden');
        if (logoutIconButton) logoutIconButton.classList.add('hidden');
        if (navMyOrdersIcon) navMyOrdersIcon.classList.add('hidden');


        // Mobile menu links
        if (mobileNavLoginLink) mobileNavLoginLink.classList.remove('hidden');
        if (mobileNavRegisterLink) mobileNavRegisterLink.classList.remove('hidden');
        if (mobileNavProfileLink) mobileNavProfileLink.classList.add('hidden');
        if (mobileNavWishlistLink) mobileNavWishlistLink.classList.add('hidden');
        if (mobileNavMyOrdersLink) mobileNavMyOrdersLink.classList.add('hidden');
        if (mobileNavNotificationsLink) mobileNavNotificationsLink.classList.add('hidden');
        if (mobileAdminDashboardLink) mobileAdminDashboardLink.classList.add('hidden');
        if (mobileNavLogoutLink) mobileNavLogoutLink.classList.add('hidden'); // Mobile logout link should be hidden when logged out


        // Reset cart and notification counts
        if (document.getElementById('cart-item-count')) document.getElementById('cart-item-count').textContent = '0';
        if (typeof window.updateMiniCart === 'function') { // Ensure updateMiniCart is available
            window.updateMiniCart(null);
        }
        if (document.getElementById('notification-count')) document.getElementById('notification-count').textContent = '0';
        if (document.getElementById('notification-count')) document.getElementById('notification-count').style.display = 'none';
        if (document.getElementById('mobile-notification-count')) document.getElementById('mobile-notification-count').textContent = '0';
    }

    // Attach logout event listener to the desktop logout button
    const logoutDesktopButton = document.getElementById('logout-icon-button');
    if (logoutDesktopButton) {
        logoutDesktopButton.removeEventListener('click', window.logoutUser); // Remove existing to prevent duplicates
        logoutDesktopButton.addEventListener('click', window.logoutUser);
    }
    // Attach logout event listener to the mobile logout button
    const mobileLogoutButton = document.getElementById('mobile-logout-button');
    if (mobileLogoutButton) {
        mobileLogoutButton.removeEventListener('click', window.logoutUser); // Remove existing to prevent duplicates
        mobileLogoutButton.addEventListener('click', window.logoutUser);
    }

    // Populate categories dropdown in desktop nav (and potentially filter on products page)
    if (typeof window.populateCategoriesDropdown === 'function') {
        window.populateCategoriesDropdown();
    } else {
        console.warn('window.populateCategoriesDropdown is not defined. Categories dropdown might not populate.');
    }
};

window.populateCategoriesDropdown = async () => {
    const categoriesDropdown = document.getElementById('categories-dropdown');

    if (!categoriesDropdown) {
         console.log("Categories dropdown element not found. Skipping population.");
         return;
    }

    let categories = [];
    const cachedCategories = localStorage.getItem('categories_cache');
    if (cachedCategories) {
        const { data, timestamp } = JSON.parse(cachedCategories);
        const cacheDuration = 1000 * 60 * 60; // 1 hour in milliseconds
        if (Date.now() - timestamp < cacheDuration) {
            categories = data;
            console.log('Categories loaded from cache.');
        } else {
            console.log('Categories cache expired.');
        }
    }

    if (categories.length === 0) {
        try {
            const response = await fetch('http://localhost:3000/api/categories', {
                 headers: window.getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            categories = await response.json();
            localStorage.setItem('categories_cache', JSON.stringify({ data: categories, timestamp: Date.now() }));
            console.log('Categories fetched from API and cached.');

        } catch (error) {
            console.error('Error fetching categories for dropdown:', error);
            const listItem = document.createElement('li');
            listItem.innerHTML = '<a class="dropdown-item" href="#">Error loading categories</a>';
            categoriesDropdown.innerHTML = '';
            categoriesDropdown.appendChild(listItem);
            window.showToast(`Failed to load categories for dropdown: ${error.message}`, 'danger');

            const categoryFilterElement = document.getElementById('categoryFilter');
            if (categoryFilterElement) {
                categoryFilterElement.innerHTML = '<option value="All">Error loading categories</option>';
                categoryFilterElement.disabled = true;
            }
            return;
        }
    }

    categoriesDropdown.innerHTML = '';

    if (categories.length === 0) {
        const listItem = document.createElement('li');
        listItem.innerHTML = '<a class="dropdown-item" href="#">No Categories</a>';
        categoriesDropdown.appendChild(listItem);
        console.log('No categories found or loaded.');
    } else {
        categories.forEach(category => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<a class="dropdown-item" href="products.html?category=${encodeURIComponent(category.name)}">${category.name}</a>`;
            categoriesDropdown.appendChild(listItem);
        });
        console.log(`Successfully populated categories dropdown with ${categories.length} items.`);
    }

    const categoryFilterElement = document.getElementById('categoryFilter');
    if (categoryFilterElement) {
        categoryFilterElement.innerHTML = '<option value="All">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category._id; // Use category ID for value
            option.textContent = category.name;
            categoryFilterElement.appendChild(option);
        });
        const urlParams = new URLSearchParams(window.location.search);
        const categoryFromUrl = urlParams.get('category');
        if (categoryFromUrl) {
            categoryFilterElement.value = categoryFromUrl;
        }
    }
};

window.fetchAndDisplayCategories = async (limit = null) => {
    const featuredCategoriesContainer = document.getElementById('featured-categories-container');
    const allCategoriesContainer = document.getElementById('all-categories-container');

    const containerToUse = limit ? featuredCategoriesContainer : allCategoriesContainer;

    if (!containerToUse) {
        console.log("Categories container element not found. Skipping category display.");
        return;
    }

    containerToUse.innerHTML = `<div class="col-12 text-center text-muted">Loading ${limit ? 'featured ' : 'all '}categories...</div>`;

    const cachedCategories = localStorage.getItem('categories_cache');
    let categories = [];

    if (cachedCategories) {
        categories = JSON.parse(cachedCategories).data;
    }

    if (categories.length === 0) {
        try {
            const response = await fetch('http://localhost:3000/api/categories', {
                headers: window.getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            categories = await response.json();
            localStorage.setItem('categories_cache', JSON.stringify({ data: categories, timestamp: Date.now() }));
        } catch (error) {
            console.error('Error fetching categories:', error);
            containerToUse.innerHTML = `<div class="col-12 text-center text-danger">Failed to load categories: ${error.message}</div>`;
            window.showToast(`Failed to load categories: ${error.message}`, 'danger');
            return;
        }
    }

    if (limit) {
        categories = categories.slice(0, limit);
    }

    window.displayCategories(categories, containerToUse);
};

window.displayCategories = (categories, container) => {
    container.innerHTML = '';
    if (categories.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">No categories available yet.</div>';
        return;
    }

    categories.forEach(category => {
        const categoryCard = document.createElement('div');
        // Removed Bootstrap grid classes to rely on Tailwind directly from index.html
        // categoryCard.classList.add('col-md-4', 'col-lg-4', 'mb-4'); // Original Bootstrap classes
        // categoryCard.classList.add('col-md-4', 'col-lg-3', 'mb-4'); // Original Bootstrap classes

        // Assuming container's parent already has a grid setup (e.g., in index.html)
        // No specific column classes added here, as they should be handled by the parent grid in HTML
        categoryCard.innerHTML = `
            <a href="products.html?category=${encodeURIComponent(category._id)}" class="block text-center group">
                <div class="w-32 h-32 md:w-40 md:h-40 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 transform group-hover:scale-105">
                    <img src="${category.imageUrl || `https://placehold.co/120x120/e0f2f2/004d4d?text=${encodeURIComponent(category.name)}`}" class="w-full h-full object-cover" alt="${category.name}">
                </div>
                <h3 class="text-lg md:text-xl font-semibold text-gray-800 group-hover:text-[#008080] transition-colors duration-300">${category.name}</h3>
            </a>
        `;
        container.appendChild(categoryCard);
    });
};

window.fetchProducts = async (filters = {}) => {
    const productsContainer = document.getElementById('products-container');
    // const searchInput = document.getElementById('searchInput'); // These are now handled by filters object
    // const priceRangeFilter = document.getElementById('priceRangeFilter');
    // const sortFilter = document.getElementById('sortFilter');

    if (!productsContainer) {
        return;
    }

    productsContainer.innerHTML = '<div class="col-12 text-center"><p class="text-muted">Loading products...</p></div>';
    try {
        let url = 'http://localhost:3000/api/products';
        const params = new URLSearchParams();

        // This logic is now handled by main.js's applyProductFilters and fetchProducts
        // if (!filters.fromApplyFiltersBtn) {
        //     const urlParams = new URLSearchParams(window.location.search);
        //     const categoryFromUrl = urlParams.get('category');
        //     if (categoryFromUrl) {
        //         filters.category = categoryFromUrl;
        //     }
        // }

        if (filters.search) {
            params.append('search', filters.search);
        }
        if (filters.category && filters.category !== 'All') {
            params.append('category', filters.category);
        }
        if (filters.minPrice) {
            params.append('minPrice', filters.minPrice);
        }
        if (filters.maxPrice) {
            params.append('maxPrice', filters.maxPrice);
        }
        if (filters.sort) {
            const sortBy = filters.sort.replace('Asc', '').replace('Desc', '');
            const sortOrder = filters.sort.includes('Desc') ? 'desc' : 'asc';
            params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);
        }
        if (filters.page) { // Add page parameter
            params.append('page', filters.page);
        }
        if (filters.variants && filters.variants.length > 0) { // Add variants parameter
            params.append('variants', JSON.stringify(filters.variants));
        }


        if (params.toString()) {
            url = `${url}?${params.toString()}`;
        }

        console.log("Fetching products from URL:", url);
        const response = await fetch(url, {
            headers: window.getAuthHeaders()
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); // Get full data including totalPages, currentPage
        window.displayProducts(data.products);

        // Render pagination if products-pagination element exists
        const productsPagination = document.getElementById('products-pagination');
        if (productsPagination) {
            // Assuming renderPagination function is available globally (e.g., in main.js)
            if (typeof window.renderPagination === 'function') {
                window.renderPagination(data.totalPages, data.currentPage);
            } else {
                console.warn('window.renderPagination is not defined. Pagination will not be rendered.');
            }
        }

    } catch (error) {
        console.error('Error fetching products for frontend:', error);
        productsContainer.innerHTML = `<div class="col-12 text-center"><p class="text-danger">Failed to load products: ${error.message}</p></div>`;
        window.showToast(`Failed to load products: ${error.message}`, 'danger');
    }
};

window.displayProducts = (products) => {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    productsContainer.innerHTML = '';
    if (products.length === 0) {
        productsContainer.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No products available.</p></div>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        // Removed Bootstrap grid classes to rely on Tailwind directly from index.html or products.html
        // productCard.classList.add('col-md-4', 'col-lg-4', 'mb-4'); // Original Bootstrap classes
        productCard.classList.add('w-full', 'sm:w-1/2', 'md:w-1/3', 'lg:w-1/4', 'xl:w-1/5', 'p-2'); // Tailwind responsive classes

        let variantDisplayHtml = '';
        if (product.variants && product.variants.length > 0) {
            const variantGroupNames = product.variants.map(group => group.name);
            if (variantGroupNames.length > 0) {
                variantDisplayHtml = `<p class="text-gray-600 text-sm mb-0"><small>Available in: ${variantGroupNames.join(', ')}</small></p>`;
            } else {
                variantDisplayHtml = `<p class="text-gray-600 text-sm mb-0"><small>Multiple Options Available</small></p>`;
            }
        }

        const imageUrl = product.imageUrl || 'https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';
        const description = product.description ? product.description.substring(0, 70) + '...' : 'No description.';
        const price = product.price ? product.price.toFixed(2) : '0.00';


        productCard.innerHTML = `
            <div class="product-card shadow-md">
                <div class="relative">
                    <img class="w-full h-64 object-cover" src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';">
                    <div class="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-black/70 to-transparent product-actions">
                        <div class="flex justify-between items-center w-full">
                            <span class="text-2xl font-bold text-white">$${price}</span>
                            <button class="bg-[#008080] text-white py-2 px-4 rounded-full hover:bg-[#006666] transition duration-300 text-sm add-to-cart-btn" data-product-id="${product._id}">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-5">
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">${product.name}</h3>
                    <p class="text-gray-600 text-sm mb-3">${description}</p>
                    ${variantDisplayHtml}
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-xl font-bold text-gray-900">$${price}</span>
                        <span class="text-sm text-gray-500 line-through">${(product.originalPrice || (parseFloat(price) * 1.2)).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
        productsContainer.appendChild(productCard);
    });

    productsContainer.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const productId = event.target.dataset.productId;
            if (typeof window.addToCart === 'function') {
                await window.addToCart(productId, 1, [], null); // Pass empty variants and null productDetails
            } else {
                console.error('window.addToCart is not defined. Cannot add to cart.');
                window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
            }
        });
    });
};


window.handleLoginFormSubmit = async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.showToast(data.message, 'success');
            window.updateNavbar(); // Call updateNavbar from this file

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            window.showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
        }
    }
     catch (error) {
        console.error('Login error:', error);
        window.showToast('An error occurred during login. Please try again.', 'danger');
    }
};

window.handleRegisterFormSubmit = async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.showToast(data.message, 'success');
            window.updateNavbar(); // Call updateNavbar from this file

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            window.showToast(data.message || 'Registration failed. Please try again.', 'danger');
        }
    } catch (error) {
        console.error('Registration error:', error);
        window.showToast('An error occurred during registration. Please try again.', 'danger');
    }
};
