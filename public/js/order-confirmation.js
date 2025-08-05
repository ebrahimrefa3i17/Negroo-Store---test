document.addEventListener('DOMContentLoaded', () => {
    const orderIdSpan = document.getElementById('order-id');
    const viewMyOrdersBtn = document.getElementById('view-my-orders-btn');

    // Get order ID and guest flag from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    let orderId = urlParams.get('orderId');
    const isGuestOrder = urlParams.get('guest') === 'true';

    // If it's a guest order, try to get the order ID from localStorage as fallback
    if (!orderId && isGuestOrder) {
        orderId = localStorage.getItem('guestOrderIdForConfirmation');
        // Clear it immediately after reading to prevent stale data
        localStorage.removeItem('guestOrderIdForConfirmation'); 
    }

    if (orderIdSpan) {
        if (orderId) {
            orderIdSpan.textContent = orderId;
        } else {
            orderIdSpan.textContent = 'N/A (ID not found)';
            window.showToast('Order ID not found for confirmation. Please contact support if you need assistance.', 'warning');
        }
    }

    // Hide "View My Orders" button for guest users
    if (viewMyOrdersBtn) {
        if (isGuestOrder) {
            viewMyOrdersBtn.style.display = 'none';
        } else {
            // For logged-in users, ensure it's visible, and link to their orders page
            viewMyOrdersBtn.style.display = 'block';
            viewMyOrdersBtn.href = 'my-orders.html'; // Ensure correct link
        }
    }

    // Update Navbar after loading page content
    if (window.updateNavbar) {
        window.updateNavbar();
    }
});