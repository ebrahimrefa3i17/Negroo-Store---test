// Negroo Store/public/js/admin-categories.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the category form page (new or edit)
    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
        initializeCategoryForm();
    }

    // Check if we are on the categories list page
    const categoriesTableBody = document.getElementById('categories-table-body');
    if (categoriesTableBody) {
        loadCategoriesTable();
    }
});


// --- Functions for Category Form (Add/Edit) ---
async function initializeCategoryForm() {
    const categoryForm = document.getElementById('categoryForm');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const parentCategorySelect = document.getElementById('parentCategory');
    const categoryImageInput = document.getElementById('categoryImage');
    const categoryImagePreview = document.getElementById('categoryImagePreview'); // Use ID
    const categoryMediaPlaceholder = document.getElementById('categoryMediaPlaceholder'); // Use ID
    const submitButton = categoryForm.querySelector('button[type="submit"]');
    const isFeaturedCheckbox = document.getElementById('isFeatured'); // Get isFeatured checkbox

    const isEditMode = window.location.pathname.includes('/edit/');
    let categoryId = null;

    // Load existing category data if in edit mode
    if (isEditMode) {
        categoryId = window.location.pathname.split('/').pop(); // Get ID from URL
        document.title = `Edit Category`; // Placeholder, will update with category name
        try {
            const response = await window.fetchWithAuth(`/api/admin/categories/${categoryId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch category data.');
            }
            const categoryData = await response.json();
            
            // Populate form fields
            nameInput.value = categoryData.name;
            descriptionInput.value = categoryData.description;
            
            // Ensure isFeaturedCheckbox exists before trying to set its checked property
            if (isFeaturedCheckbox) {
                isFeaturedCheckbox.checked = categoryData.isFeatured;
            } else {
                console.warn("isFeaturedCheckbox element not found in category form.");
            }
            
            // Populate image preview if URL exists
            if (categoryData.imageUrl && categoryImagePreview) { // Check categoryImagePreview exists
                categoryImagePreview.src = categoryData.imageUrl;
                categoryImagePreview.style.display = 'block'; // Use style.display for direct control
                if (categoryMediaPlaceholder) { // Check placeholder exists
                    categoryMediaPlaceholder.style.display = 'none'; // Use style.display
                }
            } else if (categoryImagePreview && categoryMediaPlaceholder) { // Ensure they exist for default state
                categoryImagePreview.style.display = 'none';
                categoryMediaPlaceholder.style.display = 'block';
            }

            // Select parent category if exists
            if (categoryData.parentCategory && categoryData.parentCategory._id) {
                parentCategorySelect.value = categoryData.parentCategory._id;
            } else {
                parentCategorySelect.value = ''; // Ensure "No Parent" is selected for top-level
            }

            document.title = `Edit Category: ${categoryData.name}`; // Update title with actual category name

        } catch (error) {
            console.error('Error loading category for edit:', error);
            window.showToast('Error loading category data. ' + error.message, 'danger');
            // Redirect or show error page
        }
    } else { // If in Add New Category mode
        // Ensure initial state for image preview is correct for Add New
        if (categoryImagePreview && categoryMediaPlaceholder) {
            categoryImagePreview.style.display = 'none';
            categoryMediaPlaceholder.style.display = 'block';
        }
    }

    // Populate Parent Category dropdown
    await populateParentCategoryDropdown(parentCategorySelect, categoryId);


    // ✅ Moved image preview logic from inline script to here
    if (categoryImageInput && categoryImagePreview && categoryMediaPlaceholder) {
        categoryImageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    categoryImagePreview.src = e.target.result;
                    categoryImagePreview.style.display = 'block'; // Use style.display
                    categoryMediaPlaceholder.style.display = 'none'; // Use style.display
                };
                reader.readAsDataURL(file);
            } else {
                categoryImagePreview.src = '#';
                categoryImagePreview.style.display = 'none';
                categoryMediaPlaceholder.style.display = 'block';
            }
        });
    }


    // Handle form submission
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

        const formData = new FormData();
        formData.append('name', nameInput.value);
        formData.append('description', descriptionInput.value);
        if (parentCategorySelect.value) { // Only append if a parent is selected
            formData.append('parentCategory', parentCategorySelect.value);
        }
        if (categoryImageInput.files.length > 0) {
            formData.append('categoryImage', categoryImageInput.files[0]);
        }
        // Ensure isFeaturedCheckbox exists before accessing its checked property
        if (isFeaturedCheckbox) {
            formData.append('isFeatured', isFeaturedCheckbox.checked ? 'true' : 'false');
        } else {
            console.warn("isFeaturedCheckbox element not found during form submission.");
        }

        try {
            let response;
            if (isEditMode) {
                response = await window.fetchWithAuth(`/api/admin/categories/${categoryId}`, {
                    method: 'PUT',
                    body: formData,
                });
            } else {
                response = await window.fetchWithAuth('/api/admin/categories', {
                    method: 'POST',
                    body: formData,
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save category.');
            }

            const result = await response.json();
            window.showToast(result.message, 'success');
            setTimeout(() => {
                window.location.href = '/admin/categories'; // Redirect to categories list
            }, 1500);

        } catch (error) {
            console.error('Category form submission error:', error);
            window.showToast('Error: ' + error.message, 'danger');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-save me-2"></i>Save Category';
        }
    });
}

async function populateParentCategoryDropdown(selectElement, currentCategoryId = null) {
    try {
        const response = await window.fetchWithAuth('/api/admin/categories');
        if (!response.ok) {
            throw new Error('Failed to fetch categories for dropdown.');
        }
        const data = await response.json();
        const categories = data.categories;

        // Clear existing options except the first "No Parent" one
        selectElement.innerHTML = '<option value="">No Parent (Top-level Category)</option>';

        categories.forEach(category => {
            // Prevent a category from being its own parent or a parent of its own descendant
            if (category._id !== currentCategoryId) {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                
                if (category.parentCategory && category.parentCategory.name) {
                    option.textContent = `${category.parentCategory.name} &gt; ${category.name}`;
                }

                selectElement.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error populating parent category dropdown:', error);
        window.showToast('Error loading parent categories.', 'danger');
    }
}


// --- Functions for Categories List Page ---
async function loadCategoriesTable() {
    const categoriesTableBody = document.getElementById('categories-table-body');
    const paginationContainer = document.getElementById('categories-pagination');
    
    if (!paginationContainer) {
        console.warn('Pagination container not found on this page. Skipping pagination rendering.');
    }

    let currentPage = 1;
    let currentLimit = 10;
    let currentSortBy = 'createdAt';
    let currentSortOrder = 'desc';

    async function fetchAndRenderCategories() {
        categoriesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading categories...</td></tr>';
        try {
            const url = `/api/admin/categories?page=${currentPage}&limit=${currentLimit}&sortBy=${currentSortBy}&sortOrder=${currentSortOrder}`;
            const response = await window.fetchWithAuth(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch categories.');
            }
            const data = await response.json();
            const categories = data.categories;
            const totalPages = data.totalPages;

            categoriesTableBody.innerHTML = ''; // Clear loading message

            if (categories.length === 0) {
                categoriesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No categories found.</td></tr>';
            } else {
                categories.forEach(category => {
                    const row = document.createElement('tr');
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
                        <td>
                            <div class="form-check form-switch d-inline-block me-3">
                                <input class="form-check-input is-featured-checkbox" type="checkbox" id="featuredSwitch-${category._id}" data-id="${category._id}" ${category.isFeatured ? 'checked' : ''}>
                                <label class="form-check-label" for="featuredSwitch-${category._id}">Featured</label>
                            </div>
                        </td>
                        <td>
                            <a href="/admin/categories/edit/${category._id}" class="btn btn-sm btn-info me-2"><i class="fas fa-edit"></i> Edit</a>
                            <button class="btn btn-sm btn-danger delete-category-btn" data-id="${category._id}"><i class="fas fa-trash-alt"></i> Delete</button>
                        </td>
                    `;
                    categoriesTableBody.appendChild(row);
                });

                // Add event listeners for delete buttons
                categoriesTableBody.querySelectorAll('.delete-category-btn').forEach(button => {
                    button.addEventListener('click', async () => {
                        const categoryId = button.dataset.id;
                        if (confirm('Are you sure you want to delete this category?')) {
                            try {
                                const response = await window.fetchWithAuth(`/api/admin/categories/${categoryId}`, {
                                    method: 'DELETE'
                                });
                                if (!response.ok) {
                                    const errorData = await response.json();
                                    throw new Error(errorData.message || 'Failed to delete category.');
                                }
                                window.showToast('Category deleted successfully!', 'success');
                                fetchAndRenderCategories(); // Reload table
                            } catch (error) {
                                console.error('Error deleting category:', error);
                                window.showToast('Error: ' + error.message, 'danger');
                            }
                        }
                    });
                });

                // ✅ MODIFIED: Add event listeners for isFeatured checkboxes - removed fetchAndRenderCategories() on success
                categoriesTableBody.querySelectorAll('.is-featured-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', async (event) => {
                        const categoryId = event.target.dataset.id;
                        const isFeatured = event.target.checked;
                        
                        // Optimistic UI update (optional, but good for responsiveness)
                        // The checkbox state is already changed by the browser
                        
                        try {
                            const response = await window.fetchWithAuth(`/api/admin/categories/${categoryId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isFeatured: isFeatured })
                            });
                            const data = await response.json();
                            if (response.ok) {
                                window.showToast(`Category '${data.category.name}' featured status updated to ${isFeatured}.`, 'success');
                                // DO NOT call fetchAndRenderCategories() here to prevent flicker
                            } else {
                                throw new Error(data.message || 'Failed to update featured status.');
                            }
                        } catch (error) {
                            console.error('Error updating featured status:', error);
                            window.showToast(`Error updating featured status: ${error.message}`, 'danger');
                            event.target.checked = !isFeatured; // Revert checkbox state on error
                        }
                    });
                });
            }
            if (paginationContainer) {
                window.renderPagination(paginationContainer, currentPage, totalPages, (page) => {
                    currentPage = page;
                    fetchAndRenderCategories();
                });
            }


            // Re-attach sort event listeners for headers (defined in admin-core.js normally)
            document.querySelectorAll('.sortable-header').forEach(header => {
                header.removeEventListener('click', handleSortClick); // Prevent duplicate listeners
                header.addEventListener('click', handleSortClick);
            });
            window.updateSortIcons(currentSortBy, currentSortOrder); // Update icons for current sort

        } catch (error) {
            console.error('Error loading categories table:', error);
            categoriesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading categories: ${error.message}</td></tr>`;
            window.showToast('Error loading categories: ' + error.message, 'danger');
        }
    }

    // Handle sorting (هذه الدوال يجب أن تكون معرّفة عالمياً في admin-core.js أو هنا)
    function handleSortClick(event) {
        const header = event.currentTarget;
        const sortBy = header.dataset.sortBy;
        let sortOrder = header.dataset.sortOrder;

        if (currentSortBy === sortBy) {
            currentSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortBy = sortBy;
            currentSortOrder = 'asc'; // Default to ascending for new sort column
        }
        header.dataset.sortOrder = currentSortOrder; // Update dataset for visual
        fetchAndRenderCategories();
    }

    fetchAndRenderCategories(); // Initial load
}
