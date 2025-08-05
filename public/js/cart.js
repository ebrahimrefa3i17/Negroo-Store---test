// public/js/cart.js
// هذا الملف يجب أن يحتوي فقط على الدوال المتعلقة بسلة التسوق

// متغير عام لتخزين عناصر السلة التي تم جلبها من API أو التخزين المحلي
window.cartItems = [];
window.appliedCoupon = null; // لتخزين الكوبون المطبق
window.cartSubtotal = 0;
window.cartDiscount = 0;
window.cartFinalTotal = 0;

// دالة مساعدة للحصول على رؤوس المصادقة (Auth Headers)
// يُفترض أن window.getAuthHeaders معرفة في auth.js ويتم تحميلها قبل cart.js
window.getAuthHeaders = window.getAuthHeaders || (() => {
    console.log("[Cart Debug] Attempting to get auth headers.");
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
});

// دالة مساعدة لعرض رسائل التوست (Toast messages)
// إذا لم تكن window.showToast معرفة، فستمنع الأخطاء
window.showToast = window.showToast || ((message, type = 'info') => {
    console.log(`Toast: ${type} - ${message}`);
    // Fallback إذا لم يتم تحميل toast.js أو لم يتم عرض showToast عالميًا
    alert(message);
});

// دالة مساعدة لمودال التأكيد المخصص (Confirmation Modal)
// إذا لم تكن window.showConfirmationModal معرفة، فستستخدم تأكيد المتصفح الأصلي
window.showConfirmationModal = window.showConfirmationModal || ((message, onConfirm) => {
    console.warn("[Cart Debug] window.showConfirmationModal is not defined. Using native confirm.");
    if (confirm(message)) {
        onConfirm();
    }
});

// دالة لحساب العدد الإجمالي للعناصر في السلة
window.getCartItemCount = () => {
    const count = window.cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    console.log(`[Cart Debug] Current cart item count: ${count}`);
    return count;
};

// دالة للحصول على جميع عناصر السلة
window.getCartItems = () => {
    console.log("[Cart Debug] Getting all cart items:", window.cartItems);
    return window.cartItems;
};

// دالة لتوليد guestId فريد وتخزينه في localStorage
window.getGuestId = () => {
    let guestId = localStorage.getItem('guestId');
    if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('guestId', guestId);
    }
    return guestId;
};

// دالة لتحديث عرض السلة المصغرة (Mini Cart)
window.updateMiniCart = (cartData) => {
    console.log("[Mini Cart] Updating mini cart with data:", cartData);
    const miniCartItemsContainer = document.getElementById('mini-cart-items-container');
    const miniCartTotalSpan = document.getElementById('mini-cart-total');
    const miniCartCheckoutBtn = document.getElementById('mini-cart-checkout-btn');

    if (!miniCartItemsContainer || !miniCartTotalSpan || !miniCartCheckoutBtn) {
        console.warn('[Mini Cart] Mini cart elements not found. Cannot update mini cart display.');
        return;
    }

    miniCartItemsContainer.innerHTML = ''; // مسح العناصر السابقة
    let total = 0;

    if (cartData && cartData.items && cartData.items.length > 0) {
        window.cartItems = cartData.items; // تحديث عناصر السلة العالمية
        console.log("[Mini Cart] Processing items:", window.cartItems);

        cartData.items.forEach(item => {
            const productInfo = item.product; // يجب أن يكون item.product متاحاً من API
            
            if (!productInfo || !productInfo.price) {
                console.warn('[Mini Cart] Cart item missing product data or price, skipping:', item);
                return;
            }

            const productPrice = productInfo.price || 0;
            const itemQuantity = item.quantity || 0;
            const itemTotal = productPrice * itemQuantity;
            total += itemTotal;

            // Construct variant display string
            let variantDisplay = '';
            if (item.selectedVariants && item.selectedVariants.length > 0) {
                variantDisplay = item.selectedVariants.map(v => `${v.name || 'N/A'}: ${v.value || 'N/A'}`).join(', ');
            }

            const imageUrl = productInfo.imageUrl || '/images/placeholder-product.jpg';
            const productName = productInfo.name || 'Unknown Product';
            const productStock = productInfo.stock || 0;


            console.log(`[Mini Cart] Adding item: ${productName}, Price: ${productPrice}, Quantity: ${itemQuantity}`);

            const itemHtml = `
                <div class="mini-cart-item">
                    <img src="${imageUrl}" alt="${productName}">
                    <div class="mini-cart-item-details">
                        <h6>${productName}</h6>
                        <p class="text-muted">${variantDisplay}</p>
                        <p class="mini-cart-item-price">EGP${productPrice.toFixed(2)}</p>
                    </div>
                    <div class="mini-cart-quantity-controls">
                        <button class="quantity-btn-mini-cart" data-product-id="${item.productId}" data-action="decrease" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>-</button>
                        <input type="number" class="item-quantity-input-mini-cart" value="${itemQuantity}" min="1" data-product-id="${item.productId}" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>
                        <button class="quantity-btn-mini-cart" data-product-id="${item.productId}" data-action="increase" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>+</button>
                    </div>
                    <button class="mini-cart-remove-btn" data-product-id="${item.productId}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            miniCartItemsContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
        miniCartCheckoutBtn.disabled = false;
    } else {
        window.cartItems = []; // مسح عناصر السلة العالمية
        miniCartItemsContainer.innerHTML = '<p class="text-muted text-center">Your cart is empty.</p>';
        miniCartCheckoutBtn.disabled = true;
        console.log("[Mini Cart] Cart data is empty or null.");
    }
    miniCartTotalSpan.textContent = `EGP${total.toFixed(2)}`;
};

// دالة لتحميل بيانات السلة (للمستخدمين المسجلين أو الضيوف)
window.loadCart = async () => {
    console.log("[Cart API] Attempting to load cart.");
    let headers = { 'Content-Type': 'application/json' };
    if (window.isLoggedIn && window.isLoggedIn()) {
        headers = { ...headers, ...window.getAuthHeaders() };
        console.log("[Cart API] User is logged in. Fetching cart from API.");
    } else {
        const guestId = window.getGuestId();
        headers['X-Guest-ID'] = guestId; // إرسال guestId في الرأس
        console.log("[Cart API] User is NOT logged in. Fetching guest cart from API with ID:", guestId);
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/cart', {
            headers: headers
        });
        const data = await response.json();
        console.log("[Cart API] Response status:", response.status, "OK:", response.ok);
        console.log("[Cart API] Response data:", data);

        if (response.ok) {
            window.updateMiniCart(data);
            console.log("[Cart API] Cart loaded successfully from API.");
            return data; // Return cart data for full page update
        } else {
            console.error('[Cart API] Failed to load cart from API:', data.message);
            window.showToast(`Failed to load cart: ${data.message}`, 'danger');
            window.updateMiniCart(null); // مسح السلة عند الفشل
            return null;
        }
    } catch (error) {
        console.error('[Cart API] Error loading cart from API:', error);
        window.showToast(`Error loading cart: ${error.message}`, 'danger');
        window.updateMiniCart(null); // مسح السلة عند الخطأ
        return null;
    }
};

// دالة لفتح الشريط الجانبي للسلة المصغرة
window.openMiniCart = async () => {
    console.log("[Mini Cart] Opening mini cart.");
    const miniCartSidebar = document.getElementById('mini-cart-sidebar');
    const miniCartOverlay = document.getElementById('mini-cart-overlay');
    if (miniCartSidebar && miniCartOverlay) {
        miniCartSidebar.classList.add('open');
        miniCartOverlay.classList.add('open');
        await window.loadCart(); // تحميل/تحديث محتوى السلة عند الفتح
    }
};

// دالة لإغلاق الشريط الجانبي للسلة المصغرة
window.closeMiniCart = () => {
    console.log("[Mini Cart] Closing mini cart.");
    const miniCartSidebar = document.getElementById('mini-cart-sidebar');
    const miniCartOverlay = document.getElementById('mini-cart-overlay');
    if (miniCartSidebar && miniCartOverlay) {
        miniCartSidebar.classList.remove('open');
        miniCartOverlay.classList.remove('open');
    }
};

// دالة لإضافة منتج إلى السلة
// ProductDetails الآن ضرورية لـ cart.js لإرسالها إلى الـ API
window.addToCart = async (productId, quantity = 1, selectedVariants = [], productDetails) => {
    console.log(`[Cart Action] Adding product ${productId}, Qty: ${quantity}, Variants: ${JSON.stringify(selectedVariants)}, Details: ${JSON.stringify(productDetails)}`);
    try {
        let headers = { 'Content-Type': 'application/json' };
        let bodyPayload = { productId, quantity, selectedVariants }; // Initialize payload

        if (window.isLoggedIn && window.isLoggedIn()) {
            headers = { ...headers, ...window.getAuthHeaders() };
            // For logged-in users, userId is handled by auth middleware on backend
            // No need to send userId in body explicitly here.
        } else {
            const guestId = window.getGuestId();
            headers['X-Guest-ID'] = guestId; // Send guestId for guest operations
            // For guests, backend will use X-Guest-ID header to find/create cart
        }

        const response = await fetch('http://localhost:3000/api/cart/add', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyPayload) // Send the constructed payload
        });
        const data = await response.json();
        console.log("[Cart Action] Add to cart response:", data);
        if (response.ok) {
            window.showToast(data.message || 'Product added to cart!', 'success');
            window.updateCartCount(); // تحديث عدد عناصر السلة في شريط التنقل والسلة المصغرة
            // If on the full cart page, refresh it
            if (window.location.pathname.includes('cart.html')) {
                window.loadFullCartPage();
            }
        } else {
            throw new Error(data.message || 'Failed to add product to cart.');
        }
    } catch (error) {
        console.error('[Cart Action] Error adding to cart:', error);
        window.showToast(`Error adding to cart: ${error.message}`, 'danger');
    }
};

// دالة لإزالة منتج من السلة
window.removeFromCart = async (productId, selectedVariants = []) => {
    console.log(`[Cart Action] Removing product ${productId}, Variants: ${JSON.stringify(selectedVariants)}`);
    try {
        let headers = { 'Content-Type': 'application/json' };
        if (window.isLoggedIn && window.isLoggedIn()) {
            headers = { ...headers, ...window.getAuthHeaders() };
        } else {
            headers['X-Guest-ID'] = window.getGuestId();
        }

        // Changed endpoint to use DELETE with body, as per backend `cartRoutes.js`
        const response = await fetch('http://localhost:3000/api/cart/remove', {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify({ productId, selectedVariants })
        });
        const data = await response.json();
        console.log("[Cart Action] Remove from cart response:", data);
        if (response.ok) {
            window.showToast(data.message || 'Product removed from cart!', 'success');
            window.updateCartCount(); // تحديث عدد عناصر السلة في شريط التنقل والسلة المصغرة
            // If on the full cart page, refresh it
            if (window.location.pathname.includes('cart.html')) {
                window.loadFullCartPage();
            }
        } else {
            throw new Error(data.message || 'Failed to remove product from cart.');
        }
    } catch (error) {
        console.error('[Cart Action] Error removing from cart:', error);
        window.showToast(`Error removing from cart: ${error.message}`, 'danger');
    }
};

// دالة لتحديث كمية المنتج في السلة
window.updateCartItemQuantity = async (productId, newQuantity, selectedVariants = []) => {
    console.log(`[Cart Action] Updating product ${productId} quantity to ${newQuantity}, Variants: ${JSON.stringify(selectedVariants)}`);
    if (newQuantity < 1) {
        // إذا انخفضت الكمية عن 1، قم بإزالة العنصر
        window.showConfirmationModal('Quantity cannot be less than 1. Do you want to remove this item?', async () => {
            await window.removeFromCart(productId, selectedVariants);
        });
        return;
    }
    try {
        let headers = { 'Content-Type': 'application/json' };
        if (window.isLoggedIn && window.isLoggedIn()) {
            headers = { ...headers, ...window.getAuthHeaders() };
        } else {
            headers['X-Guest-ID'] = window.getGuestId();
        }

        const response = await fetch('http://localhost:3000/api/cart/update', {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ productId, quantity: newQuantity, selectedVariants })
        });
        const data = await response.json();
        console.log("[Cart Action] Update quantity response:", data);
        if (response.ok) {
            window.showToast(data.message || 'Cart updated!', 'success');
            window.updateCartCount(); // تحديث عدد عناصر السلة في شريط التنقل والسلة المصغرة
            // If on the full cart page, refresh it
            if (window.location.pathname.includes('cart.html')) {
                window.loadFullCartPage();
            }
        } else {
            throw new Error(data.message || 'Failed to update cart quantity.');
        }
    } catch (error) {
        console.error('[Cart Action] Error updating cart quantity:', error);
        window.showToast(`Error updating cart quantity: ${error.message}`, 'danger');
    }
};

// ✅ NEW: دالة لمسح السلة (يتم استدعاؤها بعد إتمام الطلب)
window.clearCart = async () => {
    console.log("[Cart Action] Attempting to clear cart.");
    try {
        let headers = { 'Content-Type': 'application/json' };
        if (window.isLoggedIn && window.isLoggedIn()) {
            headers = { ...headers, ...window.getAuthHeaders() };
        } else {
            headers['X-Guest-ID'] = window.getGuestId();
        }

        const response = await fetch('http://localhost:3000/api/cart/clear', { // نقطة API جديدة لمسح السلة
            method: 'DELETE', // أو POST، حسب تصميم الـ API الخاص بك
            headers: headers
        });
        const data = await response.json();

        if (response.ok) {
            window.cartItems = []; // مسح العناصر من المتغير العام
            window.appliedCoupon = null; // مسح الكوبون المطبق
            window.cartSubtotal = 0;
            window.cartDiscount = 0;
            window.cartFinalTotal = 0;
            localStorage.removeItem('appliedCoupon'); // مسح الكوبون من التخزين المحلي
            window.updateMiniCart(null); // تحديث السلة المصغرة لعرضها فارغة
            window.showToast(data.message || 'Cart cleared successfully!', 'success');
            console.log("[Cart Action] Cart cleared successfully.");
            window.updateCartCount(); // تحديث العدد في الشريط العلوي
        } else {
            throw new Error(data.message || 'Failed to clear cart.');
        }
    } catch (error) {
        console.error('[Cart Action] Error clearing cart:', error);
        window.showToast(`Error clearing cart: ${error.message}`, 'danger');
    }
};


// دالة لتطبيق الكوبون
window.applyCoupon = async (couponCode) => {
    console.log(`[Coupon] Attempting to apply coupon: ${couponCode}`);
    const couponMessageDiv = document.getElementById('couponMessage');
    if (!couponMessageDiv) return;

    couponMessageDiv.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info');
    couponMessageDiv.textContent = 'Applying coupon...';
    couponMessageDiv.classList.add('alert-info');

    try {
        if (!window.isLoggedIn || !window.isLoggedIn()) {
            window.showToast('Please log in to apply coupons.', 'warning');
            couponMessageDiv.textContent = 'Please log in to apply coupons.';
            couponMessageDiv.classList.remove('alert-info');
            couponMessageDiv.classList.add('alert-danger');
            return;
        }

        const response = await fetch('http://localhost:3000/api/coupons/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...window.getAuthHeaders()
            },
            body: JSON.stringify({ couponCode, cartTotal: window.cartSubtotal }) // Send current subtotal for validation
        });
        const data = await response.json();

        if (response.ok) {
            window.appliedCoupon = data.coupon;
            window.cartDiscount = data.discountAmount;
            window.cartFinalTotal = data.finalTotal;

            couponMessageDiv.textContent = data.message || `Coupon '${couponCode}' applied successfully!`;
            couponMessageDiv.classList.remove('alert-info');
            couponMessageDiv.classList.add('alert-success');
            window.showToast(data.message || 'Coupon applied!', 'success');
            window.loadFullCartPage(false); // Refresh cart display without re-fetching from API
        } else {
            window.appliedCoupon = null;
            window.cartDiscount = 0;
            window.cartFinalTotal = window.cartSubtotal; // Reset final total to subtotal
            couponMessageDiv.textContent = data.message || 'Failed to apply coupon.';
            couponMessageDiv.classList.remove('alert-info');
            couponMessageDiv.classList.add('alert-danger');
            window.showToast(data.message || 'Coupon failed!', 'danger');
            window.loadFullCartPage(false); // Refresh cart display to remove old discount
        }
    } catch (error) {
        console.error('[Coupon] Error applying coupon:', error);
        window.appliedCoupon = null;
        window.cartDiscount = 0;
        window.cartFinalTotal = window.cartSubtotal; // Reset final total to subtotal
        couponMessageDiv.textContent = `Error: ${error.message}`;
        couponMessageDiv.classList.remove('alert-info');
        couponMessageDiv.classList.add('alert-danger');
        window.showToast(`Error applying coupon: ${error.message}`, 'danger');
        window.loadFullCartPage(false); // Refresh cart display
    } finally {
        couponMessageDiv.classList.remove('d-none');
    }
};


// دالة مساعدة لعرض عناصر السلة في الصفحة الرئيسية
function renderCartItemsFullPage(cartData) {
    console.log("[Full Cart Page Render] Starting render with cartData:", cartData);
    const cartItemsListContainer = document.getElementById('cart-items-list');
    const cartSubtotalSpan = document.getElementById('cart-subtotal');
    const cartDiscountRow = document.getElementById('discountRow');
    const cartDiscountSpan = document.getElementById('cart-discount');
    const cartFinalTotalRow = document.getElementById('finalTotalRow');
    const cartFinalTotalSpan = document.getElementById('cart-final-total');
    const checkoutButton = document.getElementById('checkout-button');
    const couponCodeInput = document.getElementById('couponCodeInput');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponMessageDiv = document.getElementById('couponMessage');


    if (!cartItemsListContainer || !cartSubtotalSpan || !cartDiscountRow || !cartDiscountSpan || !cartFinalTotalRow || !cartFinalTotalSpan || !checkoutButton || !couponCodeInput || !applyCouponBtn || !couponMessageDiv) {
        console.warn('[Full Cart Page Render] One or more cart page elements not found. Cannot render full cart page.');
        return;
    }

    cartItemsListContainer.innerHTML = ''; // Clear previous items

    if (!cartData || !cartData.items || cartData.items.length === 0) {
        console.log("[Full Cart Page Render] Cart is empty or no data. Displaying empty message.");
        cartItemsListContainer.innerHTML = '<p class="text-center text-muted">Your cart is empty.</p>';
        cartSubtotalSpan.textContent = 'EGP0.00';
        cartDiscountRow.style.display = 'none';
        cartFinalTotalRow.style.display = 'none';
        checkoutButton.disabled = true;
        couponCodeInput.disabled = true;
        applyCouponBtn.disabled = true;
        couponMessageDiv.classList.add('d-none'); // Hide coupon message if cart is empty
        window.cartItems = [];
        window.cartSubtotal = 0;
        window.cartDiscount = 0;
        window.cartFinalTotal = 0;
        window.appliedCoupon = null;
        return;
    }

    window.cartItems = cartData.items; // Update global cartItems
    let currentSubtotal = 0;

    console.log("[Full Cart Page Render] Processing items to render:", window.cartItems);

    cartData.items.forEach(item => {
        const productInfo = item.product; // يجب أن يكون item.product متاحاً من API
        
        if (!productInfo || !productInfo.price) {
            console.warn('[Full Cart Page Render] Cart item missing product data or price, skipping:', item);
            return;
        }

        const productPrice = productInfo.price || 0;
        const itemQuantity = item.quantity || 0;
        const itemTotal = productPrice * itemQuantity;
        currentSubtotal += itemTotal;

        let variantDisplay = '';
        if (item.selectedVariants && item.selectedVariants.length > 0) {
            variantDisplay = item.selectedVariants.map(v => `${v.name || 'N/A'}: ${v.value || 'N/A'}`).join(', ');
        }

        const imageUrl = productInfo.imageUrl || '/images/placeholder-product.jpg';
        const productName = productInfo.name || 'Unknown Product';
        const productStock = productInfo.stock || 0;


        console.log(`[Full Cart Page Render] Adding item HTML for: ${productName}, Qty: ${itemQuantity}, Price: ${productPrice}`);

        const itemHtml = `
            <div class="card mb-3 shadow-sm cart-item-full-page">
                <div class="row g-0 align-items-center">
                    <div class="col-md-2">
                        <img src="${imageUrl}" class="img-fluid rounded-start cart-item-image" alt="${productName}">
                    </div>
                    <div class="col-md-6">
                        <div class="card-body">
                            <h5 class="card-title">${productName}</h5>
                            <p class="card-text text-muted">${variantDisplay}</p>
                            <p class="card-text">Price: EGP${productPrice.toFixed(2)}</p>
                            <button class="btn btn-danger btn-sm remove-from-cart-btn" data-product-id="${item.productId}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                    <div class="col-md-2 d-flex align-items-center justify-content-center">
                        <div class="input-group input-group-sm quantity-control-full-page">
                            <button class="btn btn-outline-secondary quantity-btn-full-page" type="button" data-action="decrease" data-product-id="${item.productId}" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>-</button>
                            <input type="number" class="form-control text-center item-quantity-input-full-page" value="${itemQuantity}" min="1" data-product-id="${item.productId}" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>
                            <button class="btn btn-outline-secondary quantity-btn-full-page" type="button" data-action="increase" data-product-id="${item.productId}" data-max-stock="${productStock}" data-selected-variants='${JSON.stringify(item.selectedVariants || [])}'>+</button>
                        </div>
                    </div>
                    <div class="col-md-2 d-flex align-items-center justify-content-center">
                        <h5 class="mb-0">EGP${itemTotal.toFixed(2)}</h5>
                    </div>
                </div>
            </div>
        `;
        cartItemsListContainer.insertAdjacentHTML('beforeend', itemHtml);
    });

    window.cartSubtotal = currentSubtotal;
    window.cartDiscount = 0; // Reset discount initially
    window.cartFinalTotal = currentSubtotal; // Reset final total initially

    cartSubtotalSpan.textContent = `EGP${currentSubtotal.toFixed(2)}`;
    cartDiscountRow.style.display = 'none'; // Hide discount row by default
    cartFinalTotalRow.style.display = 'none'; // Hide final total row by default

    // Re-apply coupon if one was previously applied and still valid
    if (window.appliedCoupon) {
        // Recalculate discount based on current subtotal and stored coupon details
        let recalculatedDiscount = 0;
        if (window.appliedCoupon.discountType === 'percentage') {
            recalculatedDiscount = currentSubtotal * (window.appliedCoupon.discountValue / 100);
            if (window.appliedCoupon.maxDiscountAmount && recalculatedDiscount > window.appliedCoupon.maxDiscountAmount) {
                recalculatedDiscount = window.appliedCoupon.maxDiscountAmount;
            }
        } else if (window.appliedCoupon.discountType === 'fixed_amount') {
            recalculatedDiscount = window.appliedCoupon.discountValue;
        }

        window.cartDiscount = recalculatedDiscount;
        window.cartFinalTotal = currentSubtotal - recalculatedDiscount;
        if (window.cartFinalTotal < 0) window.cartFinalTotal = 0;

        cartDiscountSpan.textContent = `EGP${window.cartDiscount.toFixed(2)}`;
        cartFinalTotalSpan.textContent = `EGP${window.cartFinalTotal.toFixed(2)}`;
        cartDiscountRow.style.display = 'flex'; // Show discount row
        cartFinalTotalRow.style.display = 'flex'; // Show final total row

        // Show coupon message as applied
        couponCodeInput.value = window.appliedCoupon.code;
        couponMessageDiv.textContent = `Coupon '${window.appliedCoupon.code}' applied! You saved EGP${window.cartDiscount.toFixed(2)}.`;
        couponMessageDiv.classList.remove('d-none', 'alert-danger', 'alert-info');
        couponMessageDiv.classList.add('alert-success');
    } else {
        // Ensure inputs are enabled if cart is not empty
        couponCodeInput.disabled = false;
        applyCouponBtn.disabled = false;
    }

    checkoutButton.disabled = false; // Enable checkout button if cart has items

    // Attach event listeners for quantity buttons and remove buttons
    cartItemsListContainer.querySelectorAll('.quantity-btn-full-page').forEach(button => {
        button.removeEventListener('click', handleQuantityChangeFullPage); // Remove old listener
        button.addEventListener('click', handleQuantityChangeFullPage); // Add new listener
    });

    cartItemsListContainer.querySelectorAll('.item-quantity-input-full-page').forEach(input => {
        input.removeEventListener('change', handleQuantityInputChangeFullPage); // Remove old listener
        input.addEventListener('change', handleQuantityInputChangeFullPage); // Add new listener
    });

    cartItemsListContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.removeEventListener('click', handleRemoveFromCartFullPage); // Remove old listener
        button.addEventListener('click', handleRemoveFromCartFullPage); // Add new listener
    });
    console.log("[Full Cart Page Render] Finished rendering items.");
}

// دالة لمعالجة تغيير الكمية من أزرار +/- في صفحة السلة الرئيسية
async function handleQuantityChangeFullPage(event) {
    const button = event.target.closest('.quantity-btn-full-page');
    const productId = button.dataset.productId;
    const itemDiv = button.closest('.cart-item-full-page');
    const quantityInput = itemDiv.querySelector('.item-quantity-input-full-page');
    let currentQuantity = parseInt(quantityInput.value);
    const maxStock = parseInt(quantityInput.dataset.maxStock);
    const selectedVariants = button.dataset.selectedVariants ? JSON.parse(button.dataset.selectedVariants) : [];

    if (button.dataset.action === 'decrease') {
        if (currentQuantity > 1) {
            currentQuantity--;
        } else {
            window.showToast('Minimum quantity is 1. Click Remove to delete item.', 'info');
            return;
        }
    } else if (button.dataset.action === 'increase') {
        if (currentQuantity >= maxStock) { // التحقق من المخزون دائمًا
            window.showToast(`Max stock for this product is ${maxStock}.`, 'warning');
            return;
        }
        currentQuantity++;
    }
    quantityInput.value = currentQuantity;
    await window.updateCartItemQuantity(productId, currentQuantity, selectedVariants);
}

// دالة لمعالجة تغيير الكمية من إدخال النص في صفحة السلة الرئيسية
async function handleQuantityInputChangeFullPage(event) {
    const input = event.target;
    const productId = input.dataset.productId;
    let newQuantity = parseInt(input.value);
    const maxStock = parseInt(input.dataset.maxStock);
    const selectedVariants = input.dataset.selectedVariants ? JSON.parse(input.dataset.selectedVariants) : [];

    if (isNaN(newQuantity) || newQuantity < 1) {
        newQuantity = 1;
    }
    if (newQuantity > maxStock) { // التحقق من المخزون دائمًا
        newQuantity = maxStock;
        window.showToast(`Max stock for this product is ${maxStock}.`, 'warning');
    }
    input.value = newQuantity;
    await window.updateCartItemQuantity(productId, newQuantity, selectedVariants);
}

// دالة لمعالجة إزالة عنصر من السلة في صفحة السلة الرئيسية
async function handleRemoveFromCartFullPage(event) {
    const removeButton = event.target.closest('.remove-from-cart-btn');
    const productId = removeButton.dataset.productId;
    const selectedVariants = removeButton.dataset.selectedVariants ? JSON.parse(removeButton.dataset.selectedVariants) : [];

    window.showConfirmationModal('Are you sure you want to remove this item from your cart?', async () => {
        await window.removeFromCart(productId, selectedVariants);
    });
}

// دالة لتحميل وعرض صفحة السلة الرئيسية بالكامل
window.loadFullCartPage = async (fetchData = true) => {
    console.log("[Full Cart Page] Loading full cart page. Fetching data:", fetchData);
    const cartItemsListContainer = document.getElementById('cart-items-list');
    if (!cartItemsListContainer) {
        console.warn("Cart items list container not found on cart.html. Skipping full cart page load.");
        return;
    }

    cartItemsListContainer.innerHTML = '<p class="text-center text-muted">Loading your cart...</p>'; // Show loading message

    let cartData = null;
    if (fetchData) {
        cartData = await window.loadCart(); // Use the existing loadCart function
        console.log("[Full Cart Page] Fetched cart data:", cartData);
    } else {
        // If not fetching, use the globally stored cartItems
        cartData = { items: window.cartItems };
        console.log("[Full Cart Page] Using existing cart data (no fetch):", cartData);
        if (window.appliedCoupon) {
            // Recalculate discount if a coupon was applied
            let currentSubtotal = window.cartItems.reduce((sum, item) => {
                const productInfo = item.product;
                return sum + ((productInfo && productInfo.price || 0) * (item.quantity || 0))
            }, 0);
            let recalculatedDiscount = 0;
            if (window.appliedCoupon.discountType === 'percentage') {
                recalculatedDiscount = currentSubtotal * (window.appliedCoupon.discountValue / 100);
                if (window.appliedCoupon.maxDiscountAmount && recalculatedDiscount > window.appliedCoupon.maxDiscountAmount) {
                    recalculatedDiscount = window.appliedCoupon.maxDiscountAmount;
                }
            } else if (window.appliedCoupon.discountType === 'fixed_amount') {
                recalculatedDiscount = window.appliedCoupon.discountValue;
            }
            window.cartDiscount = recalculatedDiscount;
            window.cartFinalTotal = currentSubtotal - recalculatedDiscount;
            if (window.cartFinalTotal < 0) window.cartFinalTotal = 0;
            console.log("[Full Cart Page] Recalculated discount and totals. Subtotal:", currentSubtotal, "Discount:", window.cartDiscount, "Final:", window.cartFinalTotal);
        }
    }

    renderCartItemsFullPage(cartData);
    console.log("[Full Cart Page] Full cart page load process completed.");
};

// **دالة لدمج سلة الضيوف عند تسجيل الدخول (يجب استدعاؤها بعد نجاح تسجيل الدخول)**
window.mergeGuestCartOnLogin = async () => {
    const guestCartId = localStorage.getItem('guestId');
    if (!guestCartId || !window.isLoggedIn()) {
        return; // لا يوجد شيء للدمج أو المستخدم لم يسجل الدخول
    }

    window.showToast('جاري دمج سلة الضيوف مع سلتك...', 'info');
    try {
        // استدعاء API لدمج السلة. هذا يتطلب مسار API جديد في الخلفية.
        // مثال: PUT /api/cart/merge
        const response = await fetch('http://localhost:3000/api/cart/merge', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...window.getAuthHeaders(), // لرؤوس المستخدم المسجل
                'X-Guest-ID': guestCartId // لإرسال guestId للدمج
            },
            body: JSON.stringify({}) // يمكن إرسال أي بيانات إضافية للدمج
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل دمج سلة الضيوف.');
        }

        localStorage.removeItem('guestId'); // مسح guestId بعد الدمج الناجح
        window.showToast('تم دمج سلة الضيوف بنجاح.', 'success');
    } catch (error) {
        console.error('[Merge Cart] Error merging guest cart:', error);
        window.showToast(`حدث خطأ أثناء دمج السلة: ${error.message}`, 'error');
    } finally {
        window.updateMiniCart(); // تحديث السلة المصغرة بعد الدمج
        if (window.location.pathname.includes('cart.html') && typeof window.loadFullCartPage === 'function') {
            window.loadFullCartPage(); // تحديث صفحة السلة الكاملة
        }
    }
};


// إرفاق مستمعي الأحداث لصفحة السلة الرئيسية
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Cart Page Init] DOMContentLoaded - Attaching event listeners for full cart page.");
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponCodeInput = document.getElementById('couponCodeInput');

    if (applyCouponBtn && couponCodeInput) {
        applyCouponBtn.addEventListener('click', () => {
            const couponCode = couponCodeInput.value.trim();
            if (couponCode) {
                window.applyCoupon(couponCode);
            } else {
                window.showToast('Please enter a coupon code.', 'warning');
            }
        });
    } else {
        console.warn("[Cart Page Init] Apply coupon elements not found.");
    }

    // ✅ NEW: Call loadFullCartPage when DOM is ready for cart.html
    if (window.location.pathname.includes('cart.html')) {
        if (typeof window.loadFullCartPage === 'function') {
            window.loadFullCartPage();
        } else {
            console.error('window.loadFullCartPage is not defined. Cart page will not load.');
        }
    }
});

// التحميل الأولي لعدد عناصر السلة عند تحميل السكريبت (لشريط التنقل)
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Cart Init] DOMContentLoaded - Initializing cart count for navbar.");
    if (window.updateCartCount) {
        window.updateCartCount();
    } else {
        console.warn('window.updateCartCount is not yet defined. Cart count might update later.');
    }
});