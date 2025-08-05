// public/js/wishlist.js
document.addEventListener('DOMContentLoaded', async () => {
    const wishlistItemsContainer = document.getElementById('wishlist-items-container');

    if (!wishlistItemsContainer) {
        console.warn("Wishlist items container not found. Skipping wishlist script execution.");
        return;
    }

    // Redirect to login if user is not logged in
    if (!window.isLoggedIn()) {
        window.showToast('Please log in to view your wishlist.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // Function to fetch and display wishlist items
    async function fetchWishlist() {
        wishlistItemsContainer.innerHTML = '<p class="text-center text-muted py-5">Loading your wishlist...</p>';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

        try {
            const response = await fetch('http://localhost:3000/api/wishlist', {
                headers: window.getAuthHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorData = { message: 'Failed to fetch wishlist due to unknown error.' };
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    console.error("Failed to parse JSON error response for wishlist fetch:", jsonError);
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const wishlist = await response.json();
            displayWishlist(wishlist);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.error('Error fetching wishlist: Request timed out.', error);
                wishlistItemsContainer.innerHTML = '<p class="text-center text-danger py-5">Failed to load wishlist: Request timed out. Please try again.</p>';
                window.showToast('Failed to load wishlist: Request timed out.', 'danger');
            } else {
                console.error('Error fetching wishlist:', error);
                wishlistItemsContainer.innerHTML = `<p class="text-center text-danger py-5">Failed to load wishlist: ${error.message}</p>`;
                window.showToast(`Failed to load wishlist: ${error.message}`, 'danger');
            }
        }
    }

    // Function to display wishlist items in the HTML
    function displayWishlist(wishlist) {
        wishlistItemsContainer.innerHTML = '';

        if (!wishlist || wishlist.length === 0) {
            wishlistItemsContainer.innerHTML = `
                <div class="text-center py-5">
                    <i class="far fa-heart fa-5x text-gray-400 mb-3"></i> <p class="text-lg md:text-xl text-gray-600">Your wishlist is empty.</p> <a href="index.html" class="cta-button py-3 px-8 text-lg mt-3 inline-flex items-center"> <i class="fas fa-shopping-bag me-2"></i>Start Shopping
                    </a>
                </div>
            `;
            return;
        }

        wishlist.forEach(product => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('wishlist-item', 'flex', 'items-center', 'py-4', 'border-b', 'border-gray-200', 'last:border-b-0'); // Replaced d-flex, align-items-center, py-3, border-bottom
            itemDiv.dataset.productId = product._id;

            itemDiv.innerHTML = `
                <div class="flex-shrink-0 mr-4"> <img src="${product.imageUrl}" alt="${product.name}" class="w-20 h-20 object-cover rounded-lg shadow-sm" onerror="this.onerror=null;this.src='https://placehold.co/80x80/cbd5e0/4a5568?text=No+Image';"> </div>
                <div class="flex-grow-1">
                    <h5 class="mb-1 text-lg font-semibold text-gray-800"> <a href="product-detail.html?id=${product._id}" class="text-gray-800 hover:text-[#008080] no-underline">${product.name}</a> </h5>
                    <p class="text-sm text-gray-600 mb-1">${product.category}</p> <p class="font-bold text-gray-900 mb-0">Price: EGP${product.price.toFixed(2)}</p> </div>
                <div class="flex items-center ml-auto"> <button class="bg-[#008080] text-white py-2 px-4 rounded-md hover:bg-[#006666] transition duration-300 text-sm add-to-cart-from-wishlist-btn" data-product-id="${product._id}" data-product-name="${product.name}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-300 text-sm remove-from-wishlist-btn ml-2" data-product-id="${product._id}"> <i class="fas fa-trash-alt"></i> Remove
                    </button>
                </div>
            `;
            wishlistItemsContainer.appendChild(itemDiv);
        });

        // Add event listeners for buttons
        wishlistItemsContainer.querySelectorAll('.add-to-cart-from-wishlist-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation(); // Prevent click from bubbling up to parent <a> if it existed
                const productId = button.dataset.productId;
                const productName = button.dataset.productName;
                // Use the global window.addToCart function
                if (typeof window.addToCart === 'function') {
                    // Assuming no variants are selected when adding from wishlist directly
                    await window.addToCart(productId, 1, []);
                } else {
                    console.error('window.addToCart is not defined. Cannot add to cart from wishlist.');
                    window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                }
            });
        });

        wishlistItemsContainer.querySelectorAll('.remove-from-wishlist-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation(); // Prevent click from bubbling up
                const productId = button.dataset.productId;
                await removeProductFromWishlist(productId);
            });
        });
    }

    // Function to remove item from wishlist
    async function removeProductFromWishlist(productId) {
        // Using window.confirm instead of a custom modal for this simple case
        if (!window.confirm('Are you sure you want to remove this item from your wishlist?')) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

        try {
            const response = await fetch(`http://localhost:3000/api/wishlist/${productId}`, {
                method: 'DELETE',
                headers: window.getAuthHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorData = { message: 'Failed to remove item from wishlist due to unknown error.' };
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    console.error("Failed to parse JSON error response for remove from wishlist:", jsonError);
                }
                throw new Error(errorData.message || 'Failed to remove item from wishlist.');
            }

            window.showToast('Item removed from wishlist!', 'success');
            await fetchWishlist(); // Refresh wishlist after removal
            // Check wishlist status on product detail page if active, typically from product-detail.js
            if (window.checkWishlistStatus) { 
                 const currentProductId = new URLSearchParams(window.location.search).get('id');
                 if (currentProductId === productId) {
                    window.checkWishlistStatus(productId);
                 }
            }

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.error('Error removing from wishlist: Request timed out.', error);
                window.showToast('Failed to remove item: Request timed out.', 'danger');
            } else {
                console.error('Error removing from wishlist:', error);
                window.showToast(`Failed to remove item: ${error.message}`, 'danger');
            }
        }
    }

    // Initial fetch of wishlist items when the page loads
    fetchWishlist();
});