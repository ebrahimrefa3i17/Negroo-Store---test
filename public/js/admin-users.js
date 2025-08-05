// public/js/admin-users.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the users list page
    const usersTableBody = document.getElementById('users-table-body');
    if (usersTableBody) {
        // Call the global function defined in admin-core.js to fetch and display users
        if (typeof window.fetchAndDisplayAdminUsers === 'function') {
            window.fetchAndDisplayAdminUsers();
        } else {
            console.error("window.fetchAndDisplayAdminUsers is not defined. Admin users list will not load.");
            usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">خطأ: وظيفة تحميل المستخدمين غير متاحة.</td></tr>';
            window.showToast('فشل في تحميل المستخدمين: وظيفة العرض غير موجودة.', 'danger');
        }
    }
});