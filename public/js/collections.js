// public/js/collections.js

/**
 * Fetches product collections based on filters and displays them.
 * @param {Object} filters - An object containing search, sort, and page filters.
 */
window.fetchCollections = async (filters = {}) => {
    const collectionsContainer = document.getElementById('collections-container');
    if (!collectionsContainer) {
        console.log('Collections container element not found. Skipping collection fetch.');
        return;
    }

    // Use global spinner helper from main.js
    collectionsContainer.innerHTML = window.createLoadingSpinnerHtml('Loading collections...'); 

    try {
        let url = new URL('http://localhost:3000/api/product-collections'); // API endpoint for collections

        // Add filters to URL search params
        for (const key in filters) {
            if (filters[key] !== '' && filters[key] !== undefined && filters[key] !== null) {
                url.searchParams.set(key, filters[key]);
            } else {
                url.searchParams.delete(key);
            }
        }

        // Update URL in browser history
        const currentUrl = new URL(window.location.href);
        for (const key in filters) {
            if (filters[key] !== '' && filters[key] !== undefined && filters[key] !== null) {
                currentUrl.searchParams.set(key, filters[key]);
            } else {
                currentUrl.searchParams.delete(key);
            }
        }
        window.history.replaceState({}, '', currentUrl.toString());

        const response = await fetch(url.toString(), {
            headers: window.getAuthHeaders()
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        const collections = data.collections;
        const totalPages = data.totalPages;
        const currentPage = data.currentPage;

        displayCollectionCards(collections); // ✅ تم تغيير الاستدعاء هنا من window.displayCollections
        renderCollectionPagination(totalPages, currentPage); // Render pagination

    } catch (error) {
        console.error('Error fetching collections:', error);
        collectionsContainer.innerHTML = `<div class="col-span-full text-center"><p class="text-danger">Failed to load collections: ${error.message}</p></div>`;
        window.showToast(`Failed to load collections: ${error.message}`, 'danger');
    }
};

/**
 * Displays product collections in the specified container.
 * @param {Array} collections - Array of product collection objects.
 */
function displayCollectionCards(collections) { 
    const collectionsContainer = document.getElementById('collections-container');
    if (!collectionsContainer) return;

    collectionsContainer.innerHTML = ''; // Clear loading message

    if (!Array.isArray(collections) || collections.length === 0) {
        collectionsContainer.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No collections available matching your criteria.</p></div>';
        return;
    }

    collections.forEach(collection => {
        const collectionImageUrl = collection.imageUrl || 'https://placehold.co/600x400/004d4d/ffffff?text=Collection+Image';
        const collectionDescription = collection.description || 'No description available for this collection.';

        const collectionCardHtml = `
            <a href="collection-detail.html?id=${collection._id}" class="block bg-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out overflow-hidden group">
                <div class="relative h-48 w-full overflow-hidden">
                    <img src="${collectionImageUrl}" alt="${collection.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" onerror="this.onerror=null;this.src='https://placehold.co/600x400/cbd5e0/4a5568?text=Image+Unavailable';">
                    <div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span class="text-white text-xl font-bold">View Collection</span>
                    </div>
                </div>
                <div class="p-4 flex flex-col items-center text-center">
                    <h3 class="text-xl font-semibold text-gray-800 mb-1">${collection.name}</h3>
                    <p class="text-gray-600 text-sm mb-2 line-clamp-3">${collectionDescription}</p>
                    <button class="cta-button text-sm mt-4 py-2 px-4">View Collection</button>
                </div>
            </a>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.classList.add('p-2'); // Add padding for grid gap visuals
        tempDiv.innerHTML = collectionCardHtml;
        collectionsContainer.appendChild(tempDiv.firstElementChild);
    });
};

/**
 * Renders pagination controls for collections.
 * @param {number} totalPages - Total number of pages.
 * @param {number} currentPage - Current active page.
 */
function renderCollectionPagination(totalPages, currentPage) {
    const collectionsPagination = document.getElementById('collections-pagination');
    if (!collectionsPagination) return;
    collectionsPagination.innerHTML = '';

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
                window.applyCollectionFilters(pageNumber);
            }
        });
        li.appendChild(a);
        return li;
    };

    collectionsPagination.appendChild(createPaginationItem(currentPage - 1, 'Previous', false, currentPage === 1));

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (endPage - startPage < 4) {
        if (startPage === 1) endPage = Math.min(totalPages, 5);
        else if (endPage === totalPages) startPage = Math.max(1, totalPages - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        collectionsPagination.appendChild(createPaginationItem(i, i.toString(), i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            collectionsPagination.appendChild(createPaginationItem(null, '...', false, true));
        }
        collectionsPagination.appendChild(createPaginationItem(totalPages, totalPages.toString()));
    }

    collectionsPagination.appendChild(createPaginationItem(currentPage + 1, 'Next', false, currentPage === totalPages));
}

/**
 * Applies collection filters and re-fetches collections.
 * @param {number} page - The page number to fetch.
 */
window.applyCollectionFilters = (page = 1) => {
    const searchInput = document.getElementById('searchInput');
    const sortFilter = document.getElementById('sortFilter');

    const filters = {
        search: searchInput ? searchInput.value : '',
        sort: sortFilter ? sortFilter.value : '',
        page: page
    };

    window.fetchCollections(filters);
};

document.addEventListener('DOMContentLoaded', async () => {
    // Initial fetch of collections on page load
    const urlParams = new URLSearchParams(window.location.search);
    const initialFilters = {
        search: urlParams.get('search') || '',
        sort: urlParams.get('sort') || '',
        page: urlParams.get('page') || '1'
    };

    const searchInput = document.getElementById('searchInput');
    const sortFilter = document.getElementById('sortFilter');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.value = initialFilters.search;
    }
    if (sortFilter) {
        sortFilter.value = initialFilters.sort;
    }

    // Fetch collections with initial filters
    window.fetchCollections(initialFilters); // استدعاء لجلب الكوليكشن

    // Event listeners for filters
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            window.applyCollectionFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (sortFilter) sortFilter.value = '';

            const url = new URL(window.location.href);
            url.searchParams.delete('search');
            url.searchParams.delete('sort');
            url.searchParams.delete('page');
            window.history.replaceState({}, document.title, url.toString());

            window.fetchCollections({});
        });
    }

    if(clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            window.applyCollectionFilters();
        });
    }

    // Mobile Filters Sidebar Toggle (نفس منطق صفحة المنتجات)
    const mobileFilterToggleButton = document.getElementById('mobile-filter-toggle');
    const closeFiltersSidebarButton = document.getElementById('close-filters-sidebar');
    const filtersSidebar = document.getElementById('filters-sidebar');
    const filtersOverlay = document.getElementById('filters-overlay');

    if (mobileFilterToggleButton && closeFiltersSidebarButton && filtersSidebar && filtersOverlay) {
        mobileFilterToggleButton.addEventListener('click', () => {
            filtersSidebar.classList.remove('translate-x-full');
            filtersSidebar.classList.add('mobile-filters-open');
            filtersOverlay.classList.remove('hidden');
            filtersOverlay.classList.add('block');
        });

        closeFiltersSidebarButton.addEventListener('click', () => {
            filtersSidebar.classList.remove('mobile-filters-open');
            filtersSidebar.classList.add('translate-x-full');
            filtersOverlay.classList.remove('block');
            filtersOverlay.classList.add('hidden');
        });

        filtersOverlay.addEventListener('click', () => {
            filtersSidebar.classList.remove('mobile-filters-open');
            filtersSidebar.classList.add('translate-x-full');
            filtersOverlay.classList.remove('block');
            filtersOverlay.classList.add('hidden');
        });
    }

    // تم إزالة هذه الاستدعاءات لأن main.js هو من يجب أن يديرها بشكل عام
    // وليس هذا الملف المحدد للصفحة
    // if (typeof window.updateNavbar === 'function') {
    //     await window.updateNavbar();
    // }
    // if (typeof window.updateCartCount === 'function') {
    //     await window.updateCartCount();
    // }
    // if (typeof window.updateNotificationCount === 'function') {
    //     await window.updateNotificationCount();
    // }
});