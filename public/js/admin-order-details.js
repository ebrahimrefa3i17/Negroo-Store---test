// public/js/admin-order-details.js
document.addEventListener('DOMContentLoaded', async () => {
    // 1. تحقق من صلاحيات المسؤول (تماماً مثل admin-core.js)
    if (!window.isLoggedIn()) {
        window.showToast('Please log in to access this page.', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    const currentUser = window.getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        window.showToast('Access denied. Administrator privileges required.', 'danger');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
    }

    // 2. جلب معرف الطلب من URL
    const pathSegments = window.location.pathname.split('/');
    const orderId = pathSegments[pathSegments.length - 1];

    if (!orderId) {
        window.showToast('Order ID not found in URL.', 'danger');
        document.querySelector('.admin-container').innerHTML = '<h2 class="text-danger text-center">Order ID not found.</h2>';
        return;
    }

    // إخفاء المحتوى الرئيسي حتى يتم تحميل البيانات
    const orderDetailsContentDiv = document.getElementById('order-details-content');
    if (orderDetailsContentDiv) {
        orderDetailsContentDiv.style.opacity = '0';
        orderDetailsContentDiv.style.transition = 'opacity 0.5s ease-in-out';
    }
    const initialLoadingMessage = document.getElementById('initial-loading-message');
    if (initialLoadingMessage) {
        initialLoadingMessage.style.display = 'block'; // تأكد من ظهوره في البداية
    }

    // 3. جلب تفاصيل الطلب من الـ API
    window.fetchAndDisplayOrderDetails = async function() {
        try {
            const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}`, {
                headers: window.getAuthHeaders()
            });

            if (!response.ok) {
                let errorData = { message: 'Failed to load order details due to unknown error.' };
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    console.error("Failed to parse JSON error response for order details fetch:", jsonError);
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const order = await response.json();
            console.log('Order data fetched:', order);

            // Populate static header
            document.querySelector('h2').textContent = `Order Details - Order #${order._id}`;

            // Populate order information section using new IDs
            document.getElementById('orderCustomerName').textContent = order.userId ? order.userId.name : 'N/A';
            document.getElementById('orderCustomerEmail').textContent = order.userId ? order.userId.email : 'N/A';
            document.getElementById('orderCustomerPhone').textContent = order.shippingAddress.phone;
            document.getElementById('orderShippingAddress').textContent = `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.country}`;
            document.getElementById('orderTotalAmount').textContent = `EGP${order.totalAmount.toFixed(2)}`;
            document.getElementById('orderPaymentMethod').textContent = order.paymentMethod;

            const statusBadge = document.getElementById('orderStatusBadge');
            if (statusBadge) {
                statusBadge.className = `status-badge status-${order.status}`;
                statusBadge.textContent = order.status;
            }
            
            document.getElementById('orderDate').textContent = new Date(order.createdAt).toLocaleString();

            // Populate Paymob specific details (if elements exist and data is available)
            const orderPaymobId = document.getElementById('orderPaymobId');
            if (orderPaymobId) orderPaymobId.textContent = order.paymobOrderId || 'N/A';
            const orderTransactionId = document.getElementById('orderTransactionId');
            if (orderTransactionId) orderTransactionId.textContent = order.paymentDetails ? order.paymentDetails.transactionId || 'N/A' : 'N/A';
            const orderPaymentStatus = document.getElementById('orderPaymentStatus');
            if (orderPaymentStatus) orderPaymentStatus.textContent = order.paymentDetails ? order.paymentDetails.status || 'N/A' : 'N/A';
            const orderPaymentMessage = document.getElementById('orderPaymentMessage');
            if (orderPaymentMessage) orderPaymentMessage.textContent = order.paymentDetails ? order.paymentDetails.message || 'N/A' : 'N/A';


            // Populate items table
            const orderItemsTbody = document.querySelector('.order-items tbody');
            if (orderItemsTbody) {
                orderItemsTbody.innerHTML = '';
                order.items.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>EGP${item.price.toFixed(2)}</td>
                        <td>EGP${(item.quantity * item.price).toFixed(2)}</td>
                    `;
                    orderItemsTbody.appendChild(row);
                });
            }
            
            // Update status form select
            const statusSelect = document.getElementById('status');
            if (statusSelect) {
                Array.from(statusSelect.options).forEach(option => {
                    option.selected = (option.value === order.status);
                });
            }
            
            // Update form action and method
            const updateStatusForm = document.querySelector('.status-form form');
            if (updateStatusForm) {
                updateStatusForm.action = `http://localhost:3000/api/admin/orders/${order._id}/status`;
                updateStatusForm.method = 'PUT';
            }

            // Event listener for status form submission
            if (updateStatusForm) {
                // Ensure event listener is added only once or remove previous before adding
                const oldSubmitHandler = updateStatusForm.onsubmit; // Store old handler if any
                if (oldSubmitHandler) updateStatusForm.removeEventListener('submit', oldSubmitHandler); // Remove if exists

                updateStatusForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const newStatus = statusSelect.value;
                    try {
                        const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/status`, {
                            method: 'PUT',
                            // ✅ إضافة Content-Type هنا
                            headers: { ...window.getAuthHeaders(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                        });
                        const data = await response.json();
                        if (!response.ok) {
                            throw new Error(data.message || 'Failed to update order status.');
                        }
                        window.showToast('Order status updated successfully!', 'success');
                        window.fetchAndDisplayOrderDetails(); // Re-fetch details to update UI
                    } catch (error) {
                        console.error('Error updating order status:', error);
                        window.showToast(`Failed to update order status: ${error.message}`, 'danger');
                    }
                });
            }


            // Hide initial loading message and show content
            if (initialLoadingMessage) {
                initialLoadingMessage.style.display = 'none';
            }
            if (orderDetailsContentDiv) {
                orderDetailsContentDiv.style.opacity = '1';
            }

        } catch (error) {
            console.error('Error fetching and rendering order details:', error);
            const container = document.querySelector('.admin-container');
            // Clear all content in the main container and display error
            if (container) {
                container.innerHTML = `
                    <h2 class="text-danger text-center section-heading">
                        <i class="fas fa-exclamation-triangle me-2"></i>Failed to load order
                    </h2>
                    <p class="text-center text-muted">${error.message}</p>
                    <div class="text-center mt-4">
                        <a href="/admin/orders" class="btn btn-secondary"><i class="fas fa-arrow-left me-2"></i>Back to Orders</a>
                    </div>
                `;
                container.style.opacity = '1';
            }
            window.showToast(`Failed to load order: ${error.message}`, 'danger');
        }
    };
    // Initial call remains here
    window.fetchAndDisplayOrderDetails();
});