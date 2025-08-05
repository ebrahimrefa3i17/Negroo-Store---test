// public/js/notifications.js

// Make the functions globally available immediately upon script load, before DOMContentLoaded fires.
// This ensures other scripts (like user-dashboard.js) can access them reliably.

/**
 * Helper function to display notifications content and attach event listeners.
 * It is called by window.fetchAndDisplayNotifications.
 */
function displayNotificationsContent(notifications, container, desktopCountSpan, mobileCountSpan) {
    container.innerHTML = '';

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-bell fa-5x text-muted mb-3"></i>
                <p class="fs-4 text-muted">You have no notifications.</p>
            </div>
        `;
        return;
    }

    notifications.forEach(notification => {
        const notificationDiv = document.createElement('div');
        notificationDiv.classList.add('card', 'mb-3', 'shadow-sm', 'p-3');
        notificationDiv.classList.add(notification.read ? 'bg-gray-100' : 'bg-white', 'border', notification.read ? 'border-gray-200' : 'border-[#008080]');

        let linkHtml = '';
        if (notification.link) {
            linkHtml = `<a href="${notification.link}" class="cta-button btn-sm mt-2 px-3 py-1.5 inline-flex items-center">View Details</a>`;
        }

        notificationDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="mb-1 ${notification.read ? 'text-gray-600' : 'text-gray-800'}">${notification.message}</h5>
                    <small class="text-gray-500">${new Date(notification.createdAt).toLocaleString()}</small>
                </div>
                <div>
                    ${!notification.read ? `
                        <button class="btn btn-sm bg-green-500 text-white hover:bg-green-600 transition duration-200 rounded-md mark-read-btn" data-notification-id="${notification._id}"><i class="fas fa-check"></i> Mark as Read</button>
                    ` : ''}
                    <button class="btn btn-sm bg-red-500 text-white hover:bg-red-600 transition duration-200 rounded-md delete-notification-btn ms-2" data-notification-id="${notification._id}"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
            ${linkHtml}
        `;
        container.appendChild(notificationDiv);
    });

    // Attach listeners for newly added buttons
    container.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const notificationId = event.target.dataset.notificationId;
            await markNotificationAsRead(notificationId);
        });
    });

    container.querySelectorAll('.delete-notification-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const notificationId = event.target.dataset.notificationId;
            if (confirm('Are you sure you want to delete this notification?')) {
                await deleteNotification(notificationId);
            }
        });
    });
}

/**
 * Marks a notification as read and refreshes the list and count.
 * @param {string} notificationId - The ID of the notification to mark as read.
 */
async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to mark notification as read.');
        }
        window.showToast('Notification marked as read!', 'success');
        // Refresh list and counts after action
        await window.fetchAndDisplayNotifications();
        await window.updateNotificationCount();
    } catch (error) {
        console.error('Error marking notification as read:', error);
        window.showToast(`Failed to mark as read: ${error.message}`, 'danger');
    }
}

/**
 * Deletes a notification and refreshes the list and count.
 * @param {string} notificationId - The ID of the notification to delete.
 */
async function deleteNotification(notificationId) {
    try {
        const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: window.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete notification.');
        }
        window.showToast('Notification deleted successfully!', 'success');
        // Refresh list and counts after action
        await window.fetchAndDisplayNotifications();
        await window.updateNotificationCount();
    } catch (error) {
        console.error('Error deleting notification:', error);
        window.showToast(`Failed to delete notification: ${error.message}`, 'danger');
    }
}

/**
 * Fetches and displays user notifications.
 * This function should be called when the notifications tab is active.
 * @global
 */
window.fetchAndDisplayNotifications = async () => {
    const notificationsListContainer = document.getElementById('notifications-list-container');
    const notificationCountSpan = document.getElementById('notification-count');
    const mobileNotificationCountSpan = document.getElementById('mobile-notification-count');

    if (!notificationsListContainer) {
        console.warn("Notifications container not found for fetchAndDisplayNotifications. Skipping detailed display.");
        // Still attempt to update count even if list container is not present
    }

    if (!window.isLoggedIn()) {
        window.showToast('Please log in to view your notifications.', 'info');
        if (notificationCountSpan) { notificationCountSpan.textContent = '0'; notificationCountSpan.style.display = 'none'; }
        if (mobileNotificationCountSpan) mobileNotificationCountSpan.textContent = '0';
        return;
    }

    if (notificationsListContainer) { // Only show loading spinner if container exists
        notificationsListContainer.innerHTML = '<p class="text-center text-muted py-5">Loading your notifications...</p>';
    }
    
    const url = 'http://localhost:3000/api/notifications'; 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    try {
        const response = await fetch(url, {
            headers: window.getAuthHeaders(),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to load notifications: HTTP status ${response.status}`);
        }

        const notifications = await response.json();
        if (notificationsListContainer) { // Only try to display if container exists
            displayNotificationsContent(notifications, notificationsListContainer, notificationCountSpan, mobileNotificationCountSpan);
        }
        
        // Update counts after fetching all notifications
        const unreadCount = notifications.filter(n => !n.read).length;
        if (notificationCountSpan) {
            notificationCountSpan.textContent = unreadCount;
            notificationCountSpan.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }
        if (mobileNotificationCountSpan) {
            mobileNotificationCountSpan.textContent = unreadCount;
        }

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('Error fetching notifications: Request timed out.', error);
            if (notificationsListContainer) notificationsListContainer.innerHTML = '<p class="text-center text-danger py-5">Failed to load notifications: Request timed out. Please try again.</p>';
            window.showToast('Failed to load notifications: Request timed out.', 'danger');
        } else {
            console.error('Error fetching notifications:', error);
            if (notificationsListContainer) notificationsListContainer.innerHTML = `<p class="text-center text-danger py-5">Failed to load notifications: ${error.message}</p>`;
            window.showToast(`Failed to load notifications: ${error.message}`, 'danger');
        }
        // Ensure counts are reset on error
        if (notificationCountSpan) { notificationCountSpan.textContent = '0'; notificationCountSpan.style.display = 'none'; }
        if (mobileNotificationCountSpan) mobileNotificationCountSpan.textContent = '0';
    }
};

/**
 * Updates the unread notification count in the navbar and mobile menu.
 * @global
 */
window.updateNotificationCount = async () => {
    const notificationCountSpan = document.getElementById('notification-count');
    const mobileNotificationCountSpan = document.getElementById('mobile-notification-count');

    if (!window.isLoggedIn()) {
        if (notificationCountSpan) { notificationCountSpan.textContent = '0'; notificationCountSpan.style.display = 'none'; }
        if (mobileNotificationCountSpan) mobileNotificationCountSpan.textContent = '0';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/notifications/count-unread', {
            headers: window.getAuthHeaders(),
            signal: AbortSignal.timeout(5000) // Shorter timeout for just getting count
        });
        const data = await response.json();
        if (response.ok && typeof data.unreadCount === 'number') {
            if (notificationCountSpan) {
                notificationCountSpan.textContent = data.unreadCount;
                notificationCountSpan.style.display = data.unreadCount > 0 ? 'inline-block' : 'none';
            }
            if (mobileNotificationCountSpan) {
                mobileNotificationCountSpan.textContent = data.unreadCount;
            }
        } else {
            throw new Error(data.message || 'Failed to get unread notification count.');
        }
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        if (notificationCountSpan) { notificationCountSpan.textContent = '0'; notificationCountSpan.style.display = 'none'; }
        if (mobileNotificationCountSpan) mobileNotificationCountSpan.textContent = '0';
        // No toast for count errors unless critical, as it can be frequent
    }
};


// Execute common initialization logic on DOMContentLoaded if needed,
// but the functions are already globally exposed.
document.addEventListener('DOMContentLoaded', () => {
    // No direct calls here. user-dashboard.js or main.js will call window.fetchAndDisplayNotifications
    // or window.updateNotificationCount as needed.
});