document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const productDetailContent = document.getElementById('product-detail-content');

    const productMainImage = document.getElementById('product-main-image');
    const mainImageWrapper = document.getElementById('main-image-wrapper');
    const thumbnailGallery = document.getElementById('thumbnail-gallery');
    const productName = document.getElementById('product-name');
    const productPrice = document.getElementById('product-price');
    const productShortDescription = document.getElementById('product-short-description');
    const productLongDescription = document.getElementById('product-long-description');
    const productCategory = document.getElementById('product-category');
    const productStock = document.getElementById('product-stock');
    const quantityInput = document.getElementById('quantity');
    const addToCartDetailBtn = document.getElementById('add-to-cart-detail-btn');
    const decreaseQuantityBtn = document.getElementById('decrease-quantity-btn');
    const increaseQuantityBtn = document.getElementById('increase-quantity-btn');
    const addToWishlistBtn = document.getElementById('add-to-wishlist-btn');
    const buyNowBtn = document.getElementById('buy-now-btn');

    const productSpecsDisplay = document.getElementById('product-specs');
    const productShippingReturnsDisplay = document.getElementById('product-shipping-returns');

    const ratingSummary = document.getElementById('rating-summary');
    const avgStarsSpan = document.getElementById('avg-stars');
    const reviewsCountSpan = document.getElementById('reviews-count');
    const addReviewForm = document.getElementById('add-review-form');
    const ratingInput = document.getElementById('rating-input');
    const selectedRatingInput = document.getElementById('selected-rating');
    const commentInput = document.getElementById('comment');
    const reviewsListContainer = document.getElementById('reviews-list-container');
    const reviewFormMessage = document.getElementById('review-form-message');

    const relatedProductsSection = document.getElementById('related-products-section');
    const relatedProductsContainer = document.getElementById('related-products-container');

    const shareFacebookBtn = document.getElementById('share-facebook-btn');
    const shareTwitterBtn = document.getElementById('share-twitter-btn');
    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');

    const productVariantsSection = document.getElementById('product-variants-section');
    let currentProductData = null; // Store fetched product data
    let selectedVariantsMap = {}; // Stores { groupName: optionValue, ... } for current selection from UI
    let currentCalculatedVariantDetails = { // Stores combined details for selected variant combination
        totalAvailableStock: 0,
        combinedPriceAdjustment: 0,
        combinedImageUrl: ''
    };


    if (!productId) {
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (errorMessage) {
            errorMessage.textContent = 'Product ID not found in URL.';
            errorMessage.style.display = 'block';
        }
        window.showToast('Product ID is missing from URL.', 'danger');
        return;
    }

    // Function to fetch product details
    async function fetchProductDetails(id) {
        if (loadingMessage) loadingMessage.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        if (productDetailContent) productDetailContent.style.display = 'none';
        if (relatedProductsSection) relatedProductsSection.style.display = 'none';

        try {
            const response = await fetch(`http://localhost:3000/api/products/single/${id}`, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                let errorMessageText = data.message || `HTTP error! status: ${response.status}`;
                if (response.status === 404) {
                    errorMessageText = 'Product not found.';
                }
                throw new Error(errorMessageText);
            }

            const product = data;
            currentProductData = product;

            if (productName) productName.textContent = product.name || 'N/A';
            // Keep original description for long description, use substring for short
            if (productShortDescription) productShortDescription.textContent = (product.shortDescription || product.description && product.description.substring(0, 150) + '...') || 'No short description available.';
            if (productLongDescription) productLongDescription.innerHTML = product.description || 'No detailed description available.';
            if (productCategory) productCategory.textContent = product.category ? product.category.name : 'Uncategorized'; // Access category.name

            if (productSpecsDisplay) productSpecsDisplay.innerHTML = (product.specifications || 'No specifications available.').replace(/\n/g, '<br>');
            if (productShippingReturnsDisplay) productShippingReturnsDisplay.innerHTML = (product.shippingAndReturns || 'Standard shipping and returns information.').replace(/\n/g, '<br>');


            if (product.variants && product.variants.length > 0) {
                if (productVariantsSection) productVariantsSection.style.display = 'block';
                renderVariantSelectors(product.variants);
                product.variants.forEach(group => {
                    if (group.options && group.options.length > 0) {
                        selectedVariantsMap[group.name] = group.options[0].value;
                    }
                });
                updateProductDisplayBasedOnVariants();
            } else {
                if (productVariantsSection) productVariantsSection.style.display = 'none';
                if (productMainImage) productMainImage.src = product.imageUrl || '/images/placeholder.jpg';
                if (productPrice) productPrice.textContent = `EGP${(product.price || 0).toFixed(2)}`;
                if (productStock) productStock.textContent = (product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock');
                if (quantityInput) quantityInput.max = product.stock || 0;
                
                const isAvailable = product.stock > 0;
                if (addToCartDetailBtn) {
                    addToCartDetailBtn.disabled = !isAvailable;
                    addToCartDetailBtn.textContent = isAvailable ? 'Add to Cart' : 'Out of Stock';
                }
                if (buyNowBtn) buyNowBtn.disabled = !isAvailable;
                updateQuantityButtons(parseInt(quantityInput.value), product.stock);
            }

            updateThumbnailGallery(product);

            // ✅ MODIFIED: Added event listener to reset zoom when main image changes
            if (productMainImage) {
                productMainImage.addEventListener('load', () => {
                    // Reset zoom when a new image is loaded into main image
                    if (mainImageWrapper) {
                        productMainImage.style.transform = 'scale(1)';
                        productMainImage.style.transformOrigin = 'center center';
                    }
                });
            }

            if (mainImageWrapper && productMainImage) {
                mainImageWrapper.addEventListener('mousemove', (e) => {
                    const { left, top, width, height } = mainImageWrapper.getBoundingClientRect();
                    const x = (e.clientX - left) / width * 100;
                    const y = (e.clientY - top) / height * 100;
                    productMainImage.style.transformOrigin = `${x}% ${y}%`;
                });
                mainImageWrapper.addEventListener('mouseenter', () => {
                    productMainImage.style.transform = 'scale(1.5)';
                });
                mainImageWrapper.addEventListener('mouseleave', () => {
                    productMainImage.style.transform = 'scale(1)';
                    productMainImage.style.transformOrigin = 'center center';
                });
            }

            // ✅ NEW: Add event listeners to re-populate accordion content when shown
            const productDetailsAccordion = document.getElementById('productDetailsAccordion');
            if (productDetailsAccordion) {
                productDetailsAccordion.querySelectorAll('.accordion-collapse').forEach(collapseElement => {
                    collapseElement.addEventListener('shown.bs.collapse', () => {
                        const panelId = collapseElement.id;
                        if (panelId === 'collapseOne' && productLongDescription) {
                            productLongDescription.innerHTML = product.description || 'No detailed description available.';
                        } else if (panelId === 'collapseTwo' && productSpecsDisplay) {
                            productSpecsDisplay.innerHTML = (product.specifications || 'No specifications available.').replace(/\n/g, '<br>');
                        } else if (panelId === 'collapseThree' && productShippingReturnsDisplay) {
                            productShippingReturnsDisplay.innerHTML = (product.shippingAndReturns || 'Standard shipping and returns information.').replace(/\n/g, '<br>');
                        }
                    });
                });
            }


            if (loadingMessage) loadingMessage.style.display = 'none';
            if (productDetailContent) productDetailContent.style.display = 'flex';

            fetchRelatedProducts(productId); // Call the new fetch function
            fetchAndDisplayReviews(productId);
            checkWishlistStatus(productId);

            const productShareUrl = window.location.href;
            const productShareText = `Check out this amazing product: ${product.name || 'Product'} at Negroo Store!`;

            if (shareFacebookBtn) {
                shareFacebookBtn.onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productShareUrl)}`, '_blank');
            }
            if (shareTwitterBtn) {
                shareTwitterBtn.onclick = () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(productShareUrl)}&text=${encodeURIComponent(productShareText)}`, '_blank');
            }
            if (shareWhatsappBtn) {
                shareWhatsappBtn.onclick = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(productShareText + ' ' + productShareUrl)}`, '_blank');
            }
        } catch (error) {
            console.error('Error fetching product details:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (errorMessage) {
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
            window.showToast(`Failed to load product: ${error.message}`, 'danger');
        }
    }

    function renderVariantSelectors(variants) {
        if (!productVariantsSection) return;
        productVariantsSection.innerHTML = '';

        variants.forEach((group, index) => {
            if (!group.options || group.options.length === 0) return;

            const variantGroupDiv = document.createElement('div');
            variantGroupDiv.classList.add('mb-3');
            variantGroupDiv.innerHTML = `
                <label for="variant-select-${index}" class="form-label me-3 fw-bold fs-5"> ${group.name}:</label>
                <select class="form-select variant-select" id="variant-select-${index}" data-group-name="${group.name}">
                    ${group.options.map(option => `<option value="${option.value}">${option.value}</option>`).join('')}
                </select>
            `;
            productVariantsSection.appendChild(variantGroupDiv);

            const selectElement = variantGroupDiv.querySelector('.variant-select');
            selectElement.addEventListener('change', updateProductDisplayBasedOnVariants);

            if (selectedVariantsMap[group.name]) {
                selectElement.value = selectedVariantsMap[group.name];
            } else if (group.options.length > 0) {
                selectedVariantsMap[group.name] = group.options[0].value;
            }
        });
    }

    function updateProductDisplayBasedOnVariants() {
        if (!productVariantsSection || !currentProductData) return;
        productVariantsSection.querySelectorAll('.variant-select').forEach(select => {
            selectedVariantsMap[select.dataset.groupName] = select.value;
        });

        currentCalculatedVariantDetails.totalAvailableStock = Infinity;
        currentCalculatedVariantDetails.combinedPriceAdjustment = 0;
        currentCalculatedVariantDetails.combinedImageUrl = currentProductData.imageUrl;

        let allSelectionsAreValid = true;

        for (const group of currentProductData.variants) {
            const selectedOptionValueForGroup = selectedVariantsMap[group.name];
            if (selectedOptionValueForGroup) {
                const foundOption = group.options.find(option => option.value === selectedOptionValueForGroup);
                if (foundOption) {
                    currentCalculatedVariantDetails.totalAvailableStock = Math.min(currentCalculatedVariantDetails.totalAvailableStock, foundOption.stock);
                    currentCalculatedVariantDetails.combinedPriceAdjustment += foundOption.priceAdjustment;
                    if (foundOption.imageUrl) {
                        currentCalculatedVariantDetails.combinedImageUrl = foundOption.imageUrl;
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

        if (allSelectionsAreValid && currentProductData.variants.length > 0) {
            if (productMainImage) productMainImage.src = currentCalculatedVariantDetails.combinedImageUrl || currentProductData.imageUrl || '/images/placeholder.jpg';
            updateThumbnailActiveState(currentCalculatedVariantDetails.combinedImageUrl);

            const newPrice = currentProductData.price + currentCalculatedVariantDetails.combinedPriceAdjustment;
            if (productPrice) productPrice.textContent = `EGP${newPrice.toFixed(2)}`;

            if (productStock) productStock.textContent = currentCalculatedVariantDetails.totalAvailableStock > 0 ? `In Stock: ${currentCalculatedVariantDetails.totalAvailableStock}` : 'Out of Stock';
            if (quantityInput) quantityInput.max = currentCalculatedVariantDetails.totalAvailableStock;

            const isAvailable = currentCalculatedVariantDetails.totalAvailableStock > 0;
            if (addToCartDetailBtn) {
                addToCartDetailBtn.disabled = !isAvailable;
                addToCartDetailBtn.innerHTML = isAvailable ? '<i class="fas fa-cart-plus me-2"></i> Add to Cart' : 'Out of Stock';
            }
            if (buyNowBtn) buyNowBtn.disabled = !isAvailable;

        } else {
            if (productMainImage) productMainImage.src = currentProductData.imageUrl || '/images/placeholder.jpg';
            updateThumbnailActiveState(currentProductData.imageUrl);
            if (productPrice) productPrice.textContent = `EGP${(currentProductData.price || 0).toFixed(2)}`;
            if (productStock) productStock.textContent = (currentProductData.stock > 0 ? `In Stock: ${currentProductData.stock}` : 'Out of Stock');
            if (quantityInput) quantityInput.max = currentProductData.stock || 0;
            
            const isAvailable = currentProductData.stock > 0;
            if (addToCartDetailBtn) {
                addToCartDetailBtn.disabled = !isAvailable;
                addToCartDetailBtn.innerHTML = isAvailable ? '<i class="fas fa-cart-plus me-2"></i> Add to Cart' : 'Out of Stock';
            }
            if (buyNowBtn) buyNowBtn.disabled = !isAvailable;
            
            if (currentProductData.variants && currentProductData.variants.length > 0 && !allSelectionsAreValid) {
                window.showToast('Please select all variant options.', 'warning');
            }
        }

        let currentQuantity = parseInt(quantityInput.value);
        let maxStock = parseInt(quantityInput.max);

        if (isNaN(currentQuantity) || currentQuantity <= 0) {
            currentQuantity = 1;
        }
        if (currentQuantity > maxStock) {
            currentQuantity = maxStock > 0 ? maxStock : 1;
        }
        if (maxStock === 0) {
            currentQuantity = 0;
        }
        if (quantityInput) quantityInput.value = currentQuantity;
        updateQuantityButtons(currentQuantity, maxStock);
    }

    function updateThumbnailActiveState(imageUrl) {
        if (!thumbnailGallery) return;
        thumbnailGallery.querySelectorAll('.thumbnail-image').forEach(img => img.classList.remove('active-thumbnail'));
        const matchingThumb = thumbnailGallery.querySelector(`img[src="${imageUrl}"]`);
        if (matchingThumb) {
            matchingThumb.classList.add('active-thumbnail');
        }
    }

    // ✅ MODIFIED: Updated updateThumbnailGallery function
    function updateThumbnailGallery(product) {
        if (!thumbnailGallery) return;
        thumbnailGallery.innerHTML = '';
        
        // Collect all unique image URLs from product and its variants
        const allImageUrls = new Set();
        if (product.imageUrl) {
            allImageUrls.add(product.imageUrl);
        }
        if (product.imageUrls && Array.isArray(product.imageUrls)) {
            product.imageUrls.forEach(url => allImageUrls.add(url));
        }
        if (product.variants && Array.isArray(product.variants)) {
            product.variants.forEach(group => {
                if (group.options && Array.isArray(group.options)) {
                    group.options.forEach(option => {
                        if (option.imageUrl) {
                            allImageUrls.add(option.imageUrl);
                        }
                    });
                }
            });
        }

        // Convert Set back to Array for iteration
        const uniqueImageUrls = Array.from(allImageUrls);

        uniqueImageUrls.forEach(url => {
            const thumbImg = document.createElement('img');
            thumbImg.src = url; 
            thumbImg.alt = product.name || 'Product Image';
            // Apply Tailwind classes for consistent thumbnail size and styling
            thumbImg.classList.add('w-20', 'h-20', 'object-cover', 'rounded-lg', 'shadow-sm', 'cursor-pointer', 'thumbnail-image', 'hover:scale-105', 'transition-transform', 'duration-200', 'border', 'border-transparent', 'hover:border-[#008080]');
            
            thumbImg.onerror = function() {
                this.src='https://placehold.co/80x80/cbd5e0/4a5568?text=No+Image'; // Fallback for broken thumbnail images
            };

            thumbImg.addEventListener('click', () => {
                if (productMainImage) productMainImage.src = url;
                updateThumbnailActiveState(url); // Update active state for thumbnails
                // ✅ NEW: Reset zoom effect when thumbnail is clicked
                if (mainImageWrapper) {
                    productMainImage.style.transform = 'scale(1)';
                    productMainImage.style.transformOrigin = 'center center';
                }
            });
            if (thumbnailGallery) thumbnailGallery.appendChild(thumbImg);
        });

        // Set initial active state for the main product image's thumbnail
        updateThumbnailActiveState(currentProductData.imageUrl || '/images/placeholder.jpg');
    }

    function getSelectedVariantsAsArray() {
        const selected = [];
        if (!productVariantsSection) return selected;
        productVariantsSection.querySelectorAll('.variant-select').forEach(select => {
            selected.push({
                name: select.dataset.groupName,
                value: select.value
            });
        });
        return selected.sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value));
    }

    function updateQuantityButtons(currentQty, maxQty) {
        if (quantityInput) {
            quantityInput.value = currentQty;
            quantityInput.min = maxQty > 0 ? 1 : 0;
            quantityInput.max = maxQty;
        }

        if (decreaseQuantityBtn) decreaseQuantityBtn.disabled = currentQty <= (maxQty > 0 ? 1 : 0);
        if (increaseQuantityBtn) increaseQuantityBtn.disabled = currentQty >= maxQty;

        if (maxQty === 0) {
            if (quantityInput) quantityInput.value = 0;
            if (decreaseQuantityBtn) decreaseQuantityBtn.disabled = true;
            if (increaseQuantityBtn) increaseQuantityBtn.disabled = true;
        }
    }

    if (decreaseQuantityBtn) {
        decreaseQuantityBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > parseInt(quantityInput.min)) {
                quantityInput.value = currentValue - 1;
                updateQuantityButtons(parseInt(quantityInput.value), parseInt(quantityInput.max));
            }
        });
    }

    if (increaseQuantityBtn) {
        increaseQuantityBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue < parseInt(quantityInput.max)) {
                quantityInput.value = currentValue + 1;
                updateQuantityButtons(parseInt(quantityInput.value), parseInt(quantityInput.max));
            }
        });
    }

    if (quantityInput) {
        quantityInput.addEventListener('change', () => {
            let currentValue = parseInt(quantityInput.value);
            let maxAllowed = parseInt(quantityInput.max);
            let minAllowed = parseInt(quantityInput.min);

            if (isNaN(currentValue) || currentValue < minAllowed) {
                quantityInput.value = minAllowed;
            } else if (currentValue > maxAllowed) {
                quantityInput.value = maxAllowed;
            }
            updateQuantityButtons(parseInt(quantityInput.value), parseInt(quantityInput.max));
        });
    }

    if (addToCartDetailBtn) {
        addToCartDetailBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity < 1) {
                window.showToast('Please enter a valid quantity.', 'warning');
                return;
            }

            let itemToAdd = {
                productId: currentProductData._id,
                quantity: quantity
            };

            // Determine effective stock based on whether product has variants and if selections are made
            let effectiveStock = currentProductData.stock;
            let variantsSelected = false;

            if (currentProductData.variants && currentProductData.variants.length > 0) {
                const selected = getSelectedVariantsAsArray();
                if (selected.length !== currentProductData.variants.length) {
                    window.showToast('Please select all variant options before adding to cart.', 'warning');
                    return;
                }
                // Use the pre-calculated `currentCalculatedVariantDetails.totalAvailableStock`
                effectiveStock = currentCalculatedVariantDetails.totalAvailableStock;
                itemToAdd.selectedVariant = selected;
                variantsSelected = true;
            } else {
                itemToAdd.selectedVariant = null; // No variants
            }

            if (quantity > effectiveStock) {
                window.showToast(`Only ${effectiveStock} units available for this ${variantsSelected ? 'variant combination' : 'product'}.`, 'warning');
                return;
            }

            if (typeof window.addToCart === 'function') {
                await window.addToCart(itemToAdd.productId, itemToAdd.quantity, itemToAdd.selectedVariant);
                window.showToast('Product added to cart!', 'success');
            } else {
                console.error('window.addToCart is not defined. Cannot add to cart.');
                window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
            }
        });
    }

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity < 1) {
                window.showToast('Please enter a valid quantity.', 'warning');
                return;
            }

            let itemToAdd = {
                productId: currentProductData._id,
                quantity: quantity
            };
            
            // Determine effective stock based on whether product has variants and if selections are made
            let effectiveStock = currentProductData.stock;
            let variantsSelected = false;

            if (currentProductData.variants && currentProductData.variants.length > 0) {
                const selected = getSelectedVariantsAsArray();
                if (selected.length !== currentProductData.variants.length) {
                    window.showToast('Please select all variant options before buying.', 'warning');
                    return;
                }
                // Use the pre-calculated `currentCalculatedVariantDetails.totalAvailableStock`
                effectiveStock = currentCalculatedVariantDetails.totalAvailableStock;
                itemToAdd.selectedVariant = selected;
                variantsSelected = true;
            } else {
                itemToAdd.selectedVariant = null; // No variants
            }

            if (quantity > effectiveStock) {
                window.showToast(`Only ${effectiveStock} units available for this ${variantsSelected ? 'variant combination' : 'product'}.`, 'warning');
                return;
            }

            if (typeof window.addToCart === 'function') {
                await window.addToCart(itemToAdd.productId, itemToAdd.quantity, itemToAdd.selectedVariant);
                window.showToast('Redirecting to checkout...', 'info');
                setTimeout(() => {
                    window.location.href = 'checkout.html';
                }, 500);
            } else {
                console.error('window.addToCart is not defined. Cannot proceed with Buy Now.');
                window.showToast('Error: Cart functions not available. Please refresh the page.', 'danger');
            }
        });
    }

    async function checkWishlistStatus(prodId) {
        if (!window.isLoggedIn()) {
            if (addToWishlistBtn) addToWishlistBtn.style.display = 'none';
            return;
        }
        if (addToWishlistBtn) addToWishlistBtn.style.display = 'inline-block';
        try {
            const response = await fetch(`http://localhost:3000/api/wishlist`, {
                headers: window.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error('Failed to fetch wishlist.');
            }
            const wishlistItems = await response.json();
            const inWishlist = wishlistItems.some(item => item._id === prodId);

            if (addToWishlistBtn) {
                if (inWishlist) {
                    addToWishlistBtn.innerHTML = '<i class="fas fa-heart"></i> Remove from Wishlist';
                    addToWishlistBtn.classList.add('btn-danger');
                    addToWishlistBtn.classList.remove('btn-outline-primary');
                    addToWishlistBtn.dataset.inWishlist = 'true';
                } else {
                    addToWishlistBtn.innerHTML = '<i class="far fa-heart"></i> Add to Wishlist';
                    addToWishlistBtn.classList.add('btn-outline-primary');
                    addToWishlistBtn.classList.remove('btn-danger');
                    addToWishlistBtn.dataset.inWishlist = 'false';
                }
            }
        } catch (error) {
            console.error('Error checking wishlist status:', error);
            window.showToast('Failed to check wishlist status.', 'danger');
        }
    }

    if (addToWishlistBtn) {
        addToWishlistBtn.addEventListener('click', async () => {
            if (!window.isLoggedIn()) {
                window.showToast('Please log in to manage your wishlist.', 'info');
                return;
            }
            try {
                const isCurrentlyInWishlist = addToWishlistBtn.dataset.inWishlist === 'true';
                let response;

                if (isCurrentlyInWishlist) {
                    response = await fetch(`http://localhost:3000/api/wishlist/${productId}`, {
                        method: 'DELETE',
                        headers: window.getAuthHeaders()
                    });
                } else {
                    response = await fetch('http://localhost:3000/api/wishlist', {
                        method: 'POST',
                        headers: { ...window.getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId })
                    });
                }

                if (!response.ok) {
                    let errorData = { message: 'Failed to update wishlist due to unknown error.' };
                    try {
                        errorData = await response.json();
                    } catch (jsonError) {
                        console.error("Failed to parse JSON error response for update wishlist:", jsonError);
                    }
                    throw new Error(errorData.message || 'Failed to update wishlist.');
                }

                window.showToast(isCurrentlyInWishlist ? 'Removed from wishlist!' : 'Added to wishlist!', 'success');
                checkWishlistStatus(productId);
            } catch (error) {
                console.error('Error updating wishlist:', error);
                window.showToast(`Failed to update wishlist: ${error.message}`, 'danger');
            }
        });
    }

    if (ratingInput) {
        ratingInput.addEventListener('click', (event) => {
            let rating = 0;
            const clickedStar = event.target.closest('.fa-star');
            if (clickedStar) {
                rating = parseInt(clickedStar.dataset.rating);
            }
            if (selectedRatingInput) selectedRatingInput.value = rating;
            ratingInput.querySelectorAll('.fa-star').forEach(star => {
                const starRating = parseInt(star.dataset.rating);
                if (starRating <= rating) {
                    star.classList.remove('far');
                    star.classList.add('fas');
                } else {
                    star.classList.remove('fas');
                    star.classList.add('far');
                }
            });
        });
    }

    if (addReviewForm) {
        addReviewForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!window.isLoggedIn()) {
                if (reviewFormMessage) {
                    reviewFormMessage.textContent = 'Please log in to submit a review.';
                    reviewFormMessage.className = 'alert alert-warning';
                    reviewFormMessage.style.display = 'block';
                }
                return;
            }

            const rating = parseInt(selectedRatingInput.value);
            const comment = commentInput.value.trim();

            if (isNaN(rating) || rating < 1 || rating > 5) {
                if (reviewFormMessage) {
                    reviewFormMessage.textContent = 'Please select a rating between 1 and 5 stars.';
                    reviewFormMessage.className = 'alert alert-warning';
                    reviewFormMessage.style.display = 'block';
                }
                return;
            }
            if (!comment) {
                if (reviewFormMessage) {
                    reviewFormMessage.textContent = 'Please enter your review comment.';
                    reviewFormMessage.className = 'alert alert-warning';
                    reviewFormMessage.style.display = 'block';
                }
                return;
            }

            try {
                const response = await fetch(`http://localhost:3000/api/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...window.getAuthHeaders()
                    },
                    body: JSON.stringify({ productId, rating, comment })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to submit review.');
                }

                if (reviewFormMessage) {
                    reviewFormMessage.textContent = data.message || 'Review submitted successfully! It will be visible after approval.';
                    reviewFormMessage.className = 'alert alert-success';
                    reviewFormMessage.style.display = 'block';
                }

                if (selectedRatingInput) selectedRatingInput.value = 0;
                if (commentInput) commentInput.value = '';
                if (ratingInput) {
                    ratingInput.querySelectorAll('.fa-star').forEach(star => {
                        star.classList.remove('fas');
                        star.classList.add('far');
                    });
                }

                await fetchAndDisplayReviews(productId);

            } catch (error) {
                console.error('Error submitting review:', error);
                if (reviewFormMessage) {
                    reviewFormMessage.textContent = `Error: ${error.message}`;
                    reviewFormMessage.className = 'alert alert-danger';
                    reviewFormMessage.style.display = 'block';
                }
            }
        });
    }

    async function fetchAndDisplayReviews(prodId) {
        try {
            const response = await fetch(`http://localhost:3000/api/reviews/product/${prodId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch reviews.');
            }
            const data = await response.json();
            const reviews = data.reviews;
            const averageRating = data.averageRating;
            const totalReviews = data.totalReviews;

            if (avgStarsSpan) avgStarsSpan.textContent = averageRating.toFixed(1); 
            if (reviewsCountSpan) reviewsCountSpan.textContent = `(${totalReviews} reviews)`;

            const reviewStarsContainer = document.getElementById('avg-stars');
            if (reviewStarsContainer) { 
                reviewStarsContainer.innerHTML = '';
                const fullStars = Math.floor(averageRating);
                const halfStar = averageRating % 1 !== 0;
                const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

                for (let i = 0; i < fullStars; i++) {
                    const star = document.createElement('i');
                    star.classList.add('fas', 'fa-star', 'text-yellow-400');
                    if (reviewStarsContainer) reviewStarsContainer.appendChild(star);
                }
                if (halfStar) {
                    const star = document.createElement('i');
                    star.classList.add('fas', 'fa-star-half-alt', 'text-yellow-400');
                    if (reviewStarsContainer) reviewStarsContainer.appendChild(star);
                }
                for (let i = 0; i < emptyStars; i++) {
                    const star = document.createElement('i');
                    star.classList.add('far', 'fa-star', 'text-gray-300'); // Changed to gray-300 for empty stars
                    if (reviewStarsContainer) reviewStarsContainer.appendChild(star);
                }
            }

            if (reviewsListContainer) {
                reviewsListContainer.innerHTML = '';
                if (reviews.length === 0) {
                    reviewsListContainer.innerHTML = '<p class="text-muted text-center py-4">No reviews yet. Be the first to review!</p>';
                } else {
                    reviews.forEach(review => {
                        const reviewCard = document.createElement('div');
                        // Apply Tailwind classes for review card styling
                        reviewCard.classList.add('bg-gray-50', 'rounded-lg', 'shadow-sm', 'p-4', 'mb-4', 'border', 'border-gray-200');
                        reviewCard.innerHTML = `
                            <div class="flex items-center mb-2">
                                <h6 class="text-gray-800 font-semibold mr-3">${review.userId ? review.userId.name : 'Anonymous'}</h6>
                                <span class="text-gray-500 text-sm">${new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div class="mb-2 flex items-center">
                                ${renderStars(review.rating)}
                            </div>
                            <p class="text-gray-700 leading-relaxed">${review.comment}</p>
                        `;
                        reviewsListContainer.appendChild(reviewCard);
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
            if (reviewsListContainer) { // Use reviewsListContainer as a fallback to display error
                reviewsListContainer.innerHTML = `<p class="text-danger text-center py-4">Failed to load reviews: ${error.message}</p>`;
            }
        }
    }

    function renderStars(rating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHtml += '<i class="fas fa-star text-yellow-400"></i>';
            } else if (i - 0.5 === rating) {
                 starsHtml += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
            }
            else {
                starsHtml += '<i class="far fa-star text-gray-300"></i>'; // Changed to gray-300 for empty stars
            }
        }
        return starsHtml;
    }

    // ✅ MODIFIED: Updated fetchRelatedProducts to use product-card like styling for collections
    async function fetchRelatedProducts(currentProductId) {
        if (!relatedProductsContainer) return;
        relatedProductsContainer.innerHTML = '<div class="col-span-full text-center text-muted py-8">Loading related items...</div>';
        
        try {
            // ✅ MODIFIED: Request collections to include products for their images
            const response = await fetch(`http://localhost:3000/api/products/suggestions/${currentProductId}?_populateCollections=products`, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch suggestions.');
            }

            const suggestions = data.suggestions; // This will contain both products and collections

            relatedProductsContainer.innerHTML = ''; // Clear loading message

            if (suggestions.length === 0) {
                relatedProductsContainer.innerHTML = '<div class="col-span-full text-center text-muted py-8">No related items found.</div>';
                return;
            }

            suggestions.forEach(item => {
                const colDiv = document.createElement('div');
                // Apply Tailwind responsive width classes for the grid item directly
                // Keeping 'p-2' for padding around each card.
                colDiv.classList.add('p-2'); 

                if (item.type === 'product') {
                    // Render as a product card (reusing createProductCardHtml from main.js)
                    if (typeof window.createProductCardHtml === 'function') {
                        colDiv.innerHTML = window.createProductCardHtml(item.data);
                        // Attach event listeners for Add to Cart button on these new cards
                        const addToCartBtn = colDiv.querySelector('.add-to-cart-btn');
                        if (addToCartBtn) {
                            addToCartBtn.addEventListener('click', async (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const productId = event.target.dataset.productId;
                                const hasVariants = event.target.dataset.productHasVariants === 'true';

                                if (hasVariants) {
                                    if (typeof window.openProductVariantModal === 'function') {
                                        window.openProductVariantModal(productId);
                                    }
                                } else {
                                    if (typeof window.addToCart === 'function') {
                                        await window.addToCart(productId, 1, []);
                                    }
                                }
                            });
                        }
                    } else {
                        console.warn('window.createProductCardHtml is not defined. Cannot render suggested product.');
                    }
                } else if (item.type === 'collection') {
                    const collection = item.data;
                    const collectionImageUrl = collection.imageUrl || 'https://placehold.co/400x300/008080/ffffff?text=Collection+Image';
                    
                    // Generate small product image circles for the collection card
                    let productCirclesHtml = '';
                    // Check if collection.products exists and is an array
                    if (collection.products && Array.isArray(collection.products) && collection.products.length > 0) {
                        // Take up to 4 product images for the circles
                        const productsForCircles = collection.products.slice(0, 4);
                        productCirclesHtml = `
                            <div class="flex -space-x-2 overflow-hidden justify-center mt-2">
                                ${productsForCircles.map(prod => `
                                    <img class="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src="${prod.imageUrl || 'https://placehold.co/32x32/cbd5e0/4a5568?text=P'}" alt="${prod.name}" onerror="this.onerror=null;this.src='https://placehold.co/32x32/cbd5e0/4a5568?text=P';">
                                `).join('')}
                                ${collection.products.length > 4 ? `<span class="inline-block h-8 w-8 rounded-full bg-gray-200 text-gray-700 text-xs flex items-center justify-center ring-2 ring-white">+${collection.products.length - 4}</span>` : ''}
                            </div>
                        `;
                    } else {
                        productCirclesHtml = `<p class="text-xs text-gray-500 mt-2">No products in this collection</p>`;
                    }

                    // ✅ MODIFIED: Collection card now uses product-card like structure
                    colDiv.innerHTML = `
                        <a href="collection-detail.html?id=${collection._id}" class="block bg-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out overflow-hidden group product-card">
                            <div class="relative h-48 w-full overflow-hidden">
                                <img src="${collectionImageUrl}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cbd5e0/4a5568?text=Image+Unavailable';">
                                <div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <span class="text-white text-xl font-bold">View Collection</span>
                                </div>
                            </div>
                            <div class="p-4 flex flex-col items-center text-center">
                                <h3 class="text-xl font-semibold text-gray-800 mb-1">${collection.name}</h3>
                                <p class="text-gray-600 text-sm mb-2">${collection.products.length} items</p>
                                ${productCirclesHtml}
                                <button class="cta-button text-sm mt-4 py-2 px-4">View Collection</button>
                            </div>
                        </a>
                    `;
                }
                relatedProductsContainer.appendChild(colDiv);
            });

            if (relatedProductsSection) relatedProductsSection.style.display = 'block';

        } catch (error) {
            console.error('Error fetching related items (products/collections):', error);
            if (relatedProductsContainer) relatedProductsContainer.innerHTML = `<p class="col-span-full text-center text-danger py-8">Failed to load related items: ${error.message}</p>`;
        }
    }

    fetchProductDetails(productId);
});
