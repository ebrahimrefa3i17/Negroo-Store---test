// public/js/user-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    // Helper functions (already defined in auth.js, ensure auth.js is loaded first)
    // window.isLoggedIn, window.getCurrentUser, window.showToast

    // Redirect to login if user is not logged in
    if (!window.isLoggedIn()) {
        window.showToast('Please log in to access your profile.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // Get current user data
    const currentUser = window.getCurrentUser();
    if (!currentUser) {
        window.showToast('User data not found. Please log in again.', 'danger');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // عرض اسم المستخدم في لوحة التحكم (إذا كان العنصر موجودًا)
    const userNameElement = document.getElementById('user-dashboard-name');
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }

    // --- Profile Information Tab ---
    const profileInfoForm = document.getElementById('profile-info-form');
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');

    // Pre-fill profile info
    if (profileNameInput) profileNameInput.value = currentUser.name || '';
    if (profileEmailInput) profileEmailInput.value = currentUser.email || '';
    if (profileEmailInput) profileEmailInput.readOnly = true;

    if (profileInfoForm) {
        profileInfoForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const newName = profileNameInput.value.trim();

            if (!newName) {
                window.showToast('Name cannot be empty.', 'warning');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/users/profile', {
                    method: 'PUT',
                    headers: window.getAuthHeaders(),
                    body: JSON.stringify({ name: newName })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to update profile.');
                }
                localStorage.setItem('user', JSON.stringify({ ...currentUser, name: data.user.name }));
                window.showToast(data.message, 'success');
                if (window.updateNavbar) window.updateNavbar();

            } catch (error) {
                console.error('Error updating profile:', error);
                window.showToast(`Failed to update profile: ${error.message}`, 'danger');
            }
        });
    }

    // --- Shipping Address Tab ---
    const shippingAddressForm = document.getElementById('shipping-address-form');
    const shippingFullNameInput = document.getElementById('shippingFullName');
    const shippingPhoneInput = document.getElementById('shippingPhone');
    const shippingAddressLine1Input = document.getElementById('shippingAddressLine1');
    const shippingCityInput = document.getElementById('shippingCity');
    const shippingCountryInput = document.getElementById('shippingCountry');

    async function fetchShippingAddress() {
        try {
            const response = await fetch('http://localhost:3000/api/users/profile', {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch shipping address.');
            }
            if (data.shippingAddress) {
                shippingFullNameInput.value = data.shippingAddress.fullName || '';
                shippingPhoneInput.value = data.shippingAddress.phone || '';
                shippingAddressLine1Input.value = data.shippingAddress.addressLine1 || '';
                shippingCityInput.value = data.shippingAddress.city || '';
                shippingCountryInput.value = data.shippingAddress.country || '';
            }
        } catch (error) {
            console.error('Error fetching shipping address:', error);
            window.showToast(`Failed to load shipping address: ${error.message}`, 'danger');
        }
    }

    if (shippingAddressForm) {
        shippingAddressForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const shippingAddress = {
                fullName: shippingFullNameInput.value.trim(),
                phone: shippingPhoneInput.value.trim(),
                addressLine1: shippingAddressLine1Input.value.trim(),
                city: shippingCityInput.value.trim(),
                country: shippingCountryInput.value.trim()
            };

            if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.country) {
                window.showToast('All shipping address fields are required.', 'warning');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/users/address', {
                    method: 'PUT',
                    headers: window.getAuthHeaders(),
                    body: JSON.stringify({ shippingAddress })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to update shipping address.');
                }
                localStorage.setItem('user', JSON.stringify({ ...currentUser, shippingAddress: data.user.shippingAddress }));
                window.showToast(data.message, 'success');
            } catch (error) {
                console.error('Error updating shipping address:', error);
                window.showToast(`Failed to update shipping address: ${error.message}`, 'danger');
            }
        });
    }

    // --- Change Password Tab ---
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                window.showToast('All password fields are required.', 'warning');
                return;
            }
            if (newPassword !== confirmNewPassword) {
                window.showToast('New password and confirm password do not match.', 'danger');
                return;
            }
            if (newPassword.length < 6) {
                window.showToast('New password must be at least 6 characters long.', 'warning');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/users/change-password', {
                    method: 'PUT',
                    headers: window.getAuthHeaders(),
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to change password.');
                }
                window.showToast('Password changed successfully!', 'success');
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmNewPasswordInput.value = '';
            } catch (error) {
                console.error('Error changing password:', error);
                window.showToast(`Failed to change password: ${error.message}`, 'danger');
            }
        });
    }

    // --- Tab Switching Logic (Bootstrap's JS handles most of this) ---
    const navTabsContainer = document.querySelector('.user-dashboard-container-custom .list-group');

    if (navTabsContainer) {
        console.log('user-dashboard.js: Navbar tabs container element found for event listener:', navTabsContainer);
        const tabLinks = navTabsContainer.querySelectorAll('.list-group-item[data-bs-toggle="list"]');

        if (tabLinks.length > 0) {
            tabLinks.forEach(tabLink => {
                tabLink.removeEventListener('shown.bs.tab', handleTabShownEvent);
                tabLink.addEventListener('shown.bs.tab', handleTabShownEvent);
            });

            function handleTabShownEvent(event) {
                const activeTabId = event.target.id;
                const activePaneHref = event.target.getAttribute('href');
                console.log(`user-dashboard.js: Tab shown event fired on link! ID: ${activeTabId}, Href: ${activePaneHref}`);

                if (activePaneHref === '#notifications-content' && typeof window.fetchAndDisplayNotifications === 'function') {
                    console.log('user-dashboard.js: Triggering fetchAndDisplayNotifications...');
                    window.fetchAndDisplayNotifications();
                }
                else if (activePaneHref === '#shipping-address') {
                    console.log('user-dashboard.js: Fetching shipping address...');
                    fetchShippingAddress();
                }
            }
        } else {
            console.warn('user-dashboard.js: No tab links found with data-bs-toggle="list". Tab logic may not function correctly.');
        }

        // Handle initial tab selection based on URL hash
        const urlHash = window.location.hash;
        if (urlHash) {
            console.log('user-dashboard.js: URL hash detected:', urlHash);
            const tabLinkForHash = navTabsContainer.querySelector(`a[href="${urlHash}"]`);
            if (tabLinkForHash) {
                console.log('user-dashboard.js: Found tab link for hash, activating.');
                const bsTab = new bootstrap.Tab(tabLinkForHash);
                bsTab.show();
                if (urlHash === '#notifications-content' && typeof window.fetchAndDisplayNotifications === 'function') {
                    console.log('user-dashboard.js: Initial load with hash: Fetching notifications for the notifications tab...');
                    window.fetchAndDisplayNotifications();
                }
                else if (urlHash === '#shipping-address') {
                    console.log('user-dashboard.js: Initial load with hash: Fetching shipping address...');
                    fetchShippingAddress();
                }
            } else {
                console.log('user-dashboard.js: Tab link not found for hash. Activating default tab.');
                const defaultTab = navTabsContainer.querySelector('a[href="#profile-info"]');
                if (defaultTab) {
                    new bootstrap.Tab(defaultTab).show();
                }
            }
        } else {
            console.log('user-dashboard.js: No URL hash. Activating default tab.');
            const defaultTab = navTabsContainer.querySelector('a[href="#profile-info"]');
            if (defaultTab) {
                new bootstrap.Tab(defaultTab).show();
            }
        }
    } else {
        console.warn('user-dashboard.js: Tab container (.user-dashboard-container-custom .list-group) not found. Tab logic may not function correctly.');
    }


    // Handle logout button in dashboard
    const logoutUserDashboardBtn = document.getElementById('logout-user-dashboard');
    if (logoutUserDashboardBtn) {
        logoutUserDashboardBtn.addEventListener('click', (event) => {
            event.preventDefault();
            window.logoutUser();
        });
    }

    // Update Navbar and cart count on page load
    // تأكد من استدعاء هذه الوظائف لضمان تحديث Navbar والقوائم المنسدلة
    if (window.updateNavbar) {
        window.updateNavbar(); // هذا يستدعي populateCategoriesDropdown() و updateCartCount() و updateNotificationCount()
    }
});