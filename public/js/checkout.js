// public/js/checkout.js

document.addEventListener('DOMContentLoaded', async () => {
    const orderSummaryDiv = document.getElementById('order-summary');
    const orderTotalSpan = document.getElementById('order-total');
    const cartSubtotalSpan = document.getElementById('cart-subtotal'); // NEW
    const shippingCostSpan = document.getElementById('shipping-cost'); // NEW
    const placeOrderBtn = document.getElementById('place-order-btn');
    const shippingForm = document.getElementById('shipping-form');
    const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const paymobFieldsDiv = document.getElementById('paymob-payment-fields');
    const governorateSelect = document.getElementById('governorate'); // NEW

    let currentCartItems = [];
    let paymobRedirectUrl = null;
    let appliedCouponData = null;
    let currentShippingCost = 0; // NEW variable to store current shipping cost

    // ✅ NEW: Log currentUser to console for debugging
    const currentUser = window.getCurrentUser();
    console.log('Current User object in checkout.js:', currentUser);

    // ✅ NEW: Define shipping rates by governorate
    const SHIPPING_RATES_BY_GOVERNORATE = {
        "Cairo": 50.00,
        "Giza": 50.00,
        "Qalyubia": 50.00,
        "Alexandria": 75.00,
        "Dakahlia": 75.00,
        "Gharbia": 75.00,
        "Menoufia": 75.00,
        "Sharqia": 75.00,
        "El-Beheira": 75.00,
        "Damietta": 75.00,
        "Ismailia": 75.00,
        "Suez": 75.00,
        "Port Said": 75.00,
        "Kafr el-Sheikh": 75.00,
        "Beni Suef": 100.00,
        "Faiyum": 100.00,
        "Minya": 100.00,
        "Asyut": 100.00,
        "Sohag": 100.00,
        "Qena": 100.00,
        "Luxor": 100.00,
        "Aswan": 100.00,
        "Red Sea": 150.00,
        "Matrouh": 150.00,
        "New Valley": 150.00,
        "North Sinai": 150.00,
        "South Sinai": 150.00
    };

    // ✅ NEW: Populate governorate dropdown
    function populateGovernorates() {
        for (const governorate in SHIPPING_RATES_BY_GOVERNORATE) {
            const option = document.createElement('option');
            option.value = governorate;
            option.textContent = governorate;
            governorateSelect.appendChild(option);
        }
    }

    populateGovernorates(); // Call on load

    // Pre-fill user's email and shipping address if logged in
    if (window.isLoggedIn() && currentUser) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = currentUser.email || '';
            emailInput.readOnly = true;
        }
        // Check for shippingAddress existence and then access properties safely
        if (currentUser.shippingAddress) {
            document.getElementById('fullName').value = currentUser.shippingAddress.fullName || '';
            document.getElementById('phone').value = currentUser.shippingAddress.phone || '';
            document.getElementById('addressLine1').value = currentUser.shippingAddress.addressLine1 || '';
            document.getElementById('city').value = currentUser.shippingAddress.city || '';
            document.getElementById('country').value = currentUser.shippingAddress.country || 'Egypt';
            // ✅ NEW: Pre-fill governorate
            if (currentUser.shippingAddress.governorate && SHIPPING_RATES_BY_GOVERNORATE[currentUser.shippingAddress.governorate]) {
                governorateSelect.value = currentUser.shippingAddress.governorate;
                currentShippingCost = SHIPPING_RATES_BY_GOVERNORATE[currentUser.shippingAddress.governorate];
            }
        } else {
            console.warn('Current user has no shipping address saved in the currentUser object.');
        }
    } else {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.readOnly = false;
        }
    }

    // ✅ NEW: Event listener for governorate change
    governorateSelect.addEventListener('change', () => {
        const selectedGovernorate = governorateSelect.value;
        if (selectedGovernorate && SHIPPING_RATES_BY_GOVERNORATE[selectedGovernorate]) {
            currentShippingCost = SHIPPING_RATES_BY_GOVERNORATE[selectedGovernorate];
        } else {
            currentShippingCost = 0; // No governorate selected or invalid
        }
        updateOrderTotals(); // Recalculate totals
    });


    // Function to fetch cart contents and display order summary
    async function fetchCartAndDisplaySummary() {
        orderSummaryDiv.innerHTML = '<p class="text-center text-muted py-3">Loading cart items...</p>';
        placeOrderBtn.disabled = true;

        try {
            if (window.isLoggedIn()) {
                const response = await fetch('http://localhost:3000/api/cart', {
                    headers: window.getAuthHeaders()
                });
                if (!response.ok) {
                    let errorData = { message: 'Failed to fetch cart for checkout due to unknown error.' };
                    try {
                        errorData = await response.json();
                    } catch (jsonError) {
                        console.error("Failed to parse JSON error response for cart fetch:", jsonError);
                    }
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const cart = await response.json();
                // Ensure product details are extracted correctly from item.product
                currentCartItems = cart.items.map(item => ({
                    ...item,
                    productId: item.product ? item.product._id : item.productId, 
                    name: item.product ? item.product.name : 'Unknown Product',
                    price: item.product ? parseFloat(item.product.price) : 0,
                    imageUrl: item.product ? item.product.imageUrl : '/images/placeholder.jpg',
                    quantity: parseInt(item.quantity) || 0,
                    variantPriceAdjustment: parseFloat(item.variantPriceAdjustment) || 0,
                    selectedVariants: item.selectedVariants || []
                }));
            } else {
                // ✅ الجزء الذي يحتاج إلى تعديل: للمستخدمين الـ Guest
                let guestRawCartItems = window.getCartItems();
                let productIds = guestRawCartItems.map(item => item.productId);
                
                // Fetch full product details for guest items from the backend
                if (productIds.length > 0) {
                    const productsResponse = await fetch(`http://localhost:3000/api/products/by-ids?ids=${productIds.join(',')}`);
                    const productsData = await productsResponse.json();
                    if (!productsResponse.ok) {
                        throw new Error(productsData.message || 'Failed to fetch product details for guest cart.');
                    }
                    const productsMap = new Map(productsData.products.map(p => [p._id.toString(), p]));

                    currentCartItems = guestRawCartItems.map(item => {
                        const product = productsMap.get(item.productId.toString());
                        if (!product) {
                            console.warn(`Product ID ${item.productId} not found for guest cart item.`);
                            return null; // Skip invalid items
                        }

                        let finalPrice = product.price || 0;
                        let finalImageUrl = product.imageUrl || '/images/placeholder.jpg';
                        let variantPriceAdjustment = 0;
                        
                        // Apply flash sale price if applicable
                        if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
                            finalPrice = product.flashSalePrice;
                        }

                        // Apply variant price adjustment if applicable
                        if (item.selectedVariants && item.selectedVariants.length > 0) {
                            let currentCombinationPriceAdjustment = 0;
                            let currentCombinationImageUrl = product.imageUrl; // Default to main product image
                            for (const clientVar of item.selectedVariants) {
                                const foundGroup = product.variants.find(vg => vg.name === clientVar.name);
                                if (foundGroup) {
                                    const foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                                    if (foundOption) {
                                        currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                                        if (foundOption.imageUrl) {
                                            currentCombinationImageUrl = foundOption.imageUrl;
                                        }
                                    }
                                }
                            }
                            variantPriceAdjustment = currentCombinationPriceAdjustment;
                            finalPrice += variantPriceAdjustment; // Add variant price adjustment to the base/flash sale price
                            finalImageUrl = currentCombinationImageUrl; // Use variant image if available
                        }

                        return {
                            ...item,
                            name: product.name,
                            price: finalPrice, // Use adjusted price
                            imageUrl: finalImageUrl, // Use adjusted image
                            stock: product.stock, // Include stock for validation
                            variantPriceAdjustment: variantPriceAdjustment,
                            // إضافة حقول الفلاش سيل لضمان التوافق (إذا كانت موجودة في الـ Product model)
                            isOnFlashSale: product.isOnFlashSale,
                            flashSalePrice: product.flashSalePrice,
                            flashSaleEndDate: product.flashSaleEndDate
                        };
                    }).filter(item => item !== null); // Remove any null items
                } else {
                    currentCartItems = []; // No products to fetch
                }
            }

            // Always update summary items regardless of login status
            orderSummaryDiv.innerHTML = '';
            let subtotal = 0;

            if (!currentCartItems || currentCartItems.length === 0) {
                orderSummaryDiv.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-shopping-cart fa-4x text-muted mb-3"></i>
                        <p class="fs-5 text-muted">Your cart is empty. Please add items before checking out.</p>
                        <a href="index.html" class="btn btn-primary mt-3"><i class="fas fa-shopping-bag me-2"></i>Start Shopping</a>
                    </div>
                `;
                placeOrderBtn.disabled = true;
                cartSubtotalSpan.textContent = 'EGP 0.00';
                shippingCostSpan.textContent = 'EGP 0.00';
                orderTotalSpan.textContent = 'EGP 0.00';
                return;
            } else {
                placeOrderBtn.disabled = false;
            }

            currentCartItems.forEach(item => {
                const productName = item.name; 
                const itemDisplayPrice = item.price; 
                const itemDisplayImage = item.imageUrl; 

                const itemTotal = itemDisplayPrice * item.quantity;
                subtotal += itemTotal;

                const variantDisplay = item.selectedVariants && item.selectedVariants.length > 0
                    ? ` (${item.selectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')})`
                    : '';

                const itemDiv = document.createElement('div');
                itemDiv.classList.add('order-summary-item-detail', 'd-flex', 'align-items-center', 'mb-2', 'py-2');
                itemDiv.innerHTML = `
                    <div class="flex-shrink-0 me-3">
                        <img src="${itemDisplayImage}" alt="${productName}${variantDisplay}" class="rounded checkout-item-image">
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 text-dark">${productName}${variantDisplay}</h6>
                        <small class="text-muted">${item.quantity} x EGP${itemDisplayPrice.toFixed(2)}</small>
                    </div>
                    <div class="fw-bold">EGP${itemTotal.toFixed(2)}</div>
                `;
                orderSummaryDiv.appendChild(itemDiv);
            });
            
            cartSubtotalSpan.textContent = `EGP${subtotal.toFixed(2)}`;
            updateOrderTotals(); // Call to update final totals including shipping and coupon

        } catch (error) {
            console.error('Error fetching cart for checkout:', error);
            orderSummaryDiv.innerHTML = '<p class="text-center text-danger py-3">Failed to load cart summary. Please try again later.</p>';
            cartSubtotalSpan.textContent = 'EGP 0.00';
            shippingCostSpan.textContent = 'EGP 0.00';
            orderTotalSpan.textContent = 'EGP 0.00';
            placeOrderBtn.disabled = true;
            window.showToast(`Failed to load cart summary: ${error.message}`, 'danger');
        }
    }

    // ✅ NEW: Function to update all totals including subtotal, shipping, and coupon
    function updateOrderTotals() {
        let subtotal = parseFloat(cartSubtotalSpan.textContent.replace('EGP', '')) || 0;
        let discountAmount = 0;
        
        appliedCouponData = JSON.parse(localStorage.getItem('appliedCoupon') || 'null');
        if (appliedCouponData && subtotal >= appliedCouponData.minOrderAmount) {
            if (appliedCouponData.discountType === 'percentage') {
                discountAmount = subtotal * (appliedCouponData.discountValue / 100);
                if (appliedCouponData.maxDiscountAmount && discountAmount > appliedCouponData.maxDiscountAmount) {
                    discountAmount = appliedCouponData.maxDiscountAmount;
                }
            } else if (appliedCouponData.discountType === 'fixed_amount') {
                discountAmount = appliedCouponData.discountValue;
            }
            if (discountAmount > subtotal) discountAmount = subtotal;

            // Remove existing coupon display if any to prevent duplicates
            const existingDiscountDiv = document.querySelector('.coupon-discount-display');
            if (existingDiscountDiv) existingDiscountDiv.remove();

            const discountDiv = document.createElement('div');
            discountDiv.classList.add('d-flex', 'justify-content-between', 'fs-6', 'fw-bold', 'text-success', 'mt-2', 'py-2', 'border-top', 'coupon-discount-display'); // Added class for easy removal
            discountDiv.innerHTML = `
                <span>Coupon Discount (${appliedCouponData.code}):</span>
                <span>-EGP${discountAmount.toFixed(2)}</span>
            `;
            // Insert discount before the final total line
            orderTotalSpan.parentElement.before(discountDiv); 
        } else {
            appliedCouponData = null;
            localStorage.removeItem('appliedCoupon');
            // Ensure no old coupon display remains
            const existingDiscountDiv = document.querySelector('.coupon-discount-display');
            if (existingDiscountDiv) existingDiscountDiv.remove();
        }

        // Display shipping cost
        shippingCostSpan.textContent = `EGP${currentShippingCost.toFixed(2)}`;

        const finalTotal = subtotal - discountAmount + currentShippingCost;
        orderTotalSpan.textContent = `EGP${finalTotal.toFixed(2)}`;

        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        if (selectedPaymentMethod === 'Paymob Card') {
            // Re-initiate Paymob payment only if total changes and method is Paymob
            // Avoids infinite loop if called directly from updateOrderTotals.
            // Better to re-evaluate on a payment method change or explicit user action.
        }

        if (window.updateCartCount) {
            window.updateCartCount();
        }
    }


    async function initiatePaymobPayment() {
        const totalAmount = parseFloat(orderTotalSpan.textContent.replace('EGP', ''));
        const selectedGovernorate = governorateSelect.value; // NEW
        if (!selectedGovernorate || !SHIPPING_RATES_BY_GOVERNORATE[selectedGovernorate]) { // NEW validation
            window.showToast('Please select a valid governorate for shipping.', 'warning');
            placeOrderBtn.disabled = true;
            return;
        }

        if (totalAmount <= 0 || isNaN(totalAmount)) {
            window.showToast('Cart total must be greater than zero for online payment.', 'warning');
            placeOrderBtn.disabled = true;
            return;
        }

        const shippingAddress = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            addressLine1: document.getElementById('addressLine1').value.trim(),
            governorate: selectedGovernorate, // NEW
            city: document.getElementById('city').value.trim(),
            country: document.getElementById('country').value.trim(),
            shippingCost: currentShippingCost // NEW
        };

        if (!shippingAddress.fullName || !shippingAddress.email || !shippingAddress.phone || !shippingAddress.addressLine1 || !shippingAddress.governorate || !shippingAddress.city || !shippingAddress.country) {
            window.showToast('Please fill in all shipping information fields before proceeding to payment.', 'warning');
            placeOrderBtn.disabled = true;
            return;
        }

        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Redirecting to Paymob...';

        try {
            const orderDetailsToSend = {
                shippingAddress,
                paymentMethod: 'Paymob Card',
                items: currentCartItems.map(item => {
                    return {
                        productId: item.productId, 
                        quantity: parseInt(item.quantity) || 0, 
                        selectedVariants: item.selectedVariants || [],
                        variantImageUrl: item.variantImageUrl || item.imageUrl || '/images/placeholder.jpg', 
                        variantPriceAdjustment: parseFloat(item.variantPriceAdjustment) || 0,
                        name: item.name || 'Unknown Product', 
                        price: parseFloat(item.price) || 0, 
                        imageUrl: item.imageUrl || '/images/placeholder.jpg' 
                    };
                }),
                coupon: appliedCouponData ? {
                    code: appliedCouponData.code,
                    discountType: appliedCouponData.discountType,
                    discountValue: appliedCouponData.discountValue,
                    minOrderAmount: appliedCouponData.minOrderAmount,
                    maxDiscountAmount: appliedCouponData.maxDiscountAmount
                } : undefined,
                totalAmount: totalAmount
            };

            const response = await fetch('http://localhost:3000/api/orders/pay-with-paymob', {
                method: 'POST',
                headers: window.getAuthHeaders(),
                body: JSON.stringify(orderDetailsToSend)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to initiate Paymob payment.');
            }

            paymobRedirectUrl = data.redirectUrl;
            window.showToast('Redirecting to secure payment page...', 'info');

            if (paymobFieldsDiv) {
                paymobFieldsDiv.innerHTML = `<iframe src="${paymobRedirectUrl}" style="width:100%; height:400px; border:none; margin-top:20px;"></iframe>`;
                paymobFieldsDiv.style.display = 'block';
                placeOrderBtn.style.display = 'none';
            } else {
                window.location.href = paymobRedirectUrl;
            }

        } catch (error) {
            console.error('Error initiating Paymob payment:', error);
            window.showToast(`Payment initiation failed: ${error.message}`, 'danger');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = 'Place Order <i class="fas fa-check-circle ms-2"></i>';
        }
    }


    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', async (event) => {
            const selectedMethod = event.target.value;
            if (selectedMethod === 'Paymob Card') {
                if (paymobFieldsDiv) paymobFieldsDiv.style.display = 'block';
                await initiatePaymobPayment();
            } else {
                if (paymobFieldsDiv) paymobFieldsDiv.style.display = 'none';
                paymobFieldsDiv.innerHTML = '';
                paymobRedirectUrl = null;
                placeOrderBtn.innerHTML = 'Place Order <i class="fas fa-check-circle ms-2"></i>';
                placeOrderBtn.disabled = false;
                placeOrderBtn.style.display = 'block';
            }
        });
    });


    placeOrderBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const addressLine1 = document.getElementById('addressLine1').value.trim();
        const governorate = governorateSelect.value; // NEW
        const city = document.getElementById('city').value.trim();
        const country = document.getElementById('country').value.trim();
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

        if (!fullName || !email || !phone || !addressLine1 || !governorate || !city || !country) { // NEW validation
            window.showToast('Please fill in all shipping information fields, including Governorate.', 'warning'); // Updated message
            return;
        }
        if (!governorate || !SHIPPING_RATES_BY_GOVERNORATE[governorate]) { // NEW validation
            window.showToast('Please select a valid governorate for shipping.', 'warning');
            return;
        }
        if (currentCartItems.length === 0) {
            window.showToast('Your cart is empty. Please add items to your cart before placing an order.', 'warning');
            return;
        }
        if (!paymentMethod) {
            window.showToast('Please select a payment method.', 'warning');
            return;
        }

        const shippingAddress = {
            fullName,
            email,
            phone,
            addressLine1,
            governorate, // NEW
            city,
            country,
            shippingCost: currentShippingCost // NEW
        };

        if (paymentMethod === 'Paymob Card' && paymobRedirectUrl) {
            if (placeOrderBtn.style.display !== 'none') {
                 window.location.href = paymobRedirectUrl;
                 return;
            } else {
                window.showToast('Please complete your payment in the Paymob window/iframe.', 'info');
                return;
            }
        }

        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Placing Order...';

        try {
            const totalAmountElement = document.getElementById('order-total');
            let finalTotalAmountValue = parseFloat(totalAmountElement.textContent.replace('EGP', ''));

            if (isNaN(finalTotalAmountValue)) {
                console.error('Calculated finalTotalAmountValue is NaN. Using 0 as fallback.');
                finalTotalAmountValue = 0; 
            }

            const orderData = {
                shippingAddress,
                items: currentCartItems.map(item => {
                    return {
                        productId: item.productId, 
                        quantity: parseInt(item.quantity) || 0, 
                        selectedVariants: item.selectedVariants || [],
                        variantImageUrl: item.variantImageUrl || item.imageUrl || '/images/placeholder.jpg', 
                        variantPriceAdjustment: parseFloat(item.variantPriceAdjustment) || 0,
                        name: item.name || 'Unknown Product', 
                        price: parseFloat(item.price) || 0, 
                        imageUrl: item.imageUrl || '/images/placeholder.jpg' 
                    };
                }),
                paymentMethod,
                coupon: appliedCouponData ? {
                    code: appliedCouponData.code,
                    discountType: appliedCouponData.discountType,
                    discountValue: appliedCouponData.discountValue,
                    minOrderAmount: appliedCouponData.minOrderAmount,
                    maxDiscountAmount: appliedCouponData.maxDiscountAmount
                } : undefined,
                totalAmount: finalTotalAmountValue 
            };
            console.log("Order Data being sent:", orderData); 

            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: window.getAuthHeaders(),
                body: JSON.stringify(orderData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Order placement failed: Unknown error.');
            }

            window.showToast(data.message + ` Your Order ID: ${data.order._id}`, 'success');

            await window.clearCart();

            if (window.updateCartCount) {
                window.updateCartCount();
            }

            setTimeout(() => {
                if (window.isLoggedIn()) {
                    window.location.href = `order-confirmation.html?orderId=${data.order._id}`;
                } else {
                    localStorage.setItem('guestOrderIdForConfirmation', data.order._id);
                    window.location.href = `order-confirmation.html?guest=true&orderId=${data.order._id}`;
                }
            }, 1500);

        } catch (error) {
            console.error('Order placement error:', error);
            window.showToast(`Order placement failed: ${error.message}`, 'danger');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = 'Place Order <i class="fas fa-check-circle ms-2"></i>';
        }
    });

    await window.loadCart();

    // Call fetchCartAndDisplaySummary after populating governorates and setting up event listeners
    // and after initial pre-filling of user data (which might set initial shipping cost)
    fetchCartAndDisplaySummary();
});