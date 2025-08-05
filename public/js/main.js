/* Define global functions first (if they are used across multiple files or need to be globally accessible) */

/* Define global functions first (if they are used across multiple files or need to be globally accessible) */

/**
 * Helper function to generate loading spinner HTML.
 * @param {string} message - The text message to display alongside the spinner.
 * @returns {string} HTML string for a spinner.
 * NOTE: This function is now primarily for dynamic loading states *after* initial page load,
 * or for sections that don't have a static initial spinner.
 */
function createLoadingSpinnerHtml(message = 'Loading...') {
    const iconPath = '/loading.png'; // تأكد أن هذا المسار صحيح لـ favicon.ico
    // إذا كنت تفضل شعار Negroo Store الأسود، فالمسار هو '/uploads/logos/Negeroo_logo.png'
    
    return `
        <div class="col-span-full flex flex-col justify-center items-center py-8">
            <img src="${iconPath}" alt="Loading Icon" class="loading-custom-icon mb-4">
            <p class="text-gray-500 text-lg">${message}</p>
        </div>
    `;
}

/**
 * Updates the cart item count displayed in the navbar and refreshes the mini-cart.
 * This function handles both logged-in users (fetching from API) and guests (loading from local storage).
 */
window.updateCartCount = async () => {
    const cartItemCountSpan = document.getElementById('cart-item-count');
    if (!cartItemCountSpan) return;

    if (typeof window.getCartItemCount === 'function') {
        if (window.isLoggedIn()) {
            try {
                // Fetch cart from backend for logged-in users
                const response = await fetch('http://localhost:3000/api/cart', {
                    headers: window.getAuthHeaders()
                });
                const data = await response.json();
                if (response.ok) {
                    window.cartItems = data.items; // Update global cart items
                    const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);
                    cartItemCountSpan.textContent = totalItems;
                    window.updateMiniCart(data); // Update the mini-cart sidebar
                } else {
                    console.error('Failed to fetch cart for count:', data.message);
                    cartItemCountSpan.textContent = '0';
                    window.updateMiniCart(null); // Clear mini-cart on failure
                }
            } catch (error) {
                console.error('Error fetching cart count:', error);
                cartItemCountSpan.textContent = '0';
                window.updateMiniCart(null); // Clear mini-cart on error
            }
        } else {
            // For guest users, load cart from local storage
            if (typeof window.loadCart === 'function') {
                await window.loadCart(); // Load cart data into window.cartItems
            }
            cartItemCountSpan.textContent = window.getCartItemCount();
            if (typeof window.getCartItems === 'function' && typeof window.updateMiniCart === 'function') {
                window.updateMiniCart({ items: window.getCartItems() });
            } else {
                window.updateMiniCart(null);
            }
        }
    } else {
        console.warn('window.getCartItemCount is not defined. Cart count might not update.');
    }
};

/**
 * Updates the visibility of navigation links (login, register, profile, admin, etc.)
 * based on the user's authentication and admin status.
 */
window.updateNavbar = async () => {
    // Desktop elements
    const desktopUserIcons = document.getElementById('desktop-user-icons');
    const desktopAuthIcons = document.getElementById('desktop-auth-icons');
    const navProfileIcon = document.getElementById('nav-profile-icon');
    const navWishlistIcon = document.getElementById('nav-wishlist-icon');
    const navMyOrdersIcon = document.getElementById('nav-myorders-icon');
    const navNotificationsIcon = document.getElementById('nav-notifications-icon');
    const adminDashboardIcon = document.getElementById('admin-dashboard-icon');
    const logoutIconButton = document.getElementById('logout-icon-button');
    const navLoginIcon = document.getElementById('nav-login-icon');
    const navRegisterIcon = document.getElementById('nav-register-icon');

    // Mobile menu elements
    const mobileNavProfileLink = document.getElementById('mobile-nav-profile-link');
    const mobileNavWishlistLink = document.getElementById('mobile-nav-wishlist-link');
    const mobileNavMyOrdersLink = document.getElementById('mobile-nav-myorders-link');
    const mobileNavNotificationsLink = document.getElementById('mobile-nav-notifications-link');
    const mobileAdminDashboardLink = document.getElementById('mobile-admin-dashboard-link');
    const mobileNavLoginLink = document.getElementById('mobile-nav-login-link');
    const mobileNavRegisterLink = document.getElementById('mobile-nav-register-link');
    const mobileNavLogoutLink = document.getElementById('mobile-nav-logout-link');


    if (window.isLoggedIn()) {
        try {
            let userFetched = null;
            // Fetch user profile to get the most up-to-date isAdmin status and shippingAddress
            const response = await fetch('http://localhost:3000/api/users/profile', {
                headers: window.getAuthHeaders()
            });

            if (response.ok) {
                userFetched = await response.json();
                // ✅ MODIFIED: Ensure user data in localStorage is always up-to-date with fetched profile
                // هذا السطر هو الأهم لضمان أن localStorage يحتوي على shippingAddress
                localStorage.setItem('user', JSON.stringify(userFetched)); 
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


            // Mobile menu links: Show user-specific links, hide auth links
            if (mobileNavLoginLink) mobileNavLoginLink.classList.add('hidden');
            if (mobileNavRegisterLink) mobileNavRegisterLink.classList.add('hidden');
            if (mobileNavProfileLink) mobileNavProfileLink.classList.remove('hidden');
            if (mobileNavWishlistLink) mobileNavWishlistLink.classList.remove('hidden');
            if (mobileNavMyOrdersLink) mobileNavMyOrdersLink.classList.remove('hidden');
            if (mobileNavNotificationsLink) mobileNavNotificationsLink.classList.remove('hidden');
            if (mobileNavLogoutLink) mobileNavLogoutLink.classList.remove('hidden');


            // Show admin dashboard link/icon only for admins
            if (adminDashboardIcon) {
                if (userFetched && userFetched.isAdmin) {
                    adminDashboardIcon.classList.remove('hidden');
                } else {
                    adminDashboardIcon.classList.add('hidden');
                }
            }
            if (mobileAdminDashboardLink) {
                if (userFetched && userFetched.isAdmin) {
                    mobileAdminDashboardLink.classList.remove('hidden');
                } else {
                    mobileAdminDashboardLink.classList.add('hidden');
                }
            }

            // Update cart and notification counts
            window.updateCartCount();
            window.updateNotificationCount();

        }catch (error) {
            console.error('Error fetching current user for navbar update. Logging out.', error);
            window.logoutUser(); // Log out if user data cannot be fetched
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
        if (mobileNavLogoutLink) mobileNavLogoutLink.classList.add('hidden');

        // Reset cart and notification counts
        if (document.getElementById('cart-item-count')) document.getElementById('cart-item-count').textContent = '0';
        if (window.updateMiniCart) window.updateMiniCart(null);
        if (document.getElementById('notification-count')) document.getElementById('notification-count').textContent = '0';
        if (document.getElementById('notification-count')) document.getElementById('notification-count').style.display = 'none';
        if (document.getElementById('mobile-notification-count')) document.getElementById('mobile-notification-count').textContent = '0';
    }

    // Attach logout event listener to the desktop logout button
    const logoutButtonFromNav = document.getElementById('logout-icon-button');
    if (logoutButtonFromNav) {
        logoutButtonFromNav.removeEventListener('click', window.logoutUser); // Remove existing to prevent duplicates
        logoutButtonFromNav.addEventListener('click', window.logoutUser);
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

/**
 * Fetches products based on filters and displays them.
 * @param {Object} filters - An object containing search, category, price range, sort, and page filters.
 * @param {string} containerId - The ID of the HTML element where products should be displayed.
 */
window.fetchProducts = async (filters = {}, containerId = 'products-container') => {
    const currentProductsContainer = document.getElementById(containerId);
    const initialLoadingSpinner = document.getElementById('initial-loading-spinner-container'); // Get the initial spinner

    if (!currentProductsContainer) {
        console.log(`Product container element #${containerId} not found. Skipping product fetch.`);
        return;
    }

    // Hide the products container initially and show the initial loading spinner
    currentProductsContainer.style.display = 'none';
    if (initialLoadingSpinner) {
        initialLoadingSpinner.innerHTML = createLoadingSpinnerHtml('Loading products...'); // Update with relevant message
        initialLoadingSpinner.style.display = 'flex'; // Ensure it's visible and centered
    } else {
        // Fallback if initial spinner not found in HTML (e.g., for dynamic content that might not have it)
        currentProductsContainer.innerHTML = createLoadingSpinnerHtml('Loading products...');
    }

    try {
        let url = new URL('http://localhost:3000/api/products');

        // Handle image search IDs if present in URL
        const urlParams = new URLSearchParams(window.location.search);
        const imageSearchIds = urlParams.get('imageSearchIds');
        if (imageSearchIds) {
            window.displayImageSearchResults(imageSearchIds);
            // Hide the initial spinner if image search takes over
            if (initialLoadingSpinner) initialLoadingSpinner.style.display = 'none';
            return;
        }

        const currentUrl = new URL(window.location.href);
        for (const key in filters) {
            if (key === 'targetContainerId') continue; // Skip internal filter

            if (filters[key] !== '' && filters[key] !== 'All' && filters[key] !== undefined && filters[key] !== null) {
                if (key === 'variants' && Array.isArray(filters[key])) {
                    url.searchParams.set(key, JSON.stringify(filters[key]));
                    currentUrl.searchParams.set(key, JSON.stringify(filters[key]));
                } else {
                    url.searchParams.set(key, filters[key]);
                    currentUrl.searchParams.set(key, filters[key]);
                }
            } else {
                url.searchParams.delete(key);
                currentUrl.searchParams.delete(key);
            }
        }
        // Update URL in browser history only if on products.html or index.html for main product display
        if (window.location.pathname.includes('products.html') || (window.location.pathname === '/' && containerId === 'products-container')) {
            window.history.replaceState({}, '', currentUrl.toString());
        }


        const response = await fetch(url.toString(), {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        const products = data.products;
        const totalPages = data.totalPages;
        const currentPage = data.currentPage;

        window.displayProducts(products, containerId); // Use the provided containerId
        window.populateVariantFilters(products);

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

    }catch (error) {
        console.error('Error fetching products for frontend:', error);
        currentProductsContainer.innerHTML = `<div class="col-12 text-center"><p class="text-danger">Failed to load products: ${error.message}</p></div>`;
        window.showToast(`Failed to load products: ${error.message}`, 'danger');
    } finally {
        // Hide the initial loading spinner and show the products container
        if (initialLoadingSpinner) initialLoadingSpinner.style.display = 'none';
        currentProductsContainer.style.display = 'grid'; // Or 'block' depending on its layout
    }
};

/**
 * Renders pagination controls for products.
 * @param {number} totalPages - Total number of pages.
 * @param {number} currentPage - Current active page.
*/
function renderPagination(totalPages, currentPage) {
    const productsPagination = document.getElementById('products-pagination');
    if (!productsPagination) return;
    productsPagination.innerHTML = '';

    if (totalPages <= 1) return;

    const createPaginationItem = (pageNumber, text, isActive = false, isDisabled = false) => {
        const li = document.createElement('li');
        li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = text;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isDisabled && !isActive) {
                window.applyProductFilters(pageNumber);
            }
        });
        li.appendChild(a);
        return li;
    };

    productsPagination.appendChild(createPaginationItem(currentPage - 1, 'Previous', false, currentPage === 1));

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (endPage - startPage < 4) {
        if (startPage === 1) endPage = Math.min(totalPages, 5);
        else if (endPage === totalPages) startPage = Math.max(1, totalPages - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        productsPagination.appendChild(createPaginationItem(i, i.toString(), i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            productsPagination.appendChild(createPaginationItem(null, '...', false, true));
        }
        productsPagination.appendChild(createPaginationItem(totalPages, totalPages.toString()));
    }

    productsPagination.appendChild(createPaginationItem(currentPage + 1, 'Next', false, currentPage === totalPages));
}

/**
 * Populates category dropdowns (navbar and filter).
 * @param {HTMLElement} targetDropdown - Optional: The specific dropdown element to populate (e.g., categoryFilter on products.html).
 */
window.populateCategoriesDropdown = async (targetDropdown = null) => {
    const categoriesDropdownNavbar = document.getElementById('categories-dropdown');

    if (!categoriesDropdownNavbar && !targetDropdown) {
        console.log("No category dropdown elements found. Skipping population.");
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

        }catch (error) {
            console.error('Error fetching categories for dropdown:', error);
            if (categoriesDropdownNavbar) {
                const listItem = document.createElement('li');
                listItem.innerHTML = '<a class="block px-4 py-2 text-gray-800 hover:bg-gray-100" href="#">Error loading categories</a>';
                categoriesDropdownNavbar.innerHTML = '';
                categoriesDropdownNavbar.appendChild(listItem);
            }
            if (targetDropdown) {
                targetDropdown.innerHTML = '<option value="All">Error loading categories</option>';
                targetDropdown.disabled = true;
            }
            window.showToast(`Failed to load categories for dropdown: ${error.message}`, 'danger');
            return;
        }
    }

    // Populate navbar dropdown
    if (categoriesDropdownNavbar) {
        categoriesDropdownNavbar.innerHTML = ''; // Clear existing items
        if (categories.length === 0) {
            const listItem = document.createElement('li');
            listItem.innerHTML = '<a class="block px-4 py-2 text-gray-800 hover:bg-gray-100" href="#">No Categories</a>';
            categoriesDropdownNavbar.appendChild(listItem);
        } else {
            categories.forEach(category => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<a class="block px-4 py-2 text-gray-800 hover:bg-gray-100" href="products.html?category=${encodeURIComponent(category._id)}">${category.name}</a>`;
                categoriesDropdownNavbar.appendChild(listItem);
            });
        }
        console.log(`Successfully populated categories navbar dropdown with ${categories.length} items.`);
    }

    // Populate filter dropdown (e.g., on products.html)
    if (targetDropdown) {
        targetDropdown.innerHTML = '<option value="All">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category._id; // Use category ID for value
            option.textContent = category.name;
            targetDropdown.appendChild(option);
        });
        const urlParams = new URLSearchParams(window.location.search);
        const categoryFromUrl = urlParams.get('category');
        if (categoryFromUrl) {
            targetDropdown.value = categoryFromUrl;
        }
    }
};

/**
 * Helper function to display categories in the circular format (for homepage).
 * @param {Array} categories - Array of category objects.
 * @param {HTMLElement} container - The HTML element to append category cards to.
 */
window.displayFeaturedCategories = (categories, container) => {
    if (!container) return;
    container.innerHTML = ''; // Clear loading message

    if (!Array.isArray(categories) || categories.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No featured categories available.</p></div>';
        return;
    }

    categories.forEach(category => {
        const imageUrl = category.imageUrl || `https://placehold.co/120x120/e0f2f2/004d4d?text=${encodeURIComponent(category.name)}`;
        const categoryCardHtml = `
            <a href="products.html?category=${encodeURIComponent(category._id)}" class="block text-center group">
                <div class="w-32 h-32 md:w-40 md:h-40 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 transform group-hover:scale-105">
                    <img src="${imageUrl}" alt="${category.name}" class="w-full h-full object-cover">
                </div>
                <h3 class="text-lg md:text-xl font-semibold text-gray-800 group-hover:text-[#008080] transition-colors duration-300">${category.name}</h3>
            </a>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.classList.add('p-2'); // Add padding for grid gap visuals
        tempDiv.innerHTML = categoryCardHtml;
        container.appendChild(tempDiv.firstElementChild);
    });
};

/**
 * Helper function to display categories as product-like cards (for all categories page).
 * @param {Array} categories - Array of category objects.
 * @param {HTMLElement} container - The HTML element to append category cards to.
 */
window.displayCategoriesAsDetailCards = (categories, container) => {
    if (!container) return;
    container.innerHTML = ''; // Clear loading message

    if (!Array.isArray(categories) || categories.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No categories available.</p></div>';
        return;
    }

    categories.forEach(category => {
        const categoryImageUrl = category.imageUrl || 'https://placehold.co/400x300/008080/ffffff?text=Category+Image';
        const categoryDescription = category.description || 'No description available for this category.';

        const categoryCardHtml = `
            <a href="products.html?category=${encodeURIComponent(category._id)}" class="block bg-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out overflow-hidden group product-card">
                <div class="relative h-48 w-full overflow-hidden">
                    <img src="${categoryImageUrl}" alt="${category.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';">
                    <div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span class="text-white text-xl font-bold">View Category</span>
                    </div>
                </div>
                <div class="p-4 flex flex-col items-center text-center">
                    <h3 class="text-xl font-semibold text-gray-800 mb-1">${category.name}</h3>
                    <p class="text-gray-600 text-sm mb-2 line-clamp-3">${categoryDescription}</p>
                    <button class="cta-button text-sm mt-4 py-2 px-4">View Category</button>
                </div>
            </a>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.classList.add('p-2'); // Add padding for grid gap visuals
        tempDiv.innerHTML = categoryCardHtml;
        container.appendChild(tempDiv.firstElementChild);
    });
};

/**
 * Fetches and displays categories in a specified container.
 * @param {number|null} limit - Optional limit for the number of categories to display.
 * @param {string} targetContainerId - The ID of the HTML element where categories should be displayed.
 * @param {boolean} featuredOnly - If true, fetches only featured categories.
 */
window.fetchAndDisplayCategories = async (limit = null, targetContainerId = 'featured-categories-container', featuredOnly = false) => {
    const containerToUse = document.getElementById(targetContainerId);
    const initialLoadingSpinner = document.getElementById('initial-loading-spinner-container');

    if (!containerToUse) {
        console.log(`Categories container element #${targetContainerId} not found. Skipping category display.`);
        return;
    }

    // Hide the categories container initially
    containerToUse.style.display = 'none';
    // If it's the main categories container, use the initial spinner
    if (targetContainerId === 'featured-categories-container' && initialLoadingSpinner) {
        initialLoadingSpinner.innerHTML = createLoadingSpinnerHtml(`Loading ${limit ? 'featured ' : 'all '}categories...`);
        initialLoadingSpinner.style.display = 'flex';
    } else {
        containerToUse.innerHTML = createLoadingSpinnerHtml(`Loading ${limit ? 'featured ' : 'all '}categories...`);
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

    // If not in cache or cache expired, fetch from API
    if (categories.length === 0 || featuredOnly) { // Re-fetch if featuredOnly is true (to ensure up-to-date status)
        try {
            let url = 'http://localhost:3000/api/categories';
            if (featuredOnly) {
                url += '?isFeatured=true'; // Request only featured categories from backend
            }
            const response = await fetch(url, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            categories = data; // This will be either all categories or only featured ones
            // Only cache all categories, not filtered ones, to avoid overwriting full cache with partial data
            if (!featuredOnly) {
                localStorage.setItem('categories_cache', JSON.stringify({ data: categories, timestamp: Date.now() }));
            }
        }catch (error) {
            console.error('Error fetching categories:', error);
            containerToUse.innerHTML = `<div class="col-span-full text-center"><p class="text-danger">Failed to load categories: ${error.message}</p></div>`;
            window.showToast(`Failed to load categories: ${error.message}`, 'danger');
            return;
        } finally {
            if (targetContainerId === 'featured-categories-container' && initialLoadingSpinner) {
                initialLoadingSpinner.style.display = 'none';
            }
            containerToUse.style.display = 'grid'; // Or 'block'
        }
    }

    if (limit && !featuredOnly) { // Apply limit only if not already filtered by backend for featured
        categories = categories.slice(0, limit);
    }

    // ✅ NEW LOGIC: Call different display function based on targetContainerId
    if (targetContainerId === 'featured-categories-container') {
        window.displayFeaturedCategories(categories, containerToUse);
    } else if (targetContainerId === 'all-categories-container') {
        window.displayCategoriesAsDetailCards(categories, containerToUse);
    } else {
        console.warn(`Unknown targetContainerId: ${targetContainerId}. Defaulting to featured display.`);
        window.displayFeaturedCategories(categories, containerToUse);
    }

    // Hide the initial loading spinner and show the container once content is loaded
    if (targetContainerId === 'featured-categories-container' && initialLoadingSpinner) {
        initialLoadingSpinner.style.display = 'none';
    }
    containerToUse.style.display = 'grid'; // Or 'block' depending on its layout
};

/**
 * Displays products in a specified container.
 * @param {Array} products - Array of product objects.
 * @param {string} containerId - The ID of the HTML element where products should be displayed.
 */
window.displayProducts = (products, containerId = 'products-container') => {
    const productsContainer = document.getElementById(containerId);
    if (!productsContainer) return;

    productsContainer.innerHTML = '';
    if (!Array.isArray(products) || products.length === 0) {
        productsContainer.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No products available matching your criteria.</p></div>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        // Use Tailwind's responsive grid classes directly
        productCard.classList.add('p-2'); // Adjust padding as needed
        productCard.innerHTML = window.createProductCardHtml(product); // Use the global helper
        productsContainer.appendChild(productCard);
    });

    // Re-attach event listeners for "Add to Cart" buttons after products are displayed
    productsContainer.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default action of parent <a>
            event.stopPropagation(); // Prevent the click from propagating to the parent <a> tag
            const productId = event.target.dataset.productId;
            const hasVariants = event.target.dataset.productHasVariants === 'true';
            
            console.log('Add to Cart button clicked for product ID:', productId, 'Has Variants:', hasVariants);

            if (hasVariants) {
                window.openProductVariantModal(productId);
            } else {
                if (typeof window.addToCart === 'function') {
                    await window.addToCart(productId, 1, []); // No variants, quantity 1
                } else {
                    console.error('window.addToCart is not defined. Cannot add to cart.');
                    window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }
            }
        });
    });
};


/**
 * Helper function to create product card HTML.
 * @param {Object} product - Product object.
 * @returns {string} HTML string for a product card.
 */
window.createProductCardHtml = (product) => {
    let variantDisplayHtml = '';
    const hasVariants = product.variants && product.variants.length > 0;

    if (hasVariants) {
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
    const originalPrice = product.originalPrice ? product.originalPrice.toFixed(2) : null;

    // Price display logic for the bottom section of the card
    let bottomPriceDisplayHtml = '';
    if (originalPrice && originalPrice > price) {
        bottomPriceDisplayHtml = `
            <div class="flex flex-col items-end">
                <span class="text-xl font-bold text-red-600">EGP${price}</span>
                <span class="text-sm text-gray-500 line-through">EGP${originalPrice}</span>
            </div>
        `;
    } else {
        bottomPriceDisplayHtml = `
            <span class="text-xl font-bold text-gray-900">EGP${price}</span>
        `;
    }

    // Conditionally set data attributes for modal or direct add
    const addToCartButtonAttrs = hasVariants
        ? `data-bs-toggle="modal" data-bs-target="#productVariantModal" data-product-has-variants="true" data-product-id="${product._id}"`
        : `data-product-has-variants="false" data-product-id="${product._id}"`;

    return `
        <a href="product-detail.html?id=${product._id}" class="product-card-link block">
            <div class="product-card shadow-md">
                <div class="relative product-card-image-section-v2"> <img class="w-full h-full object-cover" src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';">
                    <div class="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-black/70 to-transparent product-actions">
                        <div class="flex justify-between items-center w-full">
                            <span class="text-2xl font-bold text-white">EGP${price}</span>
                            <button class="bg-[#008080] text-white py-2 px-4 rounded-full hover:bg-[#006666] transition duration-300 text-sm add-to-cart-btn" ${addToCartButtonAttrs}>
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-5 product-card-content-section-v2"> <div> <h3 class="text-xl font-semibold text-gray-800 mb-2">${product.name}</h3>
                        <p class="text-gray-600 text-sm mb-3">${description}</p>
                    </div>
                    <div class="product-variants-price-row-v2"> <div class="variant-display-container">
                            ${variantDisplayHtml}
                        </div>
                        <div class="product-price-display-v2">
                            ${bottomPriceDisplayHtml}
                        </div>
                    </div>
                </div>
            </div>
        </a>
    `;
};

/**
 * Handles login form submission.
 * @param {Event} event - The form submission event.
 */
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
    }catch (error) {
        console.error('Login error:', error);
        window.showToast('An error occurred during login. Please try again.', 'danger');
    }
};

/**
 * Handles registration form submission.
 * @param {Event} event - The form submission event.
 */
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
    }catch (error) {
        console.error('Registration error:', error);
        window.showToast('An error occurred during registration. Please try again.', 'danger');
    }
};

/**
 * Populates variant filters based on available products.
 * @param {Array} products - Array of product objects.
 */
window.populateVariantFilters = (products) => {
    const variantFiltersContainer = document.getElementById('variantFiltersContainer');
    if (!variantFiltersContainer) return;

    variantFiltersContainer.innerHTML = ''; // Clear previous filters

    const uniqueVariantGroups = new Map(); // Map to store unique variant groups and their options

    if (Array.isArray(products)) {
        products.forEach(product => {
            if (product.variants && Array.isArray(product.variants)) {
                product.variants.forEach(group => {
                    if (!uniqueVariantGroups.has(group.name)) {
                        uniqueVariantGroups.set(group.name, new Map());
                    }
                    group.options.forEach(option => {
                        uniqueVariantGroups.get(group.name).set(option.value, true);
                    });
                });
            }
        });
    }

    uniqueVariantGroups.forEach((optionsMap, groupName) => {
        const variantGroupDiv = document.createElement('div');
        variantGroupDiv.classList.add('mb-3');
        let optionsHtml = '';

        optionsMap.forEach((value, optionValue) => {
            const checkboxId = `variant-${groupName}-${optionValue.replace(/\s/g, '-')}`;
            optionsHtml += `
                <div class="form-check">
                    <input class="form-check-input variant-checkbox" type="checkbox"
                           data-variant-name="${groupName}" value="${optionValue}" id="${checkboxId}">
                    <label class="form-check-label" for="${checkboxId}">${optionValue}</label>
                </div>
            `;
        });

        variantGroupDiv.innerHTML = `
            <label class="form-label fw-bold">${groupName}:</label>
            ${optionsHtml}
        `;
        variantFiltersContainer.appendChild(variantGroupDiv);
    });

    // Check checkboxes based on URL parameters (if any)
    const urlParams = new URLSearchParams(window.location.search);
    const variantsParam = urlParams.get('variants');
    if (variantsParam) {
        try {
            const selectedVariantsFromUrl = JSON.parse(variantsParam);
            selectedVariantsFromUrl.forEach(selVar => {
                const checkboxId = `variant-${selVar.name}-${selVar.value.replace(/\s/g, '-')}`;
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        } catch (e) {
            console.error("Error parsing variants from URL:", e);
        }
    }
};

/**
 * Displays image search results by fetching product details using provided IDs.
 * @param {string} productIds - Comma-separated string of product IDs.
 */
window.displayImageSearchResults = async (productIds) => {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    // Show custom spinner for image search results
    productsContainer.innerHTML = createLoadingSpinnerHtml('Loading image search results...');

    try {
        const response = await fetch(`http://localhost:3000/api/products/by-ids?ids=${encodeURIComponent(productIds)}`, {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch image search results.');
        }

        window.displayProducts(data.products); // Display fetched products
        window.showToast(`Found ${data.products.length} matching products.`, 'success');

    }catch (error) {
        console.error('Error fetching image search results:', error);
        productsContainer.innerHTML = `<div class="col-12 text-center"><p class="text-danger">Failed to load image search results: ${error.message}</p></div>`;
        window.showToast(`Failed to load image search results: ${error.message}`, 'danger');
    }
};

/**
 * Generic Carousel Functionality for both single and multi-item carousels.
 * @param {string} carouselId - The ID of the carousel container.
 * @param {number} interval - Auto-play interval in milliseconds (0 for no auto-play).
 * @param {Object} itemsPerView - Object defining items per view for different screen sizes (mobile, sm, md, lg).
 * @param {boolean} scrollByOneItem - If true, carousel scrolls one item at a time, otherwise scrolls by 'page'.
 */
function setupCarousel(carouselId, interval = 0, itemsPerView = { mobile: 1, sm: 1, md: 1, lg: 1 }, scrollByOneItem = false) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const dotsContainer = carousel.querySelector('.absolute.bottom-4');
    let dots = []; // Initialize dots array

    const prevButton = carousel.querySelector('.carousel-button.prev');
    const nextButton = carousel.querySelector('.carousel-button.next');

    let currentIndex = 0;
    let slideInterval;
    let currentItemsPerView = itemsPerView.mobile; // Default for mobile

    // Touch/Swipe variables
    let startX = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let isDragging = false;
    let animationFrame;

    const getItemsPerView = () => {
        if (window.innerWidth >= 1024) return itemsPerView.lg;
        if (window.innerWidth >= 768) return itemsPerView.md;
        if (window.innerWidth >= 640) return itemsPerView.sm;
        return itemsPerView.mobile;
    };

    const setSliderPosition = () => {
        track.style.transform = `translateX(${currentTranslate}px)`;
    };

    const updateCarousel = () => {
        currentItemsPerView = getItemsPerView();
        const totalSlides = slides.length;
        const slideWidth = slides.length > 0 ? slides[0].offsetWidth : 0; // Assuming all slides have same width

        let effectiveMaxIndex;
        if (scrollByOneItem) {
            effectiveMaxIndex = Math.max(0, totalSlides - currentItemsPerView);
        } else {
            effectiveMaxIndex = Math.max(0, Math.ceil(totalSlides / currentItemsPerView) - 1);
        }

        if (currentIndex > effectiveMaxIndex) {
            currentIndex = effectiveMaxIndex;
        }

        // Calculate the target translation based on currentIndex
        const targetTranslation = -currentIndex * (slideWidth * (scrollByOneItem ? 1 : currentItemsPerView));
        currentTranslate = targetTranslation;
        setSliderPosition();


        // Update dots visibility and active state
        if (dotsContainer) {
            if (effectiveMaxIndex === 0) {
                dotsContainer.classList.add('hidden');
            } else {
                dotsContainer.classList.remove('hidden');
                // Only create dots if they don't exist or slide count changed
                if (dots.length === 0 || dots.length !== (effectiveMaxIndex + 1)) {
                    dotsContainer.innerHTML = '';
                    for (let i = 0; i <= effectiveMaxIndex; i++) {
                        const dot = document.createElement('div');
                        dot.classList.add('carousel-dot');
                        dot.dataset.slide = i;
                        dot.addEventListener('click', (e) => {
                            goToSlide(parseInt(e.target.dataset.slide));
                            resetInterval();
                        });
                        dotsContainer.appendChild(dot);
                    }
                    dots = Array.from(dotsContainer.children);
                }

                dots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === currentIndex);
                });
            }
        }
    };

    const goToSlide = (index) => {
        currentIndex = index;
        updateCarousel();
    };

    const nextSlide = () => {
        const totalSlides = slides.length;
        const effectiveMaxIndex = scrollByOneItem ? Math.max(0, totalSlides - currentItemsPerView) : Math.max(0, Math.ceil(totalSlides / currentItemsPerView) - 1);

        currentIndex = (currentIndex + 1);
        if (currentIndex > effectiveMaxIndex) {
            currentIndex = 0; // Loop back to start
        }
        updateCarousel();
    };

    const prevSlide = () => {
        const totalSlides = slides.length;
        const effectiveMaxIndex = scrollByOneItem ? Math.max(0, totalSlides - currentItemsPerView) : Math.max(0, Math.ceil(totalSlides / currentItemsPerView) - 1);

        currentIndex = (currentIndex - 1);
        if (currentIndex < 0) {
            currentIndex = effectiveMaxIndex; // Loop to end
        }
        updateCarousel();
    };

    // Event Listeners for buttons
    if (nextButton) nextButton.addEventListener('click', () => { nextSlide(); resetInterval(); });
    if (prevButton) prevButton.addEventListener('click', () => { prevSlide(); resetInterval(); });

    // Touch/Swipe Event Listeners
    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        clearInterval(slideInterval); // Stop auto-play on touch
        track.style.transition = 'none'; // Remove transition for immediate dragging
        prevTranslate = currentTranslate; // Store the current translation
    });

    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentPosition = e.touches[0].clientX;
        const diff = currentPosition - startX;
        currentTranslate = prevTranslate + diff;

        // Optionally, add limits to prevent dragging too far
        const maxTranslate = 0; // Max translation is 0 (first slide)
        const minTranslate = -(slides.length * slides[0].offsetWidth - carousel.offsetWidth); 
        
        // This limiting logic needs to be more sophisticated for multi-item carousels
        // For simplicity, for now, we allow free dragging and snap back on touchend
        
        setSliderPosition();
    });

    track.addEventListener('touchend', () => {
        isDragging = false;
        track.style.transition = 'transform 0.5s ease-out'; // Re-add smooth transition

        const movedBy = currentTranslate - prevTranslate; // How much it was dragged
        const slideWidth = slides.length > 0 ? slides[0].offsetWidth : 0;
        const swipeThreshold = slideWidth * 0.25; // 25% of a slide width to trigger a swipe

        if (movedBy < -swipeThreshold) { // Swiped left
            nextSlide();
        } else if (movedBy > swipeThreshold) { // Swiped right
            prevSlide();
        } else {
            // If not enough swipe, snap back to current index's position
            const targetTranslation = -currentIndex * (slideWidth * (scrollByOneItem ? 1 : currentItemsPerView));
            currentTranslate = targetTranslation;
            setSliderPosition();
        }
        resetInterval(); // Restart auto-play after interaction
    });

    // Prevent default touch behavior (like scrolling the page) when swiping horizontally
    track.addEventListener('touchcancel', () => {
        isDragging = false;
        track.style.transition = 'transform 0.5s ease-out';
        const slideWidth = slides.length > 0 ? slides[0].offsetWidth : 0;
        const targetTranslation = -currentIndex * (slideWidth * (scrollByOneItem ? 1 : currentItemsPerView));
        currentTranslate = targetTranslation;
        setSliderPosition();
        resetInterval();
    });


    // Auto-play functionality
    const startInterval = () => {
        if (interval > 0) {
            slideInterval = setInterval(nextSlide, interval);
        }
    };

    const resetInterval = () => {
        if (interval > 0) {
            clearInterval(slideInterval);
            startInterval();
        }
    };

    // Handle window resize for responsive item display
    window.addEventListener('resize', () => {
        updateCarousel();
        resetInterval(); // Reset interval on resize to prevent visual glitches
    });

    // Initialize carousel
    updateCarousel();
    startInterval();

    // Pause on hover
    carousel.addEventListener('mouseenter', () => clearInterval(slideInterval));
    carousel.addEventListener('mouseleave', () => startInterval());
}

/**
 * Initializes custom carousels with fetched data.
 * @param {string} sectionId - The ID of the carousel container.
 * @param {Array} items - Array of product/image/slide data to populate the carousel.
 * @param {boolean} isHeroCarousel - True if this is the Hero Carousel, to use specific HTML structure.
 * @param {boolean} isPromoCarousel - True if this is the Promo Carousel, to use specific HTML structure.
 * @param {Object} itemsPerView - Object defining items per view for different screen sizes (mobile, sm, md, lg).
 * @param {boolean} scrollByOneItem - If true, carousel scrolls one item at a time.
 */
window.initializeCustomCarousel = async function(sectionId, items, isHeroCarousel = false, isPromoCarousel = false, itemsPerView = { mobile: 1, sm: 1, md: 1, lg: 1 }, scrollByOneItem = false) {
    const carouselContainer = document.getElementById(sectionId);
    if (!carouselContainer) {
        console.error(`Carousel container with ID "${sectionId}" not found.`);
        return;
    }

    const track = carouselContainer.querySelector('.carousel-track');
    const prevButton = carouselContainer.querySelector('.carousel-button.prev');
    const nextButton = carouselContainer.querySelector('.carousel-button.next');
    const dotsContainer = carouselContainer.querySelector('.absolute.bottom-4');

    // Ensure track and other critical elements exist
    if (!track) {
        console.error(`Missing carousel-track for custom carousel in section "${sectionId}".`);
        return;
    }
    // Only check buttons and dots if they are expected to exist (i.e., not a simple list that becomes a carousel)
    // For product-style carousels, they should exist.

    track.innerHTML = ''; // Clear loading message and any static content
    if (dotsContainer) dotsContainer.innerHTML = ''; // Clear dots

    if (!items || items.length === 0) {
        track.innerHTML = '<div class="carousel-slide full-width-slide text-center col-span-full py-8"><p class="text-muted">No items available.</p></div>';
        if (prevButton) prevButton.classList.add('hidden');
        if (nextButton) nextButton.classList.add('hidden');
        if (dotsContainer) dotsContainer.classList.add('hidden');
        return;
    }

    items.forEach(item => {
        const slideDiv = document.createElement('div');
        if (isHeroCarousel) {
            slideDiv.classList.add('carousel-slide', 'full-width-slide', 'hero-carousel-slide');
            slideDiv.style.backgroundImage = `url('${item.imageUrl || 'https://placehold.co/1920x800/004d4d/ffffff?text=Hero+Slide'}')`;
            slideDiv.innerHTML = `
                <div class="hero-carousel-overlay"></div>
                <div class="hero-carousel-content">
                    <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight drop-shadow-lg">
                        ${item.title}
                    </h1>
                    <p class="text-md md:text-lg lg:text-xl mb-8 opacity-90 drop-shadow-md">
                        ${item.description}
                    </p>
                    <a href="${item.buttonLink}" class="bg-white text-[#004d4d] font-bold py-3 px-8 rounded-full shadow-lg hover:bg-gray-100 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300">
                        ${item.buttonText}
                    </a>
                </div>
            `;
        } else if (isPromoCarousel) {
            slideDiv.classList.add('carousel-slide', 'full-width-slide', 'hero-carousel-slide');
            slideDiv.style.backgroundImage = `url('${item.imageUrl || 'https://placehold.co/1920x600/008080/ffffff?text=Promo+Slide'}')`;
            slideDiv.style.height = '60vh';
            slideDiv.innerHTML = `
                <div class="hero-carousel-overlay"></div>
                <div class="hero-carousel-content">
                    <h2 class="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight drop-shadow-lg">
                        ${item.title}
                    </h2>
                    <p class="text-md md:text-lg lg:text-xl mb-8 opacity-90 drop-shadow-md">
                        ${item.description}
                    </p>
                    <a href="${item.buttonLink}" class="bg-white text-[#004d4d] font-bold py-3 px-8 rounded-full shadow-lg hover:bg-gray-100 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300">
                        ${item.buttonText}
                    </a>
                </div>
            `;
        } else { // Generic product/gallery item
             slideDiv.classList.add('carousel-slide', 'multi-item-slide');
             if (sectionId === 'productCarousel' || sectionId === 'newArrivalsCarousel' || sectionId === 'bestSellersCarousel' || sectionId === 'quickDealsCarousel') { // Product cards
                 slideDiv.innerHTML = window.createProductCardHtml(item);
                 const button = slideDiv.querySelector('.add-to-cart-btn');
                 if (button) {
                     button.addEventListener('click', async (event) => {
                         event.preventDefault(); // Prevent default action of parent <a>
                         event.stopPropagation(); // Prevent the click from propagating to the parent <a> tag
                         const productId = event.target.dataset.productId;
                         const hasVariants = event.target.dataset.productHasVariants === 'true';

                         console.log('Add to Cart button clicked for product ID (from carousel):', productId, 'Has Variants:', hasVariants);

                         if (hasVariants) {
                             window.openProductVariantModal(productId);
                         } else {
                             if (typeof window.addToCart === 'function') {
                                 await window.addToCart(productId, 1, []); // No variants, quantity 1
                             } else {
                                 console.error('window.addToCart is not defined. Cannot add to cart.');
                                 window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                             }
                         }
                     });
                 }
             } else if (sectionId === 'galleryCarousel') { // Gallery images
                 slideDiv.innerHTML = `<img src="${item.imageUrl}" alt="${item.description || 'Gallery Image'}" class="w-full h-full object-cover rounded-lg shadow-lg" onerror="this.onerror=null;this.src='https://placehold.co/800x500/cbd5e0/4a5568?text=Image+Unavailable';">`;
             }
        }
        track.appendChild(slideDiv);
    });

    // ✅ NEW: Add a small delay before setting up the carousel to allow DOM to render and measure
    setTimeout(() => {
        if (isHeroCarousel) {
            setupCarousel(sectionId, 5000, itemsPerView);
        } else if (isPromoCarousel) {
            setupCarousel(sectionId, 6000, itemsPerView);
        } else { // Product-style or gallery carousels use passed itemsPerView and scrollByOneItem
            setupCarousel(sectionId, 3000, itemsPerView, scrollByOneItem);
        }
    }, 50); // 50ms delay, adjust if needed


};


/**
  * Fetches hero slides from the backend and initializes the hero carousel.
 */
async function fetchHeroSlidesForCarousel() {
    try {
        const response = await fetch('http://localhost:3000/api/hero-slides', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            // Pass true for isHeroCarousel, false for isPromoCarousel
            window.initializeCustomCarousel('heroCarousel', data, true, false, { mobile: 1, sm: 1, md: 1, lg: 1 });
        } else {
            console.error('Failed to fetch hero slides for carousel:', data.message);
            const heroCarouselContainer = document.getElementById('heroCarousel');
            if (heroCarouselContainer) {
                const track = heroCarouselContainer.querySelector('.carousel-track');
                // ✅ MODIFIED: Use spinner for error state
                if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load hero slides: ${data.message}</p>`);
            }
            window.showToast(`Failed to load hero slides: ${data.message}`, 'danger');
        }
    }catch (error) {
        console.error('Error fetching hero slides for carousel:', error);
        const heroCarouselContainer = document.getElementById('heroCarousel');
        if (heroCarouselContainer) {
            const track = heroCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load hero slides: ${error.message}</p>`);
        }
        window.showToast(`Failed to load hero slides: ${error.message}`, 'danger');
    }
}


/**
 * Fetches promo slides from the backend and initializes the promo carousel.
 */
async function fetchPromoSlidesForCarousel() {
    try {
        const response = await fetch('http://localhost:3000/api/promo-slides', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            // Pass false for isHeroCarousel, true for isPromoCarousel
            window.initializeCustomCarousel('promoCarousel', data, false, true, { mobile: 1, sm: 1, md: 1, lg: 1 });
        } else {
            console.error('Failed to fetch promo slides for carousel:', data.message);
            const promoCarouselContainer = document.getElementById('promoCarousel');
            if (promoCarouselContainer) {
                const track = promoCarouselContainer.querySelector('.carousel-track');
                // ✅ MODIFIED: Use spinner for error state
                if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load promo slides: ${data.message}</p>`);
            }
            window.showToast(`Failed to load promo slides: ${data.message}`, 'danger');
        }
    }catch (error) {
        console.error('Error fetching promo slides for carousel:', error);
        const promoCarouselContainer = document.getElementById('promoCarousel');
        if (promoCarouselContainer) {
            const track = promoCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load promo slides: ${error.message}</p>`);
        }
        window.showToast(`Failed to load promo slides: ${error.message}`, 'danger');
    }
}


/**
 * Fetches products for the "Our Top Picks" (Product Carousel) section.
 */
async function fetchTopPicksProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products?limit=40&sortBy=totalSold&sortOrder=desc', { // Changed limit to 40
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            window.initializeCustomCarousel('productCarousel', data.products, false, false, { mobile: 1, sm: 2, md: 3, lg: 4 }, true);
        } else {
            console.error('Failed to fetch top picks products:', data.message);
            const productCarouselContainer = document.getElementById('productCarousel');
            if (productCarouselContainer) {
                const track = productCarouselContainer.querySelector('.carousel-track');
                // ✅ MODIFIED: Use spinner for error state
                if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load top picks products: ${data.message}</p>`);
            }
        }
    }catch (error) {
        console.error('Error fetching top picks products:', error);
        const productCarouselContainer = document.getElementById('productCarousel');
        if (productCarouselContainer) {
            const track = productCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load top picks products: ${error.message}</p>`);
        }
        window.showToast(`Failed to load top picks products: ${error.message}`, 'danger');
    }
}

// NEW: Function to fetch and display New Arrivals (as Carousel)
async function fetchNewArrivals() {
    const newArrivalsCarouselContainer = document.getElementById('newArrivalsCarousel');
    if (!newArrivalsCarouselContainer) return;
    const track = newArrivalsCarouselContainer.querySelector('.carousel-track');
    // ✅ MODIFIED: Use spinner for loading
    if (track) track.innerHTML = createLoadingSpinnerHtml('Loading new products...');

    try {
        const response = await fetch('http://localhost:3000/api/products?sortBy=createdAt&sortOrder=desc&limit=10', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            window.initializeCustomCarousel('newArrivalsCarousel', data.products, false, false, { mobile: 1, sm: 2, md: 3, lg: 4 }, true);
        } else {
            throw new Error(data.message || 'Failed to fetch new arrivals.');
        }
    }catch (error) {
        console.error('Error fetching new arrivals:', error);
        if (newArrivalsCarouselContainer) {
            const track = newArrivalsCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load new arrivals: ${data.message}</p>`);
        }
        window.showToast(`Failed to load new arrivals: ${error.message}`, 'danger');
    }
}

// NEW: Function to fetch and display Best Sellers (as Carousel)
async function fetchBestSellers() {
    const bestSellersCarouselContainer = document.getElementById('bestSellersCarousel');
    if (!bestSellersCarouselContainer) return;
    const track = bestSellersCarouselContainer.querySelector('.carousel-track');
    // ✅ MODIFIED: Use spinner for loading
    if (track) track.innerHTML = createLoadingSpinnerHtml('Loading best sellers...');

    try {
        // NOTE: This assumes 'totalSold' field exists and is updated in your Product model.
        // If not, consider sorting by 'totalReviews' or 'rating' if available, or 'createdAt' as a fallback.
        const response = await fetch('http://localhost:3000/api/products?sortBy=totalSold&sortOrder=desc&limit=10', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            window.initializeCustomCarousel('bestSellersCarousel', data.products, false, false, { mobile: 1, sm: 2, md: 3, lg: 4 }, true);
        } else {
            throw new Error(data.message || 'Failed to fetch best sellers.');
        }
    }catch (error) {
        console.error('Error fetching best sellers:', error);
        if (bestSellersCarouselContainer) {
            const track = bestSellersCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load best sellers: ${data.message}</p>`);
        }
        window.showToast(`Failed to load best sellers: ${error.message}`, 'danger');
    }
}

// NEW: Function to fetch and display Quick Deals (as Carousel) - Placeholder for now, requires backend implementation for actual deals)
async function fetchQuickDeals() {
    const quickDealsCarouselContainer = document.getElementById('quickDealsCarousel');
    if (!quickDealsCarouselContainer) return;
    const track = quickDealsCarouselContainer.querySelector('.carousel-track');
    // ✅ MODIFIED: Use spinner for loading
    if (track) track.innerHTML = createLoadingSpinnerHtml('Loading limited time deals...');

    try {
        // Now that the backend supports isOnFlashSale filter, use it.
        // This fetches products that are marked as isOnFlashSale and whose flashSaleEndDate is in the future.
        const response = await fetch('http://localhost:3000/api/products?isOnFlashSale=true&limit=10', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            window.initializeCustomCarousel('quickDealsCarousel', data.products, false, false, { mobile: 1, sm: 2, md: 3, lg: 4 }, true);
        } else {
            throw new Error(data.message || 'Failed to fetch deals.');
        }
    }
    catch (error) {
        console.error('Error fetching quick deals:', error);
        if (quickDealsCarouselContainer) {
            const track = quickDealsCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load limited time deals: ${data.message}</p>`);
        }
        window.showToast(`Failed to load deals: ${error.message}`, 'danger');
    }
}

// REMOVED: Function to fetch and display Customer Testimonials (as requested by user)
/*
async function fetchCustomerTestimonials() {
    const container = document.getElementById('testimonials-container');
    if (!container) return;
    container.innerHTML = '<div class="col-span-full text-center text-muted">Loading customer testimonials...</div>';
    try {
        const response = await fetch('http://localhost:3000/api/reviews/approved?limit=3', { // Fetch 3 approved testimonials
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            container.innerHTML = ''; // Clear loading message
            if (data.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No testimonials available yet.</p></div>';
                return;
            }
            data.forEach(review => {
                const testimonialCard = document.createElement('div');
                testimonialCard.classList.add('bg-white', 'p-6', 'rounded-lg', 'shadow-md', 'flex', 'flex-col', 'items-center', 'text-center');
                const ratingStars = getStarHtml(review.rating); // Reuse getStarHtml if available, otherwise implement here
                testimonialCard.innerHTML = `
                    <p class="text-gray-700 text-lg italic mb-4">"${review.comment}"</p>
                    <div class="flex items-center mb-2">${ratingStars}</div>
                    <p class="font-semibold text-gray-800">${review.userId ? review.userId.name : 'Anonymous'}</p>
                    ${review.productId ? `<p class="text-sm text-gray-500">on <a href="product-detail.html?id=${review.productId._id}" class="text-[#008080] hover:underline">${review.productId.name}</a></p>` : ''}
                `;
                container.appendChild(testimonialCard);
            });
        } else {
            throw new Error(data.message || 'Failed to fetch testimonials.');
        }
    } catch (error) {
        console.error('Error fetching testimonials:', error);
        container.innerHTML = `<div class="col-span-full text-center"><p class="text-danger">Failed to load testimonials: ${error.message}</p></div>`;
        window.showToast(`Failed to load testimonials: ${error.message}`, 'danger');
    }
}
*/

// Helper for testimonials: Generates star HTML (kept for reference, can be removed if testimonials are entirely removed)
function getStarHtml(rating) {
    let starsHtml = '';
    for (let i = 0; i < Math.floor(rating); i++) {
        starsHtml += '<i class="fas fa-star text-yellow-400"></i>';
    }
    if (rating % 1 >= 0.5) {
        starsHtml += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
    }
    for (let i = 0; i < (5 - Math.ceil(rating)); i++) {
        starsHtml += '<i class="far fa-star text-yellow-400"></i>';
    }
    return starsHtml;
}


/**
 * Fetches images for the "Our Visual Story" (Image Gallery Carousel) section.
 * Now fetches from the backend API.
 */
async function fetchGalleryImages() {
    try {
        const response = await fetch('http://localhost:3000/api/gallery-images', {
            // Note: If this is a truly public endpoint, you might not need headers here.
            // However, including for consistency with other authenticated fetches.
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            window.initializeCustomCarousel('galleryCarousel', data, false, false, { mobile: 1, sm: 2, md: 3, lg: 4 }, true);
        } else {
            console.error('Failed to fetch gallery images for carousel:', data.message);
            const galleryCarouselContainer = document.getElementById('galleryCarousel');
            if (galleryCarouselContainer) {
                const track = galleryCarouselContainer.querySelector('.carousel-track');
                // ✅ MODIFIED: Use spinner for error state
                if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load gallery images: ${data.message}</p>`);
            }
            window.showToast(`Failed to load gallery images: ${data.message}`, 'danger');
        }
    }catch (error) {
        console.error('Error fetching gallery images for carousel:', error);
        const galleryCarouselContainer = document.getElementById('galleryCarousel');
        if (galleryCarouselContainer) {
            const track = galleryCarouselContainer.querySelector('.carousel-track');
            // ✅ MODIFIED: Use spinner for error state
            if (track) track.innerHTML = createLoadingSpinnerHtml(`<p class="text-danger">Failed to load gallery images: ${error.message}</p>`);
        }
        window.showToast(`Failed to load gallery images: ${error.message}`, 'danger');
    }
}


/**
 * Applies product filters and re-fetches products.
 * @param {number} page - The page number to fetch.
 */
window.applyProductFilters = (page = 1) => {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const minPriceInput = document.getElementById('minPriceInput');
    const maxPriceInput = document.getElementById('maxPriceInput');
    const sortFilter = document.getElementById('sortFilter');
    const variantCheckboxes = document.querySelectorAll('.variant-checkbox:checked');

    const filters = {
        search: searchInput ? searchInput.value : '',
        category: categoryFilter ? categoryFilter.value : 'All',
        minPrice: minPriceInput ? parseFloat(minPriceInput.value) || undefined : undefined,
        maxPrice: maxPriceInput ? parseFloat(maxPriceInput.value) || undefined : undefined,
        sort: sortFilter ? sortFilter.value : '',
        page: page,
        variants: []
    };

    variantCheckboxes.forEach(checkbox => {
        filters.variants.push({
            name: checkbox.dataset.variantName,
            value: checkbox.value
        });
    });

    if (filters.variants.length === 0) {
        delete filters.variants;
    }

    window.fetchProducts(filters);
};

// NEW: Function to handle newsletter form submission
async function handleNewsletterSubmission(event) {
    event.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput.value;

    if (!email || !email.includes('@')) {
        window.showToast('Please enter a valid email address.', 'warning');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/users/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            window.showToast(data.message, 'success');
            emailInput.value = ''; // Clear the input field
        } else {
            throw new Error(data.message || 'Subscription failed.');
        }
    }catch (error) {
        console.error('Newsletter subscription error:', error);
        window.showToast(`Subscription failed: ${error.message}`, 'danger');
    }
}


// === Product Variant Modal Logic (NEW) ===
let currentProductInModal = null;
let selectedVariantsMapModal = {}; // Stores { groupName: optionValue, ... } for current selection in modal
let currentCalculatedVariantDetailsModal = { // Stores combined details for selected variant combination in modal
    totalAvailableStock: 0,
    combinedPriceAdjustment: 0,
    combinedImageUrl: ''
};

// Declare modal instance globally or in an accessible scope
let productVariantBsModal = null; // Declare here to be accessible

// Helper to get selected variants from modal as an array
function getSelectedVariantsAsArrayModal() {
    const selected = [];
    const variantSelects = document.querySelectorAll('#productVariantModal .variant-select-modal');
    variantSelects.forEach(select => {
        selected.push({
            name: select.dataset.groupName,
            value: select.value
        });
    });
    return selected.sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value));
}

// Helper to update quantity buttons in modal
function updateQuantityButtonsModal(currentQty, maxQty) {
    const quantityInputModal = document.getElementById('modalQuantityInput');
    const decreaseQuantityBtnModal = document.getElementById('modalDecreaseQuantityBtn');
    const increaseQuantityBtnModal = document.getElementById('modalIncreaseQuantityBtn');

    if (quantityInputModal) {
        quantityInputModal.value = currentQty;
        quantityInputModal.min = maxQty > 0 ? 1 : 0;
        quantityInputModal.max = maxQty;
    }
    if (decreaseQuantityBtnModal) decreaseQuantityBtnModal.disabled = currentQty <= (maxQty > 0 ? 1 : 0);
    if (increaseQuantityBtnModal) increaseQuantityBtnModal.disabled = currentQty >= maxQty;
    
    if (maxQty === 0) {
        if (quantityInputModal) quantityInputModal.value = 0;
        if (decreaseQuantityBtnModal) decreaseQuantityBtnModal.disabled = true;
        if (increaseQuantityBtnModal) increaseQuantityBtnModal.disabled = true;
    }
}

// Helper to render variant selectors in modal
function renderVariantSelectorsModal(variants) {
    const variantSelectorsContainer = document.getElementById('modalVariantsSection'); // Corrected ID usage
    if (!variantSelectorsContainer) return;
    variantSelectorsContainer.innerHTML = '';
    selectedVariantsMapModal = {}; // Reset selections

    if (!variants || variants.length === 0) { // Check if variants array is empty or null/undefined
        variantSelectorsContainer.innerHTML = '<p class="text-muted">No options available for this product.</p>';
        return;
    }

    variants.forEach((group, index) => {
        if (!group.options || group.options.length === 0) return;

        const variantGroupDiv = document.createElement('div');
        variantGroupDiv.classList.add('mb-3');
        variantGroupDiv.innerHTML = `
            <label for="modalVariantSelect_${index}" class="form-label me-3 fw-bold">${group.name}:</label>
            <select class="form-select variant-select-modal" id="modalVariantSelect_${index}" data-group-name="${group.name}">
                ${group.options.map(option => `<option value="${option.value}">${option.value}</option>`).join('')}
            </select>
        `;
        variantSelectorsContainer.appendChild(variantGroupDiv);

        const selectElement = variantGroupDiv.querySelector('.variant-select-modal');
        selectElement.addEventListener('change', updateProductDisplayBasedOnVariantsModal);

        // Default to first option selected for each group
        if (group.options.length > 0) {
            selectedVariantsMapModal[group.name] = group.options[0].value;
        }
    });
    // Initial update after rendering selectors
    updateProductDisplayBasedOnVariantsModal();
}

// Helper to update product display in modal based on variant selections
function updateProductDisplayBasedOnVariantsModal() {
    if (!currentProductInModal || !currentProductInModal.variants) return;

    // Update selectedVariantsMapModal from current UI selections
    document.querySelectorAll('#productVariantModal .variant-select-modal').forEach(select => {
        selectedVariantsMapModal[select.dataset.groupName] = select.value;
    });

    currentCalculatedVariantDetailsModal.totalAvailableStock = Infinity;
    currentCalculatedVariantDetailsModal.combinedPriceAdjustment = 0;
    currentCalculatedVariantDetailsModal.combinedImageUrl = currentProductInModal.imageUrl;

    let allSelectionsAreValid = true;

    for (const group of currentProductInModal.variants) {
        const selectedOptionValueForGroup = selectedVariantsMapModal[group.name];
        if (selectedOptionValueForGroup) {
            const foundOption = group.options.find(option => option.value === selectedOptionValueForGroup);
            if (foundOption) {
                currentCalculatedVariantDetailsModal.totalAvailableStock = Math.min(currentCalculatedVariantDetailsModal.totalAvailableStock, foundOption.stock);
                currentCalculatedVariantDetailsModal.combinedPriceAdjustment += foundOption.priceAdjustment || 0;
                if (foundOption.imageUrl) {
                    currentCalculatedVariantDetailsModal.combinedImageUrl = foundOption.imageUrl;
                }
            } else {
                allSelectionsAreValid = false;
                break;
            }
        } else {
            allSelectionsAreValid = false;
            break;
        }
    }

    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductPrice = document.getElementById('modalProductPrice');
    const modalProductStock = document.getElementById('modalProductStock');
    const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');
    const modalQuantityInput = document.getElementById('modalQuantityInput');

    if (allSelectionsAreValid && currentProductInModal.variants.length > 0) {
        modalProductImage.src = currentCalculatedVariantDetailsModal.combinedImageUrl || currentProductInModal.imageUrl || '/images/placeholder.jpg';
        const newPrice = currentProductInModal.price + currentCalculatedVariantDetailsModal.combinedPriceAdjustment;
        modalProductPrice.textContent = `EGP${newPrice.toFixed(2)}`;
        modalProductStock.textContent = currentCalculatedVariantDetailsModal.totalAvailableStock > 0 ? `In Stock: ${currentCalculatedVariantDetailsModal.totalAvailableStock}` : 'Out of Stock';
        if (modalQuantityInput) modalQuantityInput.max = currentCalculatedVariantDetailsModal.totalAvailableStock;
    
        const isAvailable = currentCalculatedVariantDetailsModal.totalAvailableStock > 0;
        if (modalAddToCartBtn) {
            modalAddToCartBtn.disabled = !isAvailable;
            modalAddToCartBtn.textContent = isAvailable ? 'Add to Cart' : 'Out of Stock';
        }
    } else {
        // Fallback to base product info if selections are invalid or incomplete
        modalProductImage.src = currentProductInModal.imageUrl || '/images/placeholder.jpg';
        modalProductPrice.textContent = `EGP${(currentProductInModal.price || 0).toFixed(2)}`;
        modalProductStock.textContent = (currentProductInModal.stock > 0 ? `In Stock: ${currentProductInModal.stock}` : 'Out of Stock');
        if (modalQuantityInput) modalQuantityInput.max = currentProductInModal.stock || 0;

        const isAvailable = currentProductInModal.stock > 0;
        if (modalAddToCartBtn) {
            modalAddToCartBtn.disabled = !isAvailable;
            modalAddToCartBtn.textContent = isAvailable ? 'Add to Cart' : 'Out of Stock';
        }
        if (currentProductInModal.variants && currentProductInModal.variants.length > 0 && !allSelectionsAreValid) {
             // Only show toast if variants exist but selection is incomplete
            window.showToast('Please select all variant options.', 'warning');
        }
    }
    let currentQuantity = parseInt(modalQuantityInput.value);
    let maxStock = parseInt(modalQuantityInput.max);
    if (isNaN(currentQuantity) || currentQuantity <= 0) {
        currentQuantity = 1;
    }
    if (currentQuantity > maxStock) {
        currentQuantity = maxStock > 0 ? maxStock : 1;
    }
    if (maxStock === 0) {
        currentQuantity = 0;
    }
    if (modalQuantityInput) modalQuantityInput.value = currentQuantity;
    updateQuantityButtonsModal(currentQuantity, maxStock);
}


window.openProductVariantModal = async (productId) => {
    const productVariantModalElement = document.getElementById('productVariantModal');
    // Initialize once if not already
    if (!productVariantBsModal) {
        productVariantBsModal = new bootstrap.Modal(productVariantModalElement);
    }

    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductPrice = document.getElementById('modalProductPrice');
    const modalProductStock = document.getElementById('modalProductStock');
    const modalVariantSelectors = document.getElementById('modalVariantsSection'); // Corrected ID usage
    const modalQuantityInput = document.getElementById('modalQuantityInput');
    const modalDecreaseQuantityBtn = document.getElementById('modalDecreaseQuantityBtn');
    const modalIncreaseQuantityBtn = document.getElementById('modalIncreaseQuantityBtn');
    const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');
    const modalLoadingSpinner = document.getElementById('modalLoadingSpinner');
    const modalContentContainer = document.getElementById('modalContentContainer');

    // Show loading spinner, hide content
    if (modalLoadingSpinner) modalLoadingSpinner.style.display = 'block';
    if (modalContentContainer) modalContentContainer.style.display = 'none';

    productVariantBsModal.show(); // Use the persistent instance to show

    try {
        const response = await fetch(`http://localhost:3000/api/products/single/${productId}`, {
            headers: window.getAuthHeaders()
        });
        const product = await response.json();

        if (!response.ok) {
            throw new Error(product.message || 'Failed to fetch product details for modal.');
        }

        currentProductInModal = product; // Store fetched product data globally for modal logic
        console.log('Fetched product for modal:', product);
        console.log('Product variants in modal:', product.variants);

        // Populate modal with product details
        if (modalProductImage) modalProductImage.src = product.imageUrl || '/images/placeholder.jpg';
        if (modalProductName) modalProductName.textContent = product.name;
        // Price display needs to consider flash sale if applicable
        let displayPrice = product.price;
        if (product.isOnFlashSale && product.flashSalePrice !== null && new Date(product.flashSaleEndDate) > new Date()) {
            displayPrice = product.flashSalePrice;
        }
        if (modalProductPrice) modalProductPrice.textContent = `EGP${(displayPrice || 0).toFixed(2)}`;

        // Stock display needs to consider base product stock first, then variants if present
        let initialStock = product.stock;
        if (product.variants && product.variants.length > 0) {
             // If variants exist, initial stock for display should be derived from the first options
             // or set to 0 initially until variants are selected.
             // For now, let's keep it simple and assume initial display uses base product stock
             // and `updateProductDisplayBasedOnVariantsModal` will refine.
             initialStock = Math.min(...product.variants.flatMap(group => group.options.map(option => option.stock)));
             if (isNaN(initialStock) || !isFinite(initialStock)) initialStock = 0; // Handle cases where options might be empty or malformed
        }

        if (modalProductStock) modalProductStock.textContent = initialStock > 0 ? `In Stock: ${initialStock}` : 'Out of Stock';
        if (modalQuantityInput) {
            modalQuantityInput.value = 1; // Default quantity
            modalQuantityInput.max = initialStock; // Set max based on initial stock
        }

        // Render variants if available
        if (product.variants && product.variants.length > 0) {
            renderVariantSelectorsModal(product.variants);
            if (modalVariantSelectors) modalVariantSelectors.style.display = 'block'; // Ensure it's shown
        } else {
            if (modalVariantSelectors) modalVariantSelectors.style.display = 'none'; // Ensure it's hidden
        }
        
        // Initial update of quantity buttons based on calculated stock (from variants or base product)
        updateQuantityButtonsModal(parseInt(modalQuantityInput.value), parseInt(modalQuantityInput.max));


        // Hide spinner, show content
        if (modalLoadingSpinner) modalLoadingSpinner.style.display = 'none';
        if (modalContentContainer) modalContentContainer.style.display = 'flex'; // Show content container

        // Event listeners for quantity buttons inside modal
        if (modalDecreaseQuantityBtn) {
            modalDecreaseQuantityBtn.onclick = () => {
                let currentQty = parseInt(modalQuantityInput.value);
                if (currentQty > 1) {
                    modalQuantityInput.value = currentQty - 1;
                    updateQuantityButtonsModal(parseInt(modalQuantityInput.value), parseInt(modalQuantityInput.max));
                }
            };
        }
        if (modalIncreaseQuantityBtn) {
            modalIncreaseQuantityBtn.onclick = () => {
                let currentQty = parseInt(modalQuantityInput.value);
                let maxStock = parseInt(modalQuantityInput.max);
                if (currentQty < maxStock) {
                    currentQty++; // Increment quantity here
                    modalQuantityInput.value = currentQty; // Update input field
                    updateQuantityButtonsModal(currentQty, maxStock); // Update buttons with new quantity
                } else {
                    window.showToast(`Max stock for this variant is ${maxStock}.`, 'warning');
                }
            };
        }
        if (modalQuantityInput) {
            modalQuantityInput.onchange = () => {
                let currentQty = parseInt(modalQuantityInput.value);
                let maxStock = parseInt(modalQuantityInput.max);
                let minAllowed = parseInt(modalQuantityInput.min);

                if (isNaN(currentQty) || currentQty < minAllowed) {
                    currentQty = minAllowed;
                } else if (currentQty > maxStock) {
                    currentQty = maxStock;
                    window.showToast(`Max stock for this variant is ${maxStock}.`, 'warning');
                }
                modalQuantityInput.value = currentQty;
                updateQuantityButtonsModal(currentQty, maxStock);
            };
        }

        // Event listener for Add to Cart button inside modal
        if (modalAddToCartBtn) {
            modalAddToCartBtn.onclick = async () => {
                const quantity = parseInt(modalQuantityInput.value);
                if (isNaN(quantity) || quantity < 1) {
                    window.showToast('Please enter a valid quantity.', 'warning');
                    return;
                }

                let selectedVariants = [];
                // Only try to get selected variants if the product actually has variants
                if (currentProductInModal.variants && currentProductInModal.variants.length > 0) {
                    selectedVariants = getSelectedVariantsAsArrayModal();
                    if (selectedVariants.length !== currentProductInModal.variants.length) {
                        window.showToast('Please select all variant options.', 'warning');
                        return;
                    }
                }

                // Determine the correct stock for the selected variant combination or base product
                let stockToCheck = currentProductInModal.stock; // Default to base product stock
                if (currentProductInModal.variants && currentProductInModal.variants.length > 0) {
                     stockToCheck = currentCalculatedVariantDetailsModal.totalAvailableStock;
                }

                // Check stock before adding to cart
                if (quantity > stockToCheck) {
                    window.showToast(`Only ${stockToCheck} units available for this item.`, 'warning');
                    return;
                }
                
                if (typeof window.addToCart === 'function') {
                    await window.addToCart(productId, quantity, selectedVariants);
                    productVariantBsModal.hide(); // Hide modal after adding to cart
                } else {
                    console.error('window.addToCart is not defined. Cannot add to cart.');
                    window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }
            };
        }

    }catch (error) {
        console.error('Error opening product variant modal:', error);
        if (modalLoadingSpinner) modalLoadingSpinner.style.display = 'none';
        if (modalContentContainer) modalContentContainer.style.display = 'none';
        productVariantBsModal.hide(); // Hide modal on error
        window.showToast(`Failed to load product details: ${error.message}`, 'danger');
    }
};

/**
 * Helper function to display collections as cards.
 * @param {Array} collections - Array of collection objects.
 * @param {HTMLElement} container - The HTML element to append collection cards to.
 */
window.displayCollections = (collections, container) => {
    if (!container) return;
    container.innerHTML = ''; // Clear loading message

    if (!Array.isArray(collections) || collections.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No collections available.</p></div>';
        return;
    }

    collections.forEach(collection => {
        const collectionImageUrl = collection.imageUrl || 'https://placehold.co/400x300/004d4d/ffffff?text=Collection+Image';
        const collectionDescription = collection.description || 'No description available for this collection.';

        const collectionCardHtml = `
            <a href="collection-detail.html?id=${encodeURIComponent(collection._id)}" class="block bg-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out overflow-hidden group">
                <div class="relative h-48 w-full overflow-hidden">
                    <img src="${collectionImageUrl}" alt="${collection.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';">
                    <div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span class="text-white text-xl font-bold">View Collection</span>
                    </div>
                </div>
                <div class="p-4 flex flex-col items-center text-center">
                    <h3 class="text-xl font-semibold text-gray-800 mb-1">${collection.name}</h3>
                    <p class="text-gray-600 text-sm mb-2 line-clamp-3">${collectionDescription}</p>
                    <button class="cta-button text-sm mt-4 py-2 px-4">View Category</button>
                </div>
            </a>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.classList.add('p-2'); // Add padding for grid gap visuals
        tempDiv.innerHTML = collectionCardHtml;
        container.appendChild(tempDiv.firstElementChild);
    });
};

/**
 * Fetches and displays product collections.
 * @param {string} targetContainerId - The ID of the HTML element where collections should be displayed.
 */
window.fetchAndDisplayCollections = async (targetContainerId = 'collections-container') => {
    const containerToUse = document.getElementById(targetContainerId);
    const initialLoadingSpinner = document.getElementById('initial-loading-spinner-container');

    if (!containerToUse) {
        console.log(`Collections container element #${targetContainerId} not found. Skipping collection display.`);
        return;
    }

    containerToUse.style.display = 'none'; // Hide the collections container initially

    // If it's the main collections container, use the initial spinner
    if (targetContainerId === 'collections-container' && initialLoadingSpinner) {
        initialLoadingSpinner.innerHTML = createLoadingSpinnerHtml('Loading collections...');
        initialLoadingSpinner.style.display = 'flex';
    } else {
        containerToUse.innerHTML = createLoadingSpinnerHtml('Loading collections...');
    }


    try {
        const response = await fetch('http://localhost:3000/api/product-collections', {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        window.displayCollections(data, containerToUse);
    }
   catch (error) {
        console.error('Error fetching collections:', error);
        containerToUse.innerHTML = `<div class="col-span-full text-center"><p class="text-danger">Failed to load collections: ${error.message}</p></div>`;
        window.showToast(`Failed to load collections: ${error.message}`, 'danger');
    } finally {
        // Hide the initial loading spinner and show the container once content is loaded
        if (targetContainerId === 'collections-container' && initialLoadingSpinner) {
            initialLoadingSpinner.style.display = 'none';
        }
        containerToUse.style.display = 'grid'; // Or 'block'
    }
};


// Run functions on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const closeMobileMenuButton = document.getElementById('close-mobile-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

    if (mobileMenuButton && closeMobileMenuButton && mobileMenu && mobileMenuOverlay) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.remove('translate-x-full');
            mobileMenu.classList.add('translate-x-0');
            mobileMenuOverlay.classList.remove('hidden');
        });

        closeMobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.remove('translate-x-0');
            mobileMenu.classList.add('translate-x-full');
            mobileMenuOverlay.classList.add('hidden');
        });

        mobileMenuOverlay.addEventListener('click', () => {
            mobileMenu.classList.remove('translate-x-0');
            mobileMenu.classList.add('translate-x-full');
            mobileMenuOverlay.classList.add('hidden');
        });
    }

    // ✅ NEW: Mobile Filters Sidebar Toggle (إضافة معالجة زر فلاتر الجوال)
    const mobileFilterToggleButton = document.getElementById('mobile-filter-toggle');
    const closeFiltersSidebarButton = document.getElementById('close-filters-sidebar');
    const filtersSidebar = document.getElementById('filters-sidebar');
    const filtersOverlay = document.getElementById('filters-overlay');

    if (mobileFilterToggleButton && closeFiltersSidebarButton && filtersSidebar && filtersOverlay) {
        mobileFilterToggleButton.addEventListener('click', () => {
            filtersSidebar.classList.remove('translate-x-full');
            filtersSidebar.classList.add('mobile-filters-open'); // استخدم الفئة المخصصة لفتح الفلاتر
            filtersOverlay.classList.remove('hidden');
            filtersOverlay.classList.add('block'); // تأكد من إظهار الخلفية
        });

        closeFiltersSidebarButton.addEventListener('click', () => {
            filtersSidebar.classList.remove('mobile-filters-open');
            filtersSidebar.classList.add('translate-x-full'); // إخفاء الفلاتر
            filtersOverlay.classList.remove('block');
            filtersOverlay.classList.add('hidden'); // إخفاء الخلفية
        });

        filtersOverlay.addEventListener('click', () => {
            filtersSidebar.classList.remove('mobile-filters-open');
            filtersSidebar.classList.add('translate-x-full');
            filtersOverlay.classList.remove('block');
            filtersOverlay.classList.add('hidden'); // إخفاء الخلفية
        });
    }


    // Fallback for all images
    document.querySelectorAll('img').forEach(img => {
        img.onerror = function() {
            this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable'; // Generic fallback
        };
    });

    // Initial setup for mini-cart and search modal elements
    const openMiniCartBtn = document.getElementById('open-mini-cart-btn');
    const closeMiniCartBtn = document.getElementById('close-mini-cart-btn');
    const miniCartOverlay = document.getElementById('mini-cart-overlay');
    const miniCartItemsContainer = document.getElementById('mini-cart-items-container');

    // Event listeners for mini-cart
    if (openMiniCartBtn) {
        openMiniCartBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof window.openMiniCart === 'function') {
                await window.openMiniCart();
            } else {
                console.error('window.openMiniCart is not defined. Mini cart might not open.');
            }
        });
    }
    if (closeMiniCartBtn && window.closeMiniCart) {
        closeMiniCartBtn.addEventListener('click', window.closeMiniCart);
    }
    if (miniCartOverlay && window.closeMiniCart) {
        miniCartOverlay.addEventListener('click', window.closeMiniCart);
    }

    // Mini-Cart Event Delegation for quantity and remove buttons
    if (miniCartItemsContainer) {
        miniCartItemsContainer.addEventListener('click', async (event) => {
            if (event.target.classList.contains('quantity-btn-mini-cart') || event.target.closest('.quantity-btn-mini-cart')) {
                const button = event.target.closest('.quantity-btn-mini-cart');
                const productId = button.dataset.productId;
                const itemDiv = button.closest('.mini-cart-item');
                const quantityInput = itemDiv.querySelector('.item-quantity-input-mini-cart');
                let currentQuantity = parseInt(quantityInput.value);
                const maxStock = parseInt(quantityInput.dataset.maxStock);

                const selectedVariants = button.dataset.selectedVariants ? JSON.parse(button.dataset.selectedVariants) : [];

                if (button.dataset.action === 'decrease') {
                    if (currentQuantity > 1) {
                        currentQuantity--;
                    } else {
                        if (window.showToast) window.showToast('Minimum quantity is 1. Click X to delete item.', 'info');
                        return;
                    }
                } else if (button.dataset.action === 'increase') {
                    if (currentQuantity < maxStock) {
                        currentQuantity++;
                    } else {
                        if (window.showToast) window.showToast(`Max stock for this product is ${maxStock}.`, 'warning');
                        return;
                    }
                }

                quantityInput.value = currentQuantity;

                if (typeof window.updateCartItemQuantity === 'function') {
                    await window.updateCartItemQuantity(productId, currentQuantity, selectedVariants);
                } else {
                    console.error('window.updateCartItemQuantity is not defined. Cart quantity might not update.');
                    if (window.showToast) window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }

            } else if (event.target.classList.contains('mini-cart-remove-btn') || event.target.closest('.mini-cart-remove-btn')) {
                const removeButton = event.target.closest('.mini-cart-remove-btn');
                const productId = removeButton.dataset.productId;

                const selectedVariants = removeButton.dataset.selectedVariants
                    ? JSON.parse(removeButton.dataset.selectedVariants)
                    : [];

                if (window.showConfirmationModal && typeof window.removeFromCart === 'function') {
                    window.showConfirmationModal('Are you sure you want to remove this item from your cart?', async () => {
                        await window.removeFromCart(productId, selectedVariants);
                    });
                } else {
                    console.error('window.removeFromCart or window.showConfirmationModal is not defined. Item might not be removed.');
                    if (window.showToast) window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }
            }
        });

        miniCartItemsContainer.addEventListener('input', async (event) => {
            if (event.target.classList.contains('item-quantity-input-mini-cart')) {
                const productId = event.target.dataset.productId;
                let newQuantity = parseInt(event.target.value);
                const maxStock = parseInt(event.target.dataset.maxStock);

                const selectedVariants = event.target.dataset.selectedVariants
                    ? JSON.parse(event.target.dataset.selectedVariants)
                    : [];

                if (isNaN(newQuantity) || newQuantity < 1) {
                    newQuantity = 1;
                }
                if (newQuantity > maxStock) {
                    newQuantity = maxStock;
                    if (window.showToast) window.showToast(`Max stock for this product is ${maxStock}.`, 'warning');
                }
                event.target.value = newQuantity;
                if (typeof window.updateCartItemQuantity === 'function') {
                    await window.updateCartItemQuantity(productId, newQuantity, selectedVariants);
                } else {
                    console.error('window.updateCartItemQuantity is not defined. Cart quantity might not update.');
                    if (window.showToast) window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }
            }
        });
    }

    // Search Modal Logic
    const modalSearchInput = document.getElementById('modalSearchInput');
    const modalTextSearchBtn = document.getElementById('modalTextSearchBtn');
    const imageSearchInput = document.getElementById('imageSearchInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
    const modalImageSearchBtn = document.getElementById('modalImageSearchBtn');

    if (modalSearchInput && modalTextSearchBtn) {
        modalTextSearchBtn.addEventListener('click', () => {
            const searchTerm = modalSearchInput.value.trim();
            if (searchTerm) {
                window.location.href = `products.html?search=${encodeURIComponent(searchTerm)}`;
            } else {
                window.showToast('Please enter a search term.', 'warning');
            }
        });

        modalSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                modalTextSearchBtn.click();
            }
        });
    }

    if (imageSearchInput && imagePreview && imagePreviewContainer && modalImageSearchBtn && imagePreviewPlaceholder) {
        // Update image preview placeholder to use spinner
        imagePreviewContainer.innerHTML = `<div id="imagePreviewPlaceholder" class="text-muted mt-2">No image selected</div><img id="imagePreview" src="#" alt="Image Preview" class="img-fluid" style="max-height: 150px; display: none;">`; // Re-add placeholder HTML
        const currentImagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
        const currentImagePreview = document.getElementById('imagePreview');

        currentImagePreview.style.display = 'none'; // Hide image initially
        currentImagePreviewPlaceholder.style.display = 'block'; // Show placeholder initially

        imageSearchInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentImagePreview.src = e.target.result;
                    imagePreviewContainer.style.display = 'block';
                    currentImagePreview.style.display = 'block'; // Make sure the image itself is visible
                    currentImagePreviewPlaceholder.style.display = 'none'; // Hide the placeholder
                    modalImageSearchBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            } else {
                currentImagePreview.src = '#';
                currentImagePreview.style.display = 'none'; // Hide the image
                currentImagePreviewPlaceholder.style.display = 'block'; // Show the placeholder
                imagePreviewContainer.style.display = 'block'; // Keep container visible but show placeholder
                modalImageSearchBtn.disabled = true;
            }
        });

        modalImageSearchBtn.addEventListener('click', async () => {
            const file = imageSearchInput.files[0];
            if (!file) {
                window.showToast('Please select an image to search by.', 'warning');
                return;
            }

            window.showToast('Searching by image...', 'info');
            modalImageSearchBtn.disabled = true;
            const originalButtonText = modalImageSearchBtn.innerHTML;
            
            // ✅ MODIFIED: Use custom loading icon for the button
            const iconPath = '/loading.png'; // Make sure this path is correct
            modalImageSearchBtn.innerHTML = `
                <img src="${iconPath}" alt="Loading" class="loading-custom-icon" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle; display: inline-block;">
                Searching...
            `;


            const formData = new FormData();
            formData.append('image', file);

            try {
                const response = await fetch('http://localhost:3000/api/products/search-by-image', {
                    method: 'POST',
                    headers: {
                        'Authorization': window.currentAuthToken ? `Bearer ${window.currentAuthToken}` : undefined,
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    window.showToast('Image search completed!', 'success');
                    const productIds = data.products.map(p => p._id).join(',');
                    if (productIds) {
                        window.location.href = `products.html?imageSearchIds=${encodeURIComponent(productIds)}`;
                    } else {
                        window.showToast('No similar products found.', 'info');
                        window.location.href = `products.html?search=no_results_image_search`;
                    }

                } else {
                    throw new Error(data.message || 'Image search failed.');
                }

            }catch (error) {
                console.error('Image search error:', error);
                window.showToast(`Image search failed: ${error.message}`, 'danger');
            } finally {
                modalImageSearchBtn.disabled = false;
                modalImageSearchBtn.innerHTML = originalButtonText;
                const searchModal = bootstrap.Modal.getInstance(document.getElementById('searchModal'));
                if (searchModal) {
                    searchModal.hide();
                }
            }
        });
    }

    // Initialize Carousels (Hero, Promo, Product, Gallery)
    // All setupCarousel calls are now inside initializeCustomCarousel, so remove direct calls here.
    // The default carousel setup (e.g. for productCarousel) will happen in fetchTopPicksProducts etc.

    // Fetch and initialize dynamic content for the homepage
    await window.fetchAndDisplayCategories(6, 'featured-categories-container', true);
    await fetchHeroSlidesForCarousel();
    await fetchPromoSlidesForCarousel();

    // NEW: Call functions for new carousel sections
    await fetchNewArrivals();
    await fetchBestSellers();
    await fetchQuickDeals(); // Placeholder for actual deals logic

    await fetchTopPicksProducts(); // Call this after new product carousels, as it might use common logic
                                  // Its setupCarousel will also be moved inside initializeCustomCarousel

    await fetchGalleryImages(); // Call this after other content, as it might use common logic

    // REMOVED: No longer fetching customer testimonials as the section is removed
    // await fetchCustomerTestimonials();

    await window.updateNavbar();

    // Add periodic refresh for content sections
    setInterval(fetchTopPicksProducts, 5 * 60 * 1000);
    setInterval(fetchGalleryImages, 5 * 60 * 1000);
    setInterval(fetchHeroSlidesForCarousel, 5 * 60 * 1000);
    setInterval(fetchPromoSlidesForCarousel, 5 * 60 * 1000);
    // NEW: Add periodic refresh for new product carousels
    setInterval(fetchNewArrivals, 5 * 60 * 1000);
    setInterval(fetchBestSellers, 5 * 60 * 1000);
    setInterval(fetchQuickDeals, 5 * 60 * 1000);


    // Handle products.html specific logic if on that page
    if (window.location.pathname.includes('products.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const initialFilters = {
            search: urlParams.get('search') || '',
            category: urlParams.get('category') || 'All',
            minPrice: urlParams.get('minPrice') || '',
            maxPrice: urlParams.get('maxPrice') || '',
            sort: urlParams.get('sort') || '',
            page: urlParams.get('page') || '1'
        };

        const searchInput = document.getElementById('searchInput');
        const categoryFilter = document.getElementById('categoryFilter');
        const minPriceInput = document.getElementById('minPriceInput');
            const maxPriceInput = document.getElementById('maxPriceInput');
            const sortFilter = document.getElementById('sortFilter');
            const applyFiltersBtn = document.getElementById('applyFiltersBtn');
            const clearFiltersBtn = document.getElementById('clearFiltersBtn');
            const clearSearchBtn = document.getElementById('clearSearchBtn');


            if (searchInput) {
                searchInput.value = initialFilters.search;
            }
            if (categoryFilter) {
                window.populateCategoriesDropdown(categoryFilter); // Populate filter dropdown
                categoryFilter.value = initialFilters.category;
            }
            if (minPriceInput) minPriceInput.value = initialFilters.minPrice;
            if (maxPriceInput) maxPriceInput.value = initialFilters.maxPrice;
            if (sortFilter) sortFilter.value = initialFilters.sort;

            window.fetchProducts(initialFilters);

            if (applyFiltersBtn) {
                applyFiltersBtn.addEventListener('click', () => {
                    window.applyProductFilters();
                });
            }

            if (clearFiltersBtn) {
                clearFiltersBtn.addEventListener('click', () => {
                    if (searchInput) searchInput.value = '';
                    if (categoryFilter) categoryFilter.value = 'All';
                    if (minPriceInput) minPriceInput.value = '';
                    if (maxPriceInput) minPriceInput.value = '';
                    document.querySelectorAll('.variant-checkbox').forEach(checkbox => checkbox.checked = false);

                    if (sortFilter) sortFilter.value = '';

                    const url = new URL(window.location.href);
                    url.searchParams.delete('category');
                    url.searchParams.delete('search');
                    url.searchParams.delete('minPrice');
                    url.searchParams.delete('maxPrice');
                    url.searchParams.delete('sort');
                    url.searchParams.delete('page');
                    url.searchParams.delete('variants');
                    window.history.replaceState({}, document.title, url.toString());

                    window.fetchProducts({});
                });
            }

            if(clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    if (searchInput) searchInput.value = '';
                    window.applyProductFilters();
                });
            }
        }

        // Handle login/register form submissions if on those pages
        const loginForm = document.getElementById('login-form');
        if (loginForm && typeof window.handleLoginFormSubmit === 'function') {
            loginForm.addEventListener('submit', window.handleLoginFormSubmit);
        } else if (loginForm) {
            console.warn('Login form found, but window.handleLoginFormSubmit is not defined.');
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm && typeof window.handleRegisterFormSubmit === 'function') {
            registerForm.addEventListener('submit', window.handleRegisterFormSubmit);
        } else if (registerForm) {
            console.warn('Register form found, but window.handleRegisterFormSubmit is not defined.');
        }

        // Attach event listener for newsletter form
        const newsletterForm = document.getElementById('newsletter-form');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', handleNewsletterSubmission);
        }

        // Handle categories.html specific logic
        if (window.location.pathname.includes('categories.html')) {
            if (typeof window.fetchAndDisplayCategories === 'function') {
                window.fetchAndDisplayCategories(null, 'all-categories-container'); // Fetch all categories
            } else {
                console.warn('window.fetchAndDisplayCategories is not defined. All categories might not load.');
            }
        }

        // ✅ NEW: Handle collections.html specific logic
        if (window.location.pathname.includes('collections.html')) {
            if (typeof window.fetchAndDisplayCollections === 'function') {
                window.fetchAndDisplayCollections('collections-container'); // Fetch and display all collections
            } else {
                console.warn('window.fetchAndDisplayCollections is not defined. Collections might not load.');
            }
        }

        // Initialize the product variant modal once here
        const productVariantModalElement = document.getElementById('productVariantModal');
        if (productVariantModalElement) {
            productVariantBsModal = new bootstrap.Modal(productVariantModalElement);
            // Add a listener for the hidden event to clean up after the modal closes
            productVariantModalElement.addEventListener('hidden.bs.modal', function () {
                console.log("Product variant modal hidden event fired. Clearing data.");
                currentProductInModal = null;
                selectedVariantsMapModal = {};
                currentCalculatedVariantDetailsModal = {
                    totalAvailableStock: 0,
                    combinedPriceAdjustment: 0,
                    combinedImageUrl: ''
                };
                // Optionally clear dynamic content here if needed
                const modalVariantSelectors = document.getElementById('modalVariantsSection'); // Corrected ID usage
                if (modalVariantSelectors) modalVariantSelectors.innerHTML = '';
                // Reset quantity input to 1
                const modalQuantityInput = document.getElementById('modalQuantityInput');
                if (modalQuantityInput) {
                    modalQuantityInput.value = 1;
                    updateQuantityButtonsModal(1, 0); // Reset buttons based on default 1 qty, 0 max stock
                }
            });
        }
    });