// Negroo Store/public/js/admin-core.js - Common Admin Utilities

document.addEventListener('DOMContentLoaded', async () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', window.logoutUser);
    }

    // 1. تحقق من تسجيل الدخول والصلاحيات
    if (!window.isLoggedIn()) {
        window.showToast('Please log in to access the admin panel.', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    const currentUser = window.getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        window.showToast('Access denied. Administrator privileges required.', 'danger');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
    }
    console.log('Admin core JS loaded for:', currentUser.email);
    const currentPath = window.location.pathname;
    console.log('admin-core.js loaded. Detected Path:', currentPath);


    // Common sorting utilities
    window.updateSortIcons = function(tableType) {
        let headers;
        let sortByVar;
        let sortOrderVar;

        // Determine which sort variables to use based on tableType
        if (tableType === 'products') {
            sortByVar = window.currentProductSortBy;
            sortOrderVar = window.currentProductSortOrder;
            headers = document.querySelectorAll('#products-table-body')[0]?.closest('table')?.querySelectorAll('thead th .sortable-header');
        } else if (tableType === 'orders') {
            sortByVar = window.currentOrderSortBy;
            sortOrderVar = window.currentOrderSortOrder;
            headers = document.getElementById('orders-table-body')?.closest('table')?.querySelectorAll('thead th .sortable-header');
        } else if (tableType === 'categories') {
            sortByVar = window.currentCategorySortBy;
            sortOrderVar = window.currentCategorySortOrder;
            headers = document.querySelectorAll('#categories-table-body')[0]?.closest('table')?.querySelectorAll('thead th .sortable-header');
        } else if (tableType === 'users') {
            sortByVar = window.currentUserSortBy;
            sortOrderVar = window.currentUserSortOrder;
            headers = document.getElementById('users-table-body')?.closest('table')?.querySelectorAll('thead th .sortable-header');
        } else if (tableType === 'reviews') {
            sortByVar = window.currentReviewSortBy;
            sortOrderVar = window.currentReviewSortOrder;
            headers = document.getElementById('reviews-table-body')?.closest('table')?.querySelectorAll('thead th .sortable-header');
        }
        else {
            return;
        }

        if (!headers) return;

        headers.forEach(header => {
            const sortBy = header.dataset.sortBy;
            const sortIcon = header.querySelector('.sort-icon');
            header.classList.remove('asc', 'desc');
            if (sortIcon) {
                sortIcon.classList.remove('fa-sort-up', 'fa-sort-down', 'fa-sort');
                sortIcon.classList.add('fa-sort');
            }

            if (sortBy === sortByVar) {
                header.classList.add(sortOrderVar);
                if (sortIcon) {
                    sortIcon.classList.remove('fa-sort');
                    sortIcon.classList.add(sortOrderVar === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                }
            }
        });
    };

    // ✅ NEW: إضافة فحص لوجود container قبل استخدام appendChild
    window.renderPagination = function(container, currentPage, totalPages, onPageChange) {
        if (!container || typeof container.appendChild !== 'function') { // التحقق من أن container هو عنصر DOM صالح
            console.error('Pagination container is not a valid DOM element or is null.', container);
            return; // إنهاء الدالة إذا كان العنصر غير صالح
        }

        container.innerHTML = '';
        if (totalPages <= 1) return;

        const ul = document.createElement('ul');
        ul.classList.add('pagination');

        const prevLi = document.createElement('li');
        prevLi.classList.add('page-item');
        if (currentPage === 1) prevLi.classList.add('disabled');
        const prevLink = document.createElement('a');
        prevLink.classList.add('page-link');
        prevLink.href = '#';
        prevLink.textContent = 'Previous';
        prevLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) onPageChange(currentPage - 1);
        });
        prevLi.appendChild(prevLink);
        ul.appendChild(prevLi);

        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);

        if (endPage - startPage < 4) {
            if (startPage === 1) endPage = Math.min(totalPages, 5);
            else if (endPage === totalPages) startPage = Math.max(1, totalPages - 4);
        }

        if (startPage > 1) {
            const firstLi = document.createElement('li');
            firstLi.classList.add('page-item');
            const firstLink = document.createElement('a');
            firstLink.classList.add('page-link');
            firstLink.href = '#';
            firstLink.textContent = '1';
            firstLink.addEventListener('click', (e) => {
                e.preventDefault();
                onPageChange(1);
            });
            firstLi.appendChild(firstLink);
            ul.appendChild(firstLi);
            if (startPage > 2) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.classList.add('page-item', 'disabled');
                ellipsisLi.innerHTML = '<span class="page-link">...</span>';
                ul.appendChild(ellipsisLi);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.classList.add('page-item');
            if (i === currentPage) li.classList.add('active');
            const link = document.createElement('a');
            link.classList.add('page-link');
            link.href = '#';
            link.textContent = i;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                onPageChange(i);
            });
            li.appendChild(link);
            ul.appendChild(li);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.classList.add('page-item', 'disabled');
                ellipsisLi.innerHTML = '<span class="page-link">...</span>';
                ul.appendChild(ellipsisLi);
            }
            const lastLi = document.createElement('li');
            lastLi.classList.add('page-item');
            const lastLink = document.createElement('a');
            lastLink.classList.add('page-link');
            lastLink.href = '#';
            lastLink.textContent = totalPages;
            lastLink.addEventListener('click', (e) => {
                e.preventDefault();
                onPageChange(totalPages);
            });
            lastLi.appendChild(lastLink);
            ul.appendChild(lastLi);
        }

        container.appendChild(ul);
    };

    // Products List Logic
    window.currentProductPage = localStorage.getItem('adminProductsCurrentPage') ? parseInt(localStorage.getItem('adminProductsCurrentPage')) : 1;
    window.itemsPerProductPage = 10;
    window.currentProductSortBy = localStorage.getItem('adminProductsSortBy') || 'createdAt';
    window.currentProductSortOrder = localStorage.getItem('adminProductsSortOrder') || 'desc';

    window.fetchAndDisplayAdminProducts = async function() {
        const productsTableBody = document.getElementById('products-table-body');
        const paginationContainer = document.getElementById('products-pagination');
        if (!productsTableBody || !paginationContainer) return;

        productsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading products...</td></tr>';
        paginationContainer.innerHTML = '';

        try {
            const productsResponse = await fetch(`http://localhost:3000/api/admin/products?page=${window.currentProductPage}&limit=${window.itemsPerProductPage}&sortBy=${window.currentProductSortBy}&sortOrder=${window.currentProductSortOrder}`, {
                headers: window.getAuthHeaders()
            });
            if (!productsResponse.ok) {
                const errorData = await productsResponse.json();
                throw new Error(errorData.message || `HTTP error! status: ${productsResponse.status}`);
            }
            const result = await productsResponse.json();
            const products = result.products;
            const totalPages = result.totalPages;

            productsTableBody.innerHTML = '';
            if (products.length === 0) {
                productsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No products found.</td></tr>';
            } else {
                products.forEach(product => {
                    const row = document.createElement('tr');
                    // ✅ MODIFIED: Access product.category.name to display the category name
                    const categoryName = product.category ? product.category.name : 'N/A';
                    row.innerHTML = `
                        <td>${product._id}</td>
                        <td><img src="${product.imageUrl}" alt="${product.name}" class="product-thumb"></td>
                        <td>${product.name}</td>
                        <td>${categoryName}</td>
                        <td>EGP${product.price.toFixed(2)}</td>
                        <td>${product.stock}</td>
                        <td class="action-buttons">
                            <a href="/admin/products/edit/${product._id}" class="btn btn-info btn-sm">Edit</a>
                            <button type="button" class="btn btn-danger btn-sm delete-product-btn" data-product-id="${product._id}" data-product-name="${product.name}">Delete</button>
                        </td>
                    `;
                    productsTableBody.appendChild(row);
                });

                productsTableBody.querySelectorAll('.delete-product-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const productId = event.target.dataset.productId;
                        const productName = event.target.dataset.productName;
                        if (confirm(`Are you sure you want to delete ${productName}?`)) {
                            try {
                                const deleteResponse = await window.fetchWithAuth(`/api/admin/products/${productId}`, {
                                    method: 'DELETE',
                                });

                                if (!deleteResponse.ok) {
                                    const errorData = await deleteResponse.json();
                                    throw new Error(errorData.message || 'Failed to delete product.');
                                }

                                window.showToast(`${productName} deleted successfully!`, 'success');
                                window.fetchAndDisplayAdminProducts();
                            } catch (deleteError) {
                                console.error('Error deleting product:', deleteError);
                                window.showToast(`Failed to delete product: ${deleteError.message}`, 'danger');
                            }
                        }
                    });
                });
            }
            window.renderPagination(paginationContainer, window.currentProductPage, totalPages, (newPage) => {
                window.currentProductPage = newPage;
                window.fetchAndDisplayAdminProducts();
            });
            window.updateSortIcons('products');
            addProductSortEventListeners(); // Attach listeners here once
        } catch (error) {
            console.error('Error fetching admin products:', error);
            productsTableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Failed to load products: ${error.message}</td></tr>`;
            window.showToast(`Failed to load products: ${error.message}`, 'danger');
        }
    };

    function addProductSortEventListeners() {
        const productsTableBodyElem = document.getElementById('products-table-body');
        if (!productsTableBodyElem) return;
        const productSortableHeaders = productsTableBodyElem.closest('table').querySelectorAll('thead th .sortable-header');
        productSortableHeaders.forEach(header => {
            header.removeEventListener('click', handleProductSortClick);
            header.addEventListener('click', handleProductSortClick);
        });
    }

    function handleProductSortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder;
        if (sortBy === window.currentProductSortBy) {
            sortOrder = (window.currentProductSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            if (sortBy === 'price' || sortBy === 'stock' || sortBy === 'createdAt') {
                sortOrder = 'desc';
            } else {
                sortOrder = 'asc';
            }
        }
        window.currentProductSortBy = sortBy;
        window.currentProductSortOrder = sortOrder;
        window.currentProductPage = 1;
        localStorage.setItem('adminProductsSortBy', window.currentProductSortBy);
        localStorage.setItem('adminProductsSortOrder', window.currentProductSortOrder);
        window.fetchAndDisplayAdminProducts();
    }

    // Categories List Logic
    window.currentCategoryPage = localStorage.getItem('adminCategoriesCurrentPage') ? parseInt(localStorage.getItem('adminCategoriesCurrentPage')) : 1;
    window.itemsPerCategoryPage = 10;
    window.currentCategorySortBy = localStorage.getItem('adminCategoriesSortBy') || 'name';
    window.currentCategorySortOrder = localStorage.getItem('adminCategoriesSortOrder') || 'asc';

    window.fetchAndDisplayAdminCategories = async function() {
        const categoriesTableBody = document.getElementById('categories-table-body');
        const paginationContainer = document.getElementById('categories-pagination');
        if (!categoriesTableBody || !paginationContainer) return;

        categoriesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading categories...</td></tr>';
        paginationContainer.innerHTML = '';
        localStorage.removeItem('categories_cache'); // Clear frontend cache to re-fetch

        try {
            const url = `/api/admin/categories?page=${window.currentCategoryPage}&limit=${window.itemsPerCategoryPage}&sortBy=${window.currentCategorySortBy}&sortOrder=${window.currentCategorySortOrder}`;
            const response = await window.fetchWithAuth(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const categories = result.categories;
            const totalPages = result.totalPages;
            // const totalItems = result.totalItems; // Not used currently

            categoriesTableBody.innerHTML = '';
            if (categories.length === 0) {
                categoriesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No categories found.</td></tr>';
            } else {
                categories.forEach(category => {
                    const row = document.createElement('tr');
                    // Determine display name: "Parent > Subcategory" or just "Category Name"
                    // تأكد أن parentCategory يتم جلبه كاملاً (populated) من API
                    const displayName = category.parentCategory && category.parentCategory.name 
                                      ? `${category.parentCategory.name} &gt; ${category.name}`
                                      : category.name;
                    row.innerHTML = `
                        <td>${category._id}</td>
                        <td>
                            <img src="${category.imageUrl}" alt="${category.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                        </td>
                        <td>${displayName}</td>
                        <td>${category.description || ''}</td>
                        <td class="action-buttons">
                            <a href="/admin/categories/edit/${category._id}" class="btn btn-info btn-sm edit-btn">Edit</a>
                            <button type="button" class="btn btn-danger btn-sm delete-category-btn" data-category-id="${category._id}" data-category-name="${category.name}">Delete</button>
                        </td>
                    `;
                    categoriesTableBody.appendChild(row);
                });

                categoriesTableBody.querySelectorAll('.delete-category-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const categoryId = button.dataset.id;
                        const categoryName = button.dataset.categoryName;
                        if (confirm(`Are you sure you want to delete category "${categoryName}"? This will affect products linked to it.`)) {
                            try {
                                const deleteResponse = await window.fetchWithAuth(`/api/admin/categories/${categoryId}`, {
                                    method: 'DELETE'
                                });

                                if (!deleteResponse.ok) {
                                    const errorData = await deleteResponse.json();
                                    throw new Error(errorData.message || 'Failed to delete category.');
                                }

                                window.showToast(`Category "${categoryName}" deleted successfully!`, 'success');
                                localStorage.removeItem('categories_cache');
                                window.fetchAndDisplayAdminCategories();
                            } catch (error) {
                                console.error('Error deleting category:', error);
                                window.showToast('Error: ' + error.message, 'danger');
                            }
                        }
                    });
                });
            }
            window.renderPagination(paginationContainer, window.currentCategoryPage, totalPages, (newPage) => {
                window.currentCategoryPage = newPage;
                window.fetchAndDisplayAdminCategories();
            });
            window.updateSortIcons('categories');
            addCategorySortEventListeners(); // Attach listeners here once
        }
        catch (error) {
            console.error('Error fetching admin categories:', error);
            categoriesTableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Failed to load categories: ${error.message}</td></tr>`;
            window.showToast(`Error: ${error.message}`, 'danger');
    }
    }
    fetchAndDisplayAdminCategories();

    function addCategorySortEventListeners() {
        const categorySortableHeaders = document.querySelectorAll('#categories-table-body')[0].closest('table').querySelectorAll('thead th .sortable-header');
        categorySortableHeaders.forEach(header => {
            header.removeEventListener('click', handleCategorySortClick);
            header.addEventListener('click', handleCategorySortClick);
        });
    }

    function handleCategorySortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder;
        if (sortBy === window.currentCategorySortBy) {
            sortOrder = (window.currentCategorySortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            if (sortBy === 'name') {
                sortOrder = 'asc';
            } else {
                sortOrder = 'desc';
            }
        }
        window.currentCategorySortBy = sortBy;
        window.currentCategorySortOrder = sortOrder;
        window.currentCategoryPage = 1;
        localStorage.setItem('adminCategoriesSortBy', window.currentCategorySortBy);
        localStorage.setItem('adminCategoriesSortOrder', window.currentCategorySortOrder);
        window.fetchAndDisplayAdminCategories();
    }

    // Orders List Logic
    window.currentOrderPage = localStorage.getItem('adminOrdersCurrentPage') ? parseInt(localStorage.getItem('adminOrdersCurrentPage')) : 1;
    window.itemsPerOrderPage = 10;
    window.currentOrderSortBy = localStorage.getItem('adminOrdersSortBy') || 'createdAt';
    window.currentOrderSortOrder = localStorage.getItem('adminOrdersSortOrder') || 'desc';

    window.fetchAndDisplayAdminOrders = async function() {
        const ordersTableBody = document.getElementById('orders-table-body');
        const paginationContainer = document.getElementById('orders-pagination');
        if (!ordersTableBody || !paginationContainer) return;

        ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading orders...</td></tr>';
        paginationContainer.innerHTML = '';

        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/orders?page=${window.currentOrderPage}&limit=${window.itemsPerOrderPage}&sortBy=${window.currentOrderSortBy}&sortOrder=${window.currentOrderSortOrder}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const orders = result.orders;
            const totalPages = result.totalPages;

            ordersTableBody.innerHTML = '';
            if (orders.length === 0) {
                const noOrdersRow = document.createElement('tr');
                noOrdersRow.innerHTML = '<td colspan="6" class="text-center text-muted">No orders found.</td>';
                ordersTableBody.appendChild(noOrdersRow);
            } else {
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    const customerName = order.userId && order.userId.name ? order.userId.name : (order.shippingAddress && order.shippingAddress.fullName ? order.shippingAddress.fullName : 'N/A');

                    row.innerHTML = `
                        <td>${order._id}</td>
                        <td>${customerName}</td>
                        <td>EGP${order.totalAmount.toFixed(2)}</td>
                        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                        <td>${new Date(order.createdAt).toLocaleString()}</td>
                        <td class="action-buttons">
                            <a href="/admin/orders/${order._id}" class="btn btn-info btn-sm view-order-btn">View Details</a>
                            ${order.status === 'Pending' || order.status === 'Processing' ?
                                `<button class="btn btn-danger btn-sm ms-2 cancel-admin-order-btn" data-order-id="${order._id}">
                                    <i class="fas fa-times-circle"></i> Cancel
                                </button>` : ''
                            }
                        </td>
                    `;
                    ordersTableBody.appendChild(row);
                });
                ordersTableBody.querySelectorAll('.cancel-admin-order-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const orderId = button.dataset.orderId;
                        if (confirm(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`)) {
                            await window.cancelAdminOrder(orderId); // Call global cancelAdminOrder
                        }
                    });
                });
            }
            window.renderPagination(paginationContainer, window.currentOrderPage, totalPages, (newPage) => {
                window.currentOrderPage = newPage;
                window.fetchAndDisplayAdminOrders();
            });
            window.updateSortIcons('orders');
            addOrderSortEventListeners(); // Attach listeners here once
        } catch (error) {
            console.error('Error fetching admin orders:', error);
            ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Failed to load orders: ${error.message}</td></tr>`;
            window.showToast(`Error: ${error.message}`, 'danger');
        }
    };

    function addOrderSortEventListeners() {
        const ordersTableBodyElem = document.getElementById('orders-table-body');
        if (!ordersTableBodyElem) return;
        const orderSortableHeaders = ordersTableBodyElem.closest('table').querySelectorAll('thead th .sortable-header');
        orderSortableHeaders.forEach(header => {
            header.removeEventListener('click', handleOrderSortClick);
            header.addEventListener('click', handleOrderSortClick);
        });
    }

    function handleOrderSortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder;
        if (sortBy === window.currentOrderSortBy) {
            sortOrder = (window.currentOrderSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            if (sortBy === 'createdAt' || sortBy === 'totalAmount') {
                sortOrder = 'desc';
            } else if (sortBy === 'userId.name' || sortBy === 'status') {
                sortOrder = 'asc';
            } else {
                sortOrder = 'desc';
            }
        }
        window.currentOrderSortBy = sortBy;
        window.currentOrderSortOrder = sortOrder;
        window.currentOrderPage = 1;
        localStorage.setItem('adminOrdersSortBy', window.currentOrderSortBy);
        localStorage.setItem('adminOrdersSortOrder', window.currentOrderSortOrder);
        window.fetchAndDisplayAdminOrders();
    }

    // Users List Logic
    window.currentUserPage = localStorage.getItem('adminUsersCurrentPage') ? parseInt(localStorage.getItem('adminUsersCurrentPage')) : 1;
    window.itemsPerUserPage = 10;
    window.currentUserSortBy = localStorage.getItem('adminUsersSortBy') || 'createdAt';
    window.currentUserSortOrder = localStorage.getItem('adminUsersSortOrder') || 'desc';

    window.fetchAndDisplayAdminUsers = async function() {
        const usersTableBody = document.getElementById('users-table-body');
        const paginationContainer = document.getElementById('users-pagination');
        if (!usersTableBody || !paginationContainer) return;

        usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading users...</td></tr>';
        paginationContainer.innerHTML = '';

        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/users?page=${window.currentUserPage}&limit=${window.itemsPerUserPage}&sortBy=${window.currentUserSortBy}&sortOrder=${window.currentUserSortOrder}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const users = result.users;
            const totalPages = result.totalPages;

            usersTableBody.innerHTML = '';
            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found.</td></tr>';
            } else {
                users.forEach(user => {
                    const row = document.createElement('tr');
                    const isCurrentUser = currentUser.id === user._id;
                    row.innerHTML = `
                        <td>${user._id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>
                            <span class="status-badge status-${user.isAdmin ? 'Admin' : 'User'}">
                                ${user.isAdmin ? 'Admin' : 'User'}
                            </span>
                            ${!isCurrentUser ? `
                                <button type="button" class="btn btn-sm btn-outline-info ms-2 toggle-admin-btn" data-user-id="${user._id}" data-is-admin="${user.isAdmin}">
                                    ${user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                                </button>
                            ` : ''}
                        </td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td class="action-buttons">
                            ${!isCurrentUser ? `
                                <button type="button" class="btn btn-danger btn-sm delete-user-btn" data-user-id="${user._id}" data-user-name="${user.name}">Delete</button>
                            ` : ''}
                        </td>
                    `;
                    usersTableBody.appendChild(row);
                });

                usersTableBody.querySelectorAll('.delete-user-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const userIdToDelete = event.target.dataset.userId;
                        const userNameToDelete = event.target.dataset.userName;
                        if (confirm(`Are you sure you want to delete user "${userNameToDelete}"? This action cannot be undone.`)) {
                            await window.deleteUser(userIdToDelete, userNameToDelete);
                        }
                    });
                });

                usersTableBody.querySelectorAll('.toggle-admin-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const userIdToToggle = event.target.dataset.userId;
                        const currentAdminStatus = event.target.dataset.isAdmin === 'true';
                        const newStatus = !currentAdminStatus;
                        const confirmationMsg = newStatus ? `Are you sure you want to make this user an ADMIN?` : `Are you sure you want to REVOKE admin status from this user?`;
                        if (confirm(confirmationMsg)) {
                            await window.toggleUserAdminStatus(userIdToToggle, newStatus);
                        }
                    });
                });
            }
            window.renderPagination(paginationContainer, window.currentUserPage, totalPages, (newPage) => {
                window.currentUserPage = newPage;
                window.fetchAndDisplayAdminUsers();
            });
            window.updateSortIcons('users');
            addUsersSortEventListeners(); // Attach listeners here once
        } catch (error) {
            console.error('Error fetching admin users:', error);
            usersTableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Failed to load users: ${error.message}</td></tr>`;
            window.showToast(`Error: ${error.message}`, 'danger');
        }
    };

    // Users related helper functions (globalized)
    window.deleteUser = async function(userId, userName) {
        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete user.');
            }
            window.showToast(`User "${userName}" deleted successfully!`, 'success');
            window.fetchAndDisplayAdminUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            window.showToast(`Failed to delete user: ${error.message}`, 'danger');
        }
    };
    window.toggleUserAdminStatus = async function(userId, newStatus) {
        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAdmin: newStatus })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update user role.');
            }
            window.showToast(`User role updated successfully!`, 'success');
            window.fetchAndDisplayAdminUsers();
        } catch (error) {
            console.error('Error toggling user admin status:', error);
            window.showToast(`Failed to update user role: ${error.message}`, 'danger');
        }
    };

    function addUsersSortEventListeners() {
        const usersTableBodyElem = document.getElementById('users-table-body');
        if (!usersTableBodyElem) return;
        const userSortableHeaders = usersTableBodyElem.closest('table').querySelectorAll('thead th .sortable-header');
        userSortableHeaders.forEach(header => {
            header.removeEventListener('click', handleUserSortClick);
            header.addEventListener('click', handleUserSortClick);
        });
    }

    function handleUserSortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder;
        if (sortBy === window.currentUserSortBy) {
            sortOrder = (window.currentUserSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            if (sortBy === 'name' || sortBy === 'email') {
                sortOrder = 'asc';
            } else if (sortBy === 'createdAt') {
                sortOrder = 'desc';
            } else {
                sortOrder = 'asc';
            }
        }
        window.currentUserSortBy = sortBy;
        window.currentUserSortOrder = sortOrder;
        window.currentUserPage = 1;
        localStorage.setItem('adminUsersSortBy', window.currentUserSortBy);
        localStorage.setItem('adminUsersSortOrder', window.currentUserSortOrder);
        window.fetchAndDisplayAdminUsers();
    }

    // Reviews List Logic
    window.currentReviewPage = localStorage.getItem('adminReviewsCurrentPage') ? parseInt(localStorage.getItem('adminReviewsCurrentPage')) : 1;
    window.itemsPerReviewPage = 10;
    window.currentReviewSortBy = localStorage.getItem('adminReviewsSortBy') || 'createdAt';
    window.currentReviewSortOrder = localStorage.getItem('adminReviewsSortOrder') || 'desc';
    window.currentFilterApprovedStatus = localStorage.getItem('adminReviewsFilterApprovedStatus') || 'All';

    window.fetchAndDisplayAdminReviews = async function() {
        const reviewsTableBody = document.getElementById('reviews-table-body');
        const paginationContainer = document.getElementById('reviews-pagination');
        const reviewStatusFilter = document.getElementById('reviewStatusFilter');
        if (!reviewsTableBody || !paginationContainer) return;

        reviewsTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Loading reviews...</td></tr>';
        paginationContainer.innerHTML = '';

        let apiUrl = `http://localhost:3000/api/admin/reviews?page=${window.currentReviewPage}&limit=${window.itemsPerReviewPage}&sortBy=${window.currentReviewSortBy}&sortOrder=${window.currentReviewSortOrder}`;
        if (window.currentFilterApprovedStatus !== 'All') {
            apiUrl += `&approved=${window.currentFilterApprovedStatus}`;
        }

        try {
            const response = await window.fetchWithAuth(apiUrl);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const reviews = result.reviews;
            const totalPages = result.totalPages;

            reviewsTableBody.innerHTML = '';
            if (reviews.length === 0) {
                reviewsTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No reviews found.</td></tr>';
            } else {
                reviews.forEach(review => {
                    const row = document.createElement('tr');
                    const userName = review.userId ? review.userId.name : 'N/A';
                    const productName = review.productId ? review.productId.name : 'N/A';
                    const ratingStars = getStarHtml(review.rating);
                    const statusClass = review.isApproved ? 'status-Delivered' : 'status-Pending';
                    const statusText = review.isApproved ? 'Approved' : 'Pending';

                    row.innerHTML = `
                        <td>${review._id}</td>
                        <td>${productName}</td>
                        <td>${userName}</td>
                        <td>${ratingStars}</td>
                        <td>${review.comment || 'N/A'}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${new Date(review.createdAt).toLocaleDateString()}</td>
                        <td class="action-buttons">
                            ${!review.isApproved ? `
                                <button type="button" class="btn btn-success btn-sm approve-review-btn" data-review-id="${review._id}"><i class="fas fa-check"></i> Approve</button>
                            ` : `
                                <button type="button" class="btn btn-warning btn-sm disapprove-review-btn" data-review-id="${review._id}"><i class="fas fa-undo"></i> Disapprove</button>
                            `}
                            <button type="button" class="btn btn-danger btn-sm delete-review-btn" data-review-id="${review._id}"><i class="fas fa-trash-alt"></i> Delete</button>
                        </td>
                    `;
                    reviewsTableBody.appendChild(row);
                });

                reviewsTableBody.querySelectorAll('.approve-review-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const reviewId = event.target.dataset.reviewId;
                        if (confirm('Are you sure you want to approve this review?')) {
                            await window.updateReviewApprovalStatus(reviewId, true);
                        }
                    });
                });
                reviewsTableBody.querySelectorAll('.disapprove-review-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const reviewId = event.target.dataset.reviewId;
                        if (confirm('Are you sure you want to disapprove this review? It will be hidden from public view.')) {
                            await window.updateReviewApprovalStatus(reviewId, false);
                        }
                    });
                });
                reviewsTableBody.querySelectorAll('.delete-review-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const reviewId = event.target.dataset.reviewId;
                        if (confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
                            await window.deleteReview(reviewId);
                        }
                    });
                });
            }
            window.renderPagination(paginationContainer, window.currentReviewPage, totalPages, (newPage) => {
                window.currentReviewPage = newPage;
                window.fetchAndDisplayAdminReviews();
            });
            window.updateSortIcons('reviews');
            addReviewsSortEventListeners(); // Attach listeners here once
        } catch (error) {
            console.error('Error fetching admin reviews:', error);
            reviewsTableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Failed to load reviews: ${error.message}</td></tr>`;
            window.showToast(`Error: ${error.message}`, 'danger');
        }
    };

    // Reviews related helper functions (globalized)
    function getStarHtml(rating) {
        let starsHtml = '';
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<i class="fas fa-star text-warning"></i>';
        }
        if (halfStar) {
            starsHtml += '<i class="fas fa-star-half-alt text-warning"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<i class="far fa-star text-warning"></i>';
        }
        return starsHtml;
    }

    window.updateReviewApprovalStatus = async function(reviewId, isApproved) {
        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/reviews/${reviewId}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isApproved })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update review status.');
            }
            window.showToast(`Review status updated to ${isApproved ? 'Approved' : 'Pending'}!`, 'success');
            window.fetchAndDisplayAdminReviews();
        } catch (error) {
            console.error('Error updating review approval status:', error);
            window.showToast(`Failed to update review status: ${error.message}`, 'danger');
        }
    };

    window.deleteReview = async function(reviewId) {
        if (!confirm('Are you sure you want to delete this review permanently?')) return;
        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/admin/reviews/${reviewId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete review.');
            }
            window.showToast('Review deleted successfully!', 'success');
            window.fetchAndDisplayAdminReviews();
        } catch (error) {
            console.error('Error deleting review:', error);
            window.showToast(`Failed to delete review: ${error.message}`, 'danger');
        }
    };

    function addReviewsSortEventListeners() {
        const reviewsTableBodyElem = document.getElementById('reviews-table-body');
        if (!reviewsTableBodyElem) return;
        const reviewSortableHeaders = reviewsTableBodyElem.closest('table').querySelectorAll('thead th .sortable-header');
        reviewSortableHeaders.forEach(header => {
            header.removeEventListener('click', handleReviewsSortClick);
            header.addEventListener('click', handleReviewsSortClick);
        });
    }

    function handleReviewsSortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder;
        if (sortBy === window.currentReviewSortBy) {
            sortOrder = (window.currentReviewSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            if (sortBy === 'rating' || sortBy === 'createdAt') {
                sortOrder = 'desc';
            } else if (sortBy === 'productId.name' || sortBy === 'userId.name' || sortBy === 'isApproved') {
                    sortOrder = 'asc';
                } else {
                    sortOrder = 'desc';
                }
            }
            window.currentReviewSortBy = sortBy;
            window.currentReviewSortOrder = sortOrder;
            window.currentReviewPage = 1;
            localStorage.setItem('adminReviewsSortBy', window.currentReviewSortBy);
            localStorage.setItem('adminReviewsSortOrder', window.currentReviewSortOrder);
            window.fetchAndDisplayAdminReviews();
        }

        // Order Details related helper functions (globalized)
        window.cancelAdminOrder = async function(orderId) {
            try {
                const response = await window.fetchWithAuth(`http://localhost:3000/api/orders/cancel/${orderId}`, {
                    method: 'PUT'
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to cancel order.');
                }
                window.showToast(data.message, 'success');
                // Re-fetch lists if on the correct page
                if (currentPath === '/admin/orders') {
                    window.fetchAndDisplayAdminOrders();
                } else if (currentPath.startsWith('/admin/orders/')) {
                    // Assuming fetchAndDisplayOrderDetails is defined in admin-order-details.js
                    // This function is still in admin-order-details.js, so we keep the check here.
                    if (typeof window.fetchAndDisplayOrderDetails === 'function') {
                        window.fetchAndDisplayOrderDetails();
                    }
                }
            } catch (error) {
                console.error('Error cancelling order:', error);
                window.showToast(`Error cancelling order: ${error.message}`, 'danger');
            }
        };


        // ***************************************************************
        // هذا هو الجزء الذي يقوم باستدعاء الدوال الصحيحة بناءً على المسار الحالي
        // ***************************************************************
        if (currentPath === '/admin' || currentPath.endsWith('/admin/')) {
            const productCountElem = document.getElementById('productCount');
            if (productCountElem) { // Check if dashboard elements exist
                (async function() { // Self-executing async function
                    try {
                        const response = await window.fetchWithAuth('http://localhost:3000/api/admin/dashboard-stats');
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to fetch dashboard stats.');
                        }
                        const data = await response.json();
                        document.getElementById('productCount').textContent = data.productCount;
                        document.getElementById('orderCount').textContent = data.orderCount;
                        document.getElementById('pendingOrdersCount').textContent = data.pendingOrdersCount;
                        document.getElementById('deliveredOrdersCount').textContent = data.deliveredOrdersCount;
                        document.getElementById('totalDeliveredAmount').textContent = `EGP${data.totalDeliveredAmount.toFixed(2)}`;
                        document.getElementById('lowStockProductCount').textContent = data.lowStockProductCount;
                    } catch (error) {
                        console.error('Error fetching admin dashboard stats API:', error);
                        window.showToast(`Failed to load dashboard stats: ${error.message}`, 'danger');
                    }
                })();
            }
        } else if (currentPath === '/admin/products') {
            window.fetchAndDisplayAdminProducts();
        } else if (currentPath.startsWith('/admin/products/edit/') || currentPath === '/admin/products/new') {
            // Logic for productForm is now directly in admin-product-form.js
            // This case doesn't need to call a function from admin-core, as admin-product-form.js has its own DOMContentLoaded listener
        } else if (currentPath === '/admin/orders') {
            window.fetchAndDisplayAdminOrders();
        } else if (currentPath.startsWith('/admin/orders/')) {
            // Logic for orderDetails is in admin-order-details.js, which has its own DOMContentLoaded listener
        } else if (currentPath === '/admin/categories') {
            window.fetchAndDisplayAdminCategories();
        } else if (currentPath.startsWith('/admin/categories/edit/') || currentPath === '/admin/categories/new') {
            // Logic for categoryForm is now directly in admin-product-form.js
            // This case doesn't need to call a function from admin-core, as admin-product-form.js has its own DOMContentLoaded listener
        } else if (currentPath === '/admin/users') {
            window.fetchAndDisplayAdminUsers();
        } else if (currentPath === '/admin/reviews') {
            const reviewStatusFilter = document.getElementById('reviewStatusFilter');
            if (reviewStatusFilter) {
                reviewStatusFilter.value = window.currentFilterApprovedStatus;
                reviewStatusFilter.addEventListener('change', () => {
                    window.currentFilterApprovedStatus = reviewStatusFilter.value;
                    localStorage.setItem('adminReviewsFilterApprovedStatus', window.currentFilterApprovedStatus);
                    window.currentReviewPage = 1;
                    window.fetchAndDisplayAdminReviews();
                });
            }
            window.fetchAndDisplayAdminReviews();
        }
        // ✅ NEW: Add call for Collections page
        else if (currentPath === '/admin/collections') {
            // Check if window.fetchAndDisplayAdminCollections is defined (it should be in admin-collections.js)
            if (typeof window.fetchAndDisplayAdminCollections === 'function') {
                window.fetchAndDisplayAdminCollections();
            } else {
                console.error('window.fetchAndDisplayAdminCollections is not defined. Cannot load collections.');
            }
        }
    });