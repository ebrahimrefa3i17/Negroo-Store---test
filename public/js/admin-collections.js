document.addEventListener('DOMContentLoaded', async () => {

    // ✅ NEW: Define a function to fetch and display collections (made global)
    window.fetchAndDisplayAdminCollections = async function() {
        // تم التعديل هنا: استهداف tbody مباشرة بالـ ID الصحيح
        const collectionsTableBody = document.getElementById('collections-table-body');

        console.log('[AdminCollectionsJS] fetchAndDisplayAdminCollections called.');
        if (!collectionsTableBody) {
            console.error('[AdminCollectionsJS] collectionsTableBody is null. Cannot proceed.');
            return;
        }
        collectionsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading collections...</td></tr>';
        try {
            // Using window.fetchWithAuth for consistent authentication handling
            const response = await window.fetchWithAuth('http://localhost:3000/api/product-collections?populate=true'); // Populate to get product count
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch collections.');
            }

            collectionsTableBody.innerHTML = ''; // Clear loading message
            if (data.length === 0) {
                collectionsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No collections found.</td></tr>';
                return;
            }

            data.forEach(collection => {
                const row = document.createElement('tr');
                const collectionImageUrl = collection.imageUrl || '/images/placeholder-collection.jpg';
                row.innerHTML = `
                    <td>${collection._id}</td>
                    <td>${collection.name}</td>
                    <td>${collection.description.substring(0, 50)}${collection.description.length > 50 ? '...' : ''}</td>
                    <td><img src="${collectionImageUrl}" alt="${collection.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;"></td>
                    <td>${collection.products ? collection.products.length : 0}</td>
                    <td>
                        <a href="/admin/collections/edit/${collection._id}" class="btn btn-sm btn-info me-2"><i class="fas fa-edit"></i> Edit</a>
                        <button class="btn btn-sm btn-danger delete-collection-btn" data-id="${collection._id}"><i class="fas fa-trash"></i> Delete</button>
                    </td>
                `;
                collectionsTableBody.appendChild(row);
            });

            // Attach delete event listeners
            collectionsTableBody.querySelectorAll('.delete-collection-btn').forEach(button => {
                button.addEventListener('click', handleDeleteCollection);
            });

        } catch (error) {
            console.error('Error fetching collections:', error);
            collectionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load collections: ${error.message}</td></tr>`;
            window.showToast(`Failed to load collections: ${error.message}`, 'danger');
        }
    }


    // Check if on the collection form page
    const collectionForm = document.getElementById('collectionForm');
    const collectionIdInput = document.getElementById('collectionId');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const imageUrlInput = document.getElementById('imageUrl');
    const collectionImagePreview = document.getElementById('collectionImagePreview');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const productsSelect = document.getElementById('products');
    const suggestedOnProductsSelect = document.getElementById('suggestedOnProducts');
    const suggestedOnCategoriesSelect = document.getElementById('suggestedOnCategories');
    const tagsInput = document.getElementById('tags');


    // Function to handle collection deletion
    async function handleDeleteCollection(event) {
        const collectionId = event.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await window.fetchWithAuth(`http://localhost:3000/api/product-collections/${collectionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete collection.');
            }

            window.showToast(data.message || 'Collection deleted successfully!', 'success');
            window.fetchAndDisplayAdminCollections(); // Refresh the table
        } catch (error) {
            console.error('Error deleting collection:', error);
            window.showToast(`Failed to delete collection: ${error.message}`, 'danger');
        }
    }

    // Function to populate dropdowns (products and categories) on the form page
    async function populateFormSelects() {
        console.log('[AdminCollectionsJS] populateFormSelects called.'); // Log
        try {
            // Fetch all products for 'products' and 'suggestedOnProducts' selects
            const productsResponse = await window.fetchWithAuth('http://localhost:3000/api/products?limit=9999'); // Fetch all products
            const productsData = await productsResponse.json();
            const allProducts = productsData.products;

            // Fetch all categories for 'suggestedOnCategories' select
            const categoriesResponse = await window.fetchWithAuth('http://localhost:3000/api/categories?limit=9999'); // Fetch all categories
            const categoriesData = await categoriesResponse.json();
            const allCategories = categoriesData; // Assuming /api/categories returns an array directly

            // Populate 'products' select
            if (productsSelect) {
                productsSelect.innerHTML = '';
                allProducts.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product._id;
                    option.textContent = product.name;
                    productsSelect.appendChild(option);
                });
            }

            // Populate 'suggestedOnProducts' select
            if (suggestedOnProductsSelect) {
                suggestedOnProductsSelect.innerHTML = '';
                allProducts.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product._id;
                    option.textContent = product.name;
                    suggestedOnProductsSelect.appendChild(option);
                });
            }

            // Populate 'suggestedOnCategories' select
            if (suggestedOnCategoriesSelect) {
                suggestedOnCategoriesSelect.innerHTML = '';
                allCategories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category._id;
                    option.textContent = category.name;
                    suggestedOnCategoriesSelect.appendChild(option);
                });
            }

            // If in edit mode, pre-select values
            if (collectionIdInput && collectionIdInput.value) {
                const collectionId = collectionIdInput.value;
                const response = await window.fetchWithAuth(`http://localhost:3000/api/product-collections/${collectionId}`);
                const collectionData = await response.json();

                if (!response.ok) {
                    throw new Error(collectionData.message || 'Failed to fetch collection for editing.');
                }

                // Set form fields
                if (nameInput) nameInput.value = collectionData.name || '';
                if (descriptionInput) descriptionInput.value = collectionData.description || '';
                if (collectionData.imageUrl && collectionImagePreview) {
                    collectionImagePreview.src = collectionData.imageUrl;
                    collectionImagePreview.classList.remove('hidden');
                    if (imagePlaceholder) imagePlaceholder.classList.add('hidden');
                } else {
                    if (collectionImagePreview) collectionImagePreview.classList.add('hidden');
                    if (imagePlaceholder) imagePlaceholder.classList.remove('hidden');
                }

                if (tagsInput) tagsInput.value = collectionData.tags ? collectionData.tags.join(', ') : '';

                // Pre-select products
                if (productsSelect && collectionData.products) {
                    const selectedProducts = collectionData.products.map(p => p._id ? p._id.toString() : p.toString());
                    Array.from(productsSelect.options).forEach(option => {
                        option.selected = selectedProducts.includes(option.value);
                    });
                }
                
                // Pre-select suggestedOnProducts
                if (suggestedOnProductsSelect && collectionData.suggestedOnProducts) {
                    const selectedSuggestedProducts = collectionData.suggestedOnProducts.map(p => p._id ? p._id.toString() : p.toString());
                    Array.from(suggestedOnProductsSelect.options).forEach(option => {
                        option.selected = selectedSuggestedProducts.includes(option.value);
                    });
                }

                // Pre-select suggestedOnCategories
                if (suggestedOnCategoriesSelect && collectionData.suggestedOnCategories) {
                    const selectedSuggestedCategories = collectionData.suggestedOnCategories.map(c => c._id ? c._id.toString() : c.toString());
                    Array.from(suggestedOnCategoriesSelect.options).forEach(option => {
                        option.selected = selectedSuggestedCategories.includes(option.value);
                    });
                }
            }

        } catch (error) {
            console.error('Error populating form selects or fetching collection for edit:', error);
            window.showToast(`Error loading form data: ${error.message}`, 'danger');
        }
    }

    // **✅ NEW: Image preview logic (moved from inline script in EJS)**
    function setupImagePreview() {
        if (imageUrlInput) {
            imageUrlInput.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (collectionImagePreview) {
                            collectionImagePreview.src = e.target.result;
                            collectionImagePreview.classList.remove('hidden');
                        }
                        if (imagePlaceholder) imagePlaceholder.classList.add('hidden');
                    };
                    reader.readAsDataURL(file);
                } else {
                    // If no file is selected and there's no initial image URL, hide preview and show placeholder
                    if (collectionImagePreview && (!collectionImagePreview.src || collectionImagePreview.src.includes('placeholder'))) {
                        collectionImagePreview.classList.add('hidden');
                        if (imagePlaceholder) imagePlaceholder.classList.remove('hidden');
                    }
                }
            });
        }
    }


    // Handle form submission (Add/Edit Collection)
    async function handleCollectionFormSubmit(event) {
        event.preventDefault();

        const collectionId = collectionIdInput ? collectionIdInput.value : '';
        const isEditMode = !!collectionId;

        const formData = new FormData();
        formData.append('name', nameInput.value);
        formData.append('description', descriptionInput.value);
        formData.append('tags', tagsInput.value);

        // Append selected products
        const selectedProducts = Array.from(productsSelect.selectedOptions).map(option => option.value);
        selectedProducts.forEach(id => formData.append('products[]', id)); // Use [] for array

        // Append selected suggestedOnProducts
        const selectedSuggestedOnProducts = Array.from(suggestedOnProductsSelect.selectedOptions).map(option => option.value);
        selectedSuggestedOnProducts.forEach(id => formData.append('suggestedOnProducts[]', id));

        // Append selected suggestedOnCategories
        const selectedSuggestedOnCategories = Array.from(suggestedOnCategoriesSelect.selectedOptions).map(option => option.value);
        selectedSuggestedOnCategories.forEach(id => formData.append('suggestedOnCategories[]', id));
        
        // Append image if new one is selected
        if (imageUrlInput && imageUrlInput.files && imageUrlInput.files.length > 0) {
            formData.append('imageUrl', imageUrlInput.files[0]);
        }

        try {
            const url = isEditMode 
                ? `http://localhost:3000/api/product-collections/${collectionId}`
                : 'http://localhost:3000/api/product-collections';
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await window.fetchWithAuth(url, {
                method: method,
                headers: {
                    'Authorization': window.getAuthHeaders().Authorization, // Only Authorization header, FormData sets Content-Type
                },
                body: formData // FormData sets Content-Type automatically to multipart/form-data
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Failed to ${isEditMode ? 'update' : 'add'} collection.`);
            }

            window.showToast(data.message || `Collection ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
            // Redirect after successful operation
            setTimeout(() => {
                window.location.href = '/admin/collections';
            }, 500);

        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'add'} collection:`, error);
            window.showToast(`Failed to ${isEditMode ? 'update' : 'add'} collection: ${error.message}`, 'danger');
        }
    }


    // Initialize based on page
    // Removed the redundant self-initialization. admin-core.js will now call window.fetchAndDisplayAdminCollections.
    // if (window.location.pathname === '/admin/collections') {
    //     // No direct call here anymore. admin-core.js will handle it.
    // }

    if (collectionForm) {
        await populateFormSelects(); // ✅ MODIFIED: انتظر حتى يتم تحميل وملء البيانات
        setupImagePreview(); // هذه الدالة تقوم بتهيئة الـ preview

        // ✅ NEW: تهيئة Select2 لعناصر اختيار المنتجات والتصنيفات
        if (productsSelect) {
            $(productsSelect).select2({
                placeholder: "Select products for this collection", // نص توضيحي
                allowClear: true, // للسماح بإلغاء تحديد الاختيارات
                width: '100%' // لضبط العرض
            });
        }

        if (suggestedOnProductsSelect) {
            $(suggestedOnProductsSelect).select2({
                placeholder: "Select suggested products to suggest this collection on",
                allowClear: true,
                width: '100%'
            });
        }

        if (suggestedOnCategoriesSelect) {
            $(suggestedOnCategoriesSelect).select2({
                placeholder: "Select suggested categories to suggest this collection on",
                allowClear: true,
                width: '100%'
            });
        }

        collectionForm.addEventListener('submit', handleCollectionFormSubmit);
    }
});