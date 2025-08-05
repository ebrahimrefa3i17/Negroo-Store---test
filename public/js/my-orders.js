document.addEventListener('DOMContentLoaded', async () => {
    const ordersListDiv = document.getElementById('orders-list');

    // Redirect to login if user is not logged in
    if (!window.isLoggedIn()) {
        window.showToast('Please log in to view your orders.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // Function to fetch and display user's orders
    async function fetchMyOrders() {
        ordersListDiv.innerHTML = '<p class="text-center text-muted py-5">Loading your orders...</p>';
        try {
            const response = await fetch('http://localhost:3000/api/orders/my-orders', {
                headers: window.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch orders.');
            }

            const orders = await response.json();
            displayOrders(orders);

        } catch (error) {
            console.error('Error fetching my orders:', error);
            ordersListDiv.innerHTML = `<p class="text-center text-danger py-5">Failed to load orders: ${error.message}</p>`;
            window.showToast(`Failed to load orders: ${error.message}`, 'danger');
        }
    }

    // Function to display orders in the HTML
    function displayOrders(orders) {
        ordersListDiv.innerHTML = ''; // Clear previous items
        if (orders.length === 0) {
            ordersListDiv.innerHTML = `
                <div class="text-center py-8 bg-white rounded-xl shadow-lg">
                    <i class="fas fa-box-open fa-5x text-gray-400 mb-4"></i>
                    <p class="text-2xl text-gray-600 mb-4">You have not placed any orders yet.</p>
                    <a href="index.html" class="cta-button text-lg"><i class="fas fa-shopping-bag mr-2"></i>Start Shopping</a>
                </div>
            `;
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            // Apply Tailwind classes for card styling
            orderCard.classList.add(
                'bg-white', 'rounded-xl', 'shadow-md', 'p-6', 'mb-6',
                'border', 'border-gray-200', 'hover:shadow-lg', 'transition-shadow', 'duration-300'
            );

            // Determine status badge classes
            let statusClass = 'bg-gray-200 text-gray-800'; // Default
            switch (order.status) {
                case 'Pending':
                    statusClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'Processing':
                    statusClass = 'bg-blue-100 text-blue-800';
                    break;
                case 'Shipped':
                    statusClass = 'bg-indigo-100 text-indigo-800';
                    break;
                case 'Delivered':
                    statusClass = 'bg-green-100 text-green-800';
                    break;
                case 'Cancelled':
                    statusClass = 'bg-red-100 text-red-800';
                    break;
                case 'Refunded':
                    statusClass = 'bg-purple-100 text-purple-800';
                    break;
                default:
                    statusClass = 'bg-gray-100 text-gray-700';
            }

            let itemsHtml = '';
            let totalItems = 0;
            order.items.forEach(item => {
                const itemImageUrl = item.imageUrl || 'https://placehold.co/80x80/cbd5e0/4a5568?text=No+Image'; // Fallback image
                itemsHtml += `
                    <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div class="flex items-center">
                            <img src="${itemImageUrl}" alt="${item.name}" class="w-20 h-20 object-cover rounded-lg mr-4">
                            <div>
                                <a href="product-detail.html?id=${item.productId}" class="text-gray-800 hover:text-[#008080] font-medium text-base">${item.name}</a>
                                <p class="text-sm text-gray-500">Quantity: ${item.quantity}</p>
                                ${item.selectedVariants && item.selectedVariants.length > 0 ? 
                                    `<p class="text-xs text-gray-500">Options: ${item.selectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')}</p>` : ''}
                            </div>
                        </div>
                        <span class="text-gray-900 font-semibold text-lg">EGP${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `;
                totalItems += item.quantity;
            });

            orderCard.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-4 border-b border-gray-200">
                    <h4 class="text-gray-800 text-xl md:text-2xl font-semibold mb-2 md:mb-0">Order ID: <span class="text-gray-500 font-normal text-lg">${order._id}</span></h4>
                    <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusClass}">${order.status}</span>
                </div>
                <p class="text-gray-600 mb-2"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p class="text-gray-600 mb-4"><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                
                <h5 class="text-gray-700 text-lg font-semibold mb-3">Items in this Order (${totalItems} items):</h5>
                <div class="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                    ${itemsHtml}
                </div>
                
                <div class="flex justify-between items-center font-bold text-xl md:text-2xl pt-4 border-t border-gray-200">
                    <span class="text-gray-800">Total Amount:</span>
                    <span class="text-[#004d4d]">EGP${order.totalAmount.toFixed(2)}</span>
                </div>
                
                <h5 class="text-gray-700 text-lg font-semibold mt-6 mb-3">Shipping To:</h5>
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p class="text-gray-700 mb-1">${order.shippingAddress.fullName}</p>
                    <p class="text-gray-700 mb-1">${order.shippingAddress.addressLine1}</p>
                    <p class="text-gray-700 mb-1">${order.shippingAddress.city}, ${order.shippingAddress.country}</p>
                    <p class="text-gray-700">Phone: ${order.shippingAddress.phone}</p>
                </div>

                <div class="mt-6 text-right">
                    ${order.status === 'Pending' || order.status === 'Processing' ? 
                        `<button class="cta-button bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-full cancel-order-btn" data-order-id="${order._id}">
                            <i class="fas fa-times-circle mr-2"></i>Cancel Order
                        </button>`
                        : `<span class="text-gray-500 italic text-sm">Order cannot be cancelled at this stage.</span>`
                    }
                </div>
            `;
            ordersListDiv.appendChild(orderCard);
        });

        // Add event listeners for cancel buttons
        ordersListDiv.querySelectorAll('.cancel-order-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const orderId = event.target.dataset.orderId;
                // Use custom confirmation modal instead of native confirm()
                if (window.showConfirmationModal) {
                    window.showConfirmationModal(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`, async () => {
                        await cancelOrder(orderId);
                    });
                } else {
                    // Fallback to native confirm if custom modal is not available (though it should be)
                    if (confirm(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`)) {
                        await cancelOrder(orderId);
                    }
                }
            });
        });
    }

    // Function to cancel an order
    async function cancelOrder(orderId) {
        try {
            const response = await fetch(`http://localhost:3000/api/orders/cancel/${orderId}`, {
                method: 'PUT', // Use PUT for updating status
                headers: window.getAuthHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to cancel order.');
            }

            window.showToast(data.message, 'success');
            fetchMyOrders(); // Re-fetch orders to update the list
        } catch (error) {
            console.error('Error cancelling order:', error);
            window.showToast(`Error cancelling order: ${error.message}`, 'danger');
        }
    }

    // Initial fetch of orders when the page loads
    fetchMyOrders();

    // Update Navbar and cart count on page load
    if (window.updateNavbar) window.updateNavbar(); 
    if (window.updateCartCount) window.updateCartCount(); 
});
