// public/js/admin-coupons.js

document.addEventListener('DOMContentLoaded', async () => {
    const couponForm = document.getElementById('couponForm');
    const couponFormMessage = document.getElementById('coupon-form-message');
    const couponsTableBody = document.getElementById('coupons-table-body');
    const couponsPagination = document.getElementById('coupons-pagination');

    let currentSortBy = 'createdAt';
    let currentSortOrder = 'desc';
    let currentPage = 1;
    const limit = 10; // Items per page

    // Function to fetch and display coupons
    async function fetchAndDisplayCoupons() {
        couponsTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Loading coupons...</td></tr>';
        try {
            const response = await fetch(`http://localhost:3000/api/coupons?limit=${limit}&page=${currentPage}&sortBy=${currentSortBy}&sortOrder=${currentSortOrder}`, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch coupons.');
            }

            couponsTableBody.innerHTML = ''; // Clear loading message

            if (data.length === 0) {
                couponsTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No coupons found.</td></tr>';
                return;
            }

            data.forEach(coupon => {
                const row = document.createElement('tr');
                const expiresAtDate = coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'Never';
                const expiresAtTime = coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleTimeString() : '';

                row.innerHTML = `
                    <td>${coupon.code}</td>
                    <td>${coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed'}</td>
                    <td>${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : ' EGP'}</td>
                    <td>EGP${coupon.minOrderAmount.toFixed(2)}</td>
                    <td>${coupon.maxDiscountAmount !== null ? `EGP${coupon.maxDiscountAmount.toFixed(2)}` : 'No Cap'}</td>
                    <td>${coupon.timesUsed} / ${coupon.usageLimit === 0 ? 'Unlimited' : coupon.usageLimit}</td>
                    <td>${expiresAtDate} ${expiresAtTime}</td>
                    <td>${coupon.isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>'}</td>
                    <td>
                        <button class="btn btn-sm btn-info edit-coupon-btn me-2" data-id="${coupon._id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger delete-coupon-btn" data-id="${coupon._id}"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                couponsTableBody.appendChild(row);
            });

            // Pagination (basic example, can be extended)
            // For now, coupons API does not return totalPages, so we mock it for display
            // Assumed there's no pagination on GET /api/coupons as per current implementation
            // If the backend `GET /api/coupons` eventually supports pagination, this part needs adjustment.
            // For now, this simply displays the fetched coupons without pagination controls
            couponsPagination.innerHTML = '';


        } catch (error) {
            console.error('Error fetching and displaying coupons:', error);
            couponsTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Failed to load coupons: ${error.message}</td></tr>`;
            window.showToast(`Failed to load coupons: ${error.message}`, 'danger');
        }
    }

    // Handle coupon form submission (Create/Update)
    couponForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(couponForm);
        const couponData = {};
        for (const [key, value] of formData.entries()) {
            if (key === 'isActive') {
                couponData[key] = value === 'on'; // Checkbox value is 'on' if checked
            } else if (key === 'expiresAt' && value === '') {
                couponData[key] = null; // Send null for empty expiry date
            } else if (key === 'maxDiscountAmount' && value === '') {
                couponData[key] = null; // Send null for empty max discount
            } else if (key === 'usageLimit' && value === '') {
                couponData[key] = 0; // Send 0 for empty usage limit (unlimited)
            }
            else {
                couponData[key] = value;
            }
        }
        // Ensure discountValue, minOrderAmount, maxDiscountAmount, usageLimit are numbers
        couponData.discountValue = parseFloat(couponData.discountValue);
        couponData.minOrderAmount = parseFloat(couponData.minOrderAmount);
        if (couponData.maxDiscountAmount !== null) couponData.maxDiscountAmount = parseFloat(couponData.maxDiscountAmount);
        if (couponData.usageLimit !== 0) couponData.usageLimit = parseInt(couponData.usageLimit);


        const couponId = couponForm.dataset.couponId; // Check if we are editing an existing coupon
        const method = couponId ? 'PUT' : 'POST';
        const url = couponId ? `http://localhost:3000/api/coupons/${couponId}` : 'http://localhost:3000/api/coupons';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { ...window.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(couponData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Failed to ${couponId ? 'update' : 'create'} coupon.`);
            }

            window.showToast(data.message, 'success');
            couponFormMessage.textContent = data.message;
            couponFormMessage.className = 'alert alert-success';
            couponFormMessage.classList.remove('d-none');
            couponForm.reset(); // Clear form after successful submission
            couponForm.removeAttribute('data-coupon-id'); // Clear edit state
            // Reset "Is Active" checkbox state
            document.getElementById('isActive').checked = true;
            
            fetchAndDisplayCoupons(); // Refresh the list

        } catch (error) {
            console.error(`Error ${couponId ? 'updating' : 'creating'} coupon:`, error);
            couponFormMessage.textContent = `Error: ${error.message}`;
            couponFormMessage.className = 'alert alert-danger';
            couponFormMessage.classList.remove('d-none');
            window.showToast(`Failed to ${couponId ? 'update' : 'create'} coupon: ${error.message}`, 'danger');
        }
    });

    // Handle Edit and Delete buttons using event delegation
    couponsTableBody.addEventListener('click', async (event) => {
        if (event.target.closest('.edit-coupon-btn')) {
            const button = event.target.closest('.edit-coupon-btn');
            const couponId = button.dataset.id;
            try {
                const response = await fetch(`http://localhost:3000/api/coupons/${couponId}`, {
                    headers: window.getAuthHeaders()
                }); // Note: Using coupon ID, not code, for admin purposes
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to fetch coupon details for editing.');
                }
                // Populate form for editing
                couponForm.dataset.couponId = couponId;
                document.getElementById('code').value = data.code;
                document.getElementById('discountType').value = data.discountType;
                document.getElementById('discountValue').value = data.discountValue;
                document.getElementById('minOrderAmount').value = data.minOrderAmount;
                document.getElementById('maxDiscountAmount').value = data.maxDiscountAmount !== null ? data.maxDiscountAmount : '';
                document.getElementById('usageLimit').value = data.usageLimit;
                document.getElementById('expiresAt').value = data.expiresAt ? new Date(data.expiresAt).toISOString().slice(0, 16) : ''; // Format for datetime-local
                document.getElementById('isActive').checked = data.isActive;

                window.showToast('Coupon loaded for editing.', 'info');
                // Scroll to top of form
                couponForm.scrollIntoView({ behavior: 'smooth' });

            } catch (error) {
                console.error('Error fetching coupon for edit:', error);
                window.showToast(`Failed to load coupon for edit: ${error.message}`, 'danger');
            }
        } else if (event.target.closest('.delete-coupon-btn')) {
            const button = event.target.closest('.delete-coupon-btn');
            const couponId = button.dataset.id;
            if (confirm('Are you sure you want to delete this coupon?')) {
                try {
                    const response = await fetch(`http://localhost:3000/api/coupons/${couponId}`, {
                        method: 'DELETE',
                        headers: window.getAuthHeaders()
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to delete coupon.');
                    }
                    window.showToast(data.message, 'success');
                    fetchAndDisplayCoupons(); // Refresh the list
                } catch (error) {
                    console.error('Error deleting coupon:', error);
                    window.showToast(`Failed to delete coupon: ${error.message}`, 'danger');
                }
            }
        }
    });

    // Initial fetch of coupons when page loads
    fetchAndDisplayCoupons();
});