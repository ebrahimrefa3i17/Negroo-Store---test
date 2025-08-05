document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const collectionId = urlParams.get('id');

    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const collectionHeroSection = document.getElementById('collection-hero-section'); // NEW: Hero section
    const collectionDetailContent = document.getElementById('collection-detail-content'); // Main content area

    const collectionHeroName = document.getElementById('collection-hero-name'); // NEW: Hero name element
    const collectionHeroDescription = document.getElementById('collection-hero-description'); // NEW: Hero description element

    const collectionProductsContainer = document.getElementById('collection-products-container');
    const pageTitleElement = document.getElementById('page-title'); // For updating the document title

    if (!collectionId) {
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (errorMessage) {
            errorMessage.textContent = 'Collection ID not found in URL.';
            errorMessage.style.display = 'block';
        }
        window.showToast('Collection ID is missing from URL.', 'danger');
        return;
    }

    async function fetchCollectionDetails(id) {
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        if (collectionHeroSection) collectionHeroSection.style.display = 'none'; // Ensure hero is hidden initially
        if (collectionDetailContent) collectionDetailContent.style.display = 'none'; // Ensure main content is hidden initially
        
        try {
            const response = await fetch(`http://localhost:3000/api/product-collections/${id}`, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                let errorMessageText = data.message || `HTTP error! status: ${response.status}`;
                if (response.status === 404) {
                    errorMessageText = 'Collection not found.';
                }
                throw new Error(errorMessageText);
            }

            const collection = data;
            
            // Update page title
            if (pageTitleElement) pageTitleElement.textContent = `${collection.name} - Negroo Store`;

            // Populate Hero Section
            if (collectionHeroSection) {
                collectionHeroSection.style.backgroundImage = `url('${collection.imageUrl || 'https://placehold.co/1920x600/004d4d/ffffff?text=Collection+Hero'}')`;
                collectionHeroSection.style.display = 'flex'; // Show the hero section
            }
            if (collectionHeroName) collectionHeroName.textContent = collection.name || 'Unknown Collection';
            if (collectionHeroDescription) collectionHeroDescription.textContent = collection.description || 'No description available for this collection.';

            // Render products in the collection
            renderCollectionProducts(collection.products);

            // Hide loading/error messages and show main content
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (collectionDetailContent) collectionDetailContent.style.display = 'block'; // Show main content area

        } catch (error) {
            console.error('Error fetching collection details:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (errorMessage) {
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
            window.showToast(`Failed to load collection: ${error.message}`, 'danger');
            // Ensure hero and content are hidden on error
            if (collectionHeroSection) collectionHeroSection.style.display = 'none';
            if (collectionDetailContent) collectionDetailContent.style.display = 'none';
        }
    }

    function renderCollectionProducts(products) {
        if (!collectionProductsContainer) return;
        collectionProductsContainer.innerHTML = ''; // Clear previous items

        if (!Array.isArray(products) || products.length === 0) {
            collectionProductsContainer.innerHTML = '<div class="col-span-full text-center"><p class="text-muted">No products found in this collection.</p></div>';
            return;
        }

        products.forEach(product => {
            const productCol = document.createElement('div');
            // ✅ MODIFIED: Removed explicit width classes (w-full, sm:w-1/2, etc.)
            // The parent grid (collection-products-container) already handles column sizing.
            // Keeping 'p-2' for padding around each card.
            productCol.classList.add('p-2'); 

            // Reusing product card HTML structure from main.js if available, or define here
            if (typeof window.createProductCardHtml === 'function') {
                productCol.innerHTML = window.createProductCardHtml(product);
                collectionProductsContainer.appendChild(productCol);

                // Attach event listener for "Add to Cart" button within this product card
                const addToCartBtn = productCol.querySelector('.add-to-cart-btn');
                if (addToCartBtn) {
                    addToCartBtn.addEventListener('click', async (event) => {
                        event.preventDefault(); // Prevent default action of parent <a>
                        event.stopPropagation(); // Prevent the click from propagating to the parent <a> tag
                        const productId = event.target.dataset.productId;
                        const hasVariants = event.target.dataset.productHasVariants === 'true';
                        
                        console.log('Add to Cart button clicked for product ID (from collection):', productId, 'Has Variants:', hasVariants);

                        if (hasVariants) {
                            // Use the global modal function defined in main.js
                            if (typeof window.openProductVariantModal === 'function') {
                                window.openProductVariantModal(productId);
                            } else {
                                console.error('window.openProductVariantModal is not defined. Cannot open variant modal.');
                                window.showToast('Error: Variant selection not available. Please refresh the page.', 'danger');
                            }
                        } else {
                            // Use the global addToCart function defined in cart.js
                            if (typeof window.addToCart === 'function') {
                                await window.addToCart(productId, 1, []); // No variants, quantity 1
                            } else {
                                console.error('window.addToCart is not defined. Cannot add to cart.');
                                window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
                            }
                        }
                    });
                }
            } else {
                console.warn('window.createProductCardHtml is not defined. Cannot render product card in collection.');
                collectionProductsContainer.innerHTML = '<div class="col-span-full text-center text-danger">Error: Product card renderer not available.</div>';
            }
        });
    }

    // Call fetchCollectionDetails on page load
    fetchCollectionDetails(collectionId);
});
