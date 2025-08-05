// Negroo Store/public/js/admin-product-form.js - Specific logic for the Product Add/Edit Form page

document.addEventListener('DOMContentLoaded', async () => {
    const productForm = document.getElementById('productForm');
    const productNameInput = document.getElementById('name');
    const productDescriptionInput = document.getElementById('description');
    const productPriceInput = document.getElementById('price');
    const mainImageUploadInput = document.getElementById('mainImageUpload');
    const additionalImagesUploadInput = document.getElementById('additionalImagesUpload');
    const productCategorySelect = document.getElementById('category');
    const productStockInput = document.getElementById('stock');
    const specificationsInput = document.getElementById('specifications');
    const shippingAndReturnsInput = document.getElementById('shippingAndReturns');
    const minStockThresholdInput = document.getElementById('minStockThreshold');

    const mainImagePreview = document.getElementById('mainImagePreview');
    const mainVideoPreview = document.getElementById('mainVideoPreview');
    const mainMediaPlaceholder = document.getElementById('mainMediaPlaceholder');
    const additionalPreviewsContainer = document.getElementById('additionalPreviewsContainer');
    const additionalMediaPlaceholder = document.getElementById('additionalMediaPlaceholder');

    // هذه المتغيرات كانت موجودة في الكود الأصلي ولكن يجب أن تكون في admin-categories.js لكي لا يحدث تضارب
    // تم الإبقاء عليها هنا لتسهيل عملية النسخ واللصق الكاملة إذا كانت موجودة لديك.
    const categoryForm = document.getElementById('categoryForm');
    const categoryNameInput = document.getElementById('name');
    const categoryDescriptionInput = document.getElementById('description');
    const categoryImageUploadInput = document.getElementById('categoryImage');
    const categoryImagePreview = document.getElementById('categoryImagePreview');
    const categoryMediaPlaceholder = document.getElementById('categoryMediaPlaceholder');

    // ✅ NEW: Variant-related elements
    const addVariantGroupBtn = document.getElementById('addVariantGroupBtn');
    const variantGroupsContainer = document.getElementById('variantGroupsContainer');

    // ✅ NEW: Flash Sale related elements
    const isOnFlashSaleCheckbox = document.getElementById('isOnFlashSale');
    const flashSalePriceInput = document.getElementById('flashSalePrice');
    const flashSaleEndDateInput = document.getElementById('flashSaleEndDate');
    const flashSaleFieldsContainer = document.getElementById('flashSaleFieldsContainer');


    if (!document.querySelector('.toast-container')) {
        const body = document.querySelector('body');
        if (body) {
            const toastDiv = document.createElement('div');
            toastDiv.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            body.appendChild(toastDiv);
            console.log('Toast container added dynamically for productForm.');
        }
    }

    const formTitle = document.querySelector('.admin-container h2.section-heading');


    let isEditMode = false;
    let productId = null;
    let categoryId = null;


    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/admin/products/edit/')) {
        isEditMode = true;
        const pathSegments = currentPath.split('/');
        productId = pathSegments[pathSegments.length - 1];
        if (formTitle) {
            formTitle.textContent = `Edit Product: ${productId}`;
        }
    } else if (currentPath === '/admin/products/new') {
        if (formTitle) {
            formTitle.textContent = 'Add New Product';
        }
    }
    // هذه الكتل خاصة بنماذج الفئات ويجب أن يتم التعامل معها عادة بواسطة admin-categories.js
    else if (currentPath.startsWith('/admin/categories/edit/')) {
        isEditMode = true;
        const pathSegments = currentPath.split('/');
        categoryId = pathSegments[pathSegments.length - 1];
        if (formTitle) {
            formTitle.textContent = `Edit Category: ${categoryId}`;
        }
    } else if (currentPath === '/admin/categories/new') {
        if (formTitle) {
            formTitle.textContent = 'Add New Category';
        }
    }


    // ✅ MODIFIED: Changed parameter to selectedCategoryId and used category._id for value/selection
    async function fetchCategoriesForDropdown(selectedCategoryId = '') {
        try {
            const response = await fetch('http://localhost:3000/api/categories', {
                headers: window.getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch categories.');
            }
            const categories = await response.json();
            if (productCategorySelect) {
                productCategorySelect.innerHTML = '<option value="">Select Category</option>';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category._id; // ✅ Use category ID as option value
                    option.textContent = category.name;
                    if (category._id === selectedCategoryId) { // ✅ Compare with category ID
                        option.selected = true;
                    }
                    productCategorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching categories for dropdown:', error);
            window.showToast(`Failed to load categories: ${error.message}`, 'danger');
            if (productCategorySelect) {
                 productCategorySelect.innerHTML = '<option value="">Error loading categories</option>';
                 productCategorySelect.disabled = true;
            }
        }
    }


    const displayMediaPreview = (file, previewElement, isVideo = false) => {
        if (previewElement && previewElement.classList) {
            if (previewElement === mainImagePreview || previewElement === mainVideoPreview) {
                if (mainImagePreview) mainImagePreview.classList.add('hidden');
                if (mainVideoPreview) mainVideoPreview.classList.add('hidden');
                if (mainMediaPlaceholder) mainMediaPlaceholder.classList.add('hidden');
            }

            if (isVideo) {
                previewElement.src = URL.createObjectURL(file);
                previewElement.classList.remove('hidden');
                if (previewElement.tagName === 'VIDEO') previewElement.load();
            } else {
                previewElement.src = URL.createObjectURL(file);
                previewElement.classList.remove('hidden');
            }
        }
    };

    if (mainImageUploadInput) {
        mainImageUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (mainMediaPlaceholder) mainMediaPlaceholder.classList.add('hidden');
                if (mainImagePreview) mainImagePreview.classList.add('hidden');
                if (mainVideoPreview) mainVideoPreview.classList.add('hidden');

                const fileType = file.type;
                if (fileType.startsWith('image/')) {
                    displayMediaPreview(file, mainImagePreview, false);
                } else if (fileType.startsWith('video/')) {
                    displayMediaPreview(file, mainVideoPreview, true);
                } else {
                    if (mainMediaPlaceholder) mainMediaPlaceholder.classList.remove('hidden');
                    if (mainImagePreview) mainImagePreview.classList.add('hidden');
                    if (mainVideoPreview) mainVideoPreview.classList.add('hidden');
                    window.showToast('Unsupported file type for main media. Please select an image or video.', 'warning');
                }
            } else {
                if (mainMediaPlaceholder) mainMediaPlaceholder.classList.remove('hidden');
                if (mainImagePreview) mainImagePreview.classList.add('hidden');
                if (mainVideoPreview) mainVideoPreview.classList.add('hidden');
            }
        });
    }

    if (additionalImagesUploadInput) {
        additionalImagesUploadInput.addEventListener('change', (event) => {
            if (additionalPreviewsContainer) additionalPreviewsContainer.innerHTML = '';
            if (additionalMediaPlaceholder) additionalMediaPlaceholder.classList.remove('hidden');

            const files = event.target.files;
            if (files.length > 0) {
                if (additionalMediaPlaceholder) additionalMediaPlaceholder.classList.add('hidden');
                for (let i = 0; i < additionalImagesUploadInput.files.length; i++) {
                    const fileType = files[i].type;
                    let mediaElement;
                    if (fileType.startsWith('image/')) {
                        mediaElement = document.createElement('img');
                        mediaElement.classList.add('image-preview');
                        mediaElement.src = URL.createObjectURL(files[i]);
                        mediaElement.alt = 'Additional Image Preview';
                    } else if (fileType.startsWith('video/')) {
                        mediaElement = document.createElement('video');
                        mediaElement.classList.add('image-preview');
                        mediaElement.src = URL.createObjectURL(files[i]);
                        mediaElement.controls = true;
                        mediaElement.muted = true;
                        mediaElement.loop = true;
                        mediaElement.alt = 'Additional Video';
                    } else {
                        console.warn('Unsupported file type for additional media URL:', fileType);
                        return;
                    }
                    if (additionalPreviewsContainer) additionalPreviewsContainer.appendChild(mediaElement);
                }
            } else {
                if (additionalMediaPlaceholder) additionalMediaPlaceholder.classList.remove('hidden');
            }
        });
    }

    // ✅ NEW: Helper for variant image preview
    const displayVariantImagePreview = (file, previewElement) => {
        if (file) {
            previewElement.src = URL.createObjectURL(file);
            previewElement.classList.remove('hidden');
        } else {
            previewElement.src = '#'; // Clear src
            previewElement.classList.add('hidden');
        }
    };

    // ✅ NEW: Dynamic Variant Group and Option Management
    let variantGroupCounter = 0;
    let variantOptionCounters = {}; // Stores counts per group: {groupIndex: count}

    // Function to generate a new variant option HTML block
    function createVariantOptionHtml(groupIndex, optionIndex, optionData = {}) {
        const value = optionData.value || '';
        const priceAdjustment = optionData.priceAdjustment !== undefined ? optionData.priceAdjustment : 0;
        const stock = optionData.stock !== undefined ? optionData.stock : 0;
        const imageUrl = optionData.imageUrl || '';

        return `
            <div class="variant-option" data-group-index="${groupIndex}" data-option-index="${optionIndex}">
                <button type="button" class="remove-btn remove-option-btn" title="Remove Option"><i class="fas fa-times"></i></button>
                <div class="form-group flex-grow-1">
                    <label for="variantOptionValue_${groupIndex}_${optionIndex}">Option Value</label>
                    <input type="text" class="form-control form-control-sm variant-option-value" id="variantOptionValue_${groupIndex}_${optionIndex}" value="${value}" required>
                </div>
                <div class="form-group">
                    <label for="variantOptionPrice_${groupIndex}_${optionIndex}">Price Adj.</label>
                    <input type="number" class="form-control form-control-sm variant-option-price-adj" id="variantOptionPrice_${groupIndex}_${optionIndex}" value="${priceAdjustment}" step="0.01">
                </div>
                <div class="form-group">
                    <label for="variantOptionStock_${groupIndex}_${optionIndex}">Stock</label>
                    <input type="number" class="form-control form-control-sm variant-option-stock" id="variantOptionStock_${groupIndex}_${optionIndex}" value="${stock}" min="0" required>
                </div>
                <div class="form-group image-upload-group">
                    <label for="variantOptionImage_${groupIndex}_${optionIndex}">Image</label>
                    <input type="file" class="form-control form-control-sm variant-image-upload" id="variantOptionImage_${groupIndex}_${optionIndex}" accept="image/*">
                    <img class="variant-option-image-preview mt-2 ${imageUrl ? '' : 'hidden'}" src="${imageUrl || '#'}" alt="Variant Image Preview">
                    <input type="hidden" class="variant-option-existing-image-url" value="${imageUrl}">
                </div>
            </div>
        `;
    }

    // Function to add a new variant option to a specific group
    function addVariantOption(groupIndex, optionData = {}) {
        const variantOptionsContainer = document.getElementById(`variantOptionsContainer_${groupIndex}`);
        if (!variantOptionsContainer) return;

        if (!variantOptionCounters[groupIndex]) {
            variantOptionCounters[groupIndex] = 0;
        }
        const optionIndex = variantOptionCounters[groupIndex]++;
        
        const optionHtml = createVariantOptionHtml(groupIndex, optionIndex, optionData);
        variantOptionsContainer.insertAdjacentHTML('beforeend', optionHtml);

        // Attach event listener for the new image input
        const newImageInput = variantOptionsContainer.querySelector(`#variantOptionImage_${groupIndex}_${optionIndex}`);
        if (newImageInput) {
            newImageInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                const previewElement = event.target.nextElementSibling; // The img tag
                if (file) {
                    if (file.type.startsWith('image/')) {
                        displayVariantImagePreview(file, previewElement);
                    } else {
                        displayVariantImagePreview(null, previewElement);
                        window.showToast('Unsupported file type for variant image. Please select an image.', 'warning');
                    }
                } else {
                    displayVariantImagePreview(null, previewElement);
                }
            });
        }
    }

    // Function to add a new variant group HTML block
    function addVariantGroup(groupData = {}) {
        const groupIndex = variantGroupCounter++;
        variantOptionCounters[groupIndex] = 0; // Initialize option counter for this new group

        const groupHtml = `
            <div class="variant-group" data-group-index="${groupIndex}">
                <button type="button" class="remove-group-btn" title="Remove Variant Group"><i class="fas fa-times-circle"></i></button>
                <div class="mb-3">
                    <label for="variantGroupName_${groupIndex}" class="form-label">Variant Group Name (e.g., Color, Size)</label>
                    <input type="text" class="form-control variant-group-name" id="variantGroupName_${groupIndex}" value="${groupData.name || ''}" required>
                </div>
                <h5 class="mt-4 mb-3">Options for <span class="group-name-display">${groupData.name || 'this group'}</span>:</h5>
                <div class="variant-options-container" id="variantOptionsContainer_${groupIndex}">
                    </div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-3 add-variant-option-btn" data-group-index="${groupIndex}">
                    <i class="fas fa-plus-circle me-1"></i>Add Option
                </button>
            </div>
        `;
        variantGroupsContainer.insertAdjacentHTML('beforeend', groupHtml);

        // Populate options if groupData has them (edit mode)
        if (groupData.options && Array.isArray(groupData.options)) {
            groupData.options.forEach(option => {
                addVariantOption(groupIndex, option);
            });
        }

        // Add event listener for "Add Option" button of the new group
        const newAddOptionBtn = variantGroupsContainer.querySelector(`.variant-group[data-group-index="${groupIndex}"] .add-variant-option-btn`);
        if (newAddOptionBtn) {
            newAddOptionBtn.addEventListener('click', (event) => {
                const targetGroupIndex = parseInt(event.currentTarget.dataset.groupIndex);
                addVariantOption(targetGroupIndex);
            });
        }

        // Add event listener for group name input change
        const newGroupNameInput = variantGroupsContainer.querySelector(`#variantGroupName_${groupIndex}`);
        if (newGroupNameInput) {
            newGroupNameInput.addEventListener('input', (event) => {
                const displaySpan = event.target.closest('.variant-group').querySelector('.group-name-display');
                if (displaySpan) {
                    displaySpan.textContent = event.target.value || 'this group';
                }
            });
        }
    }

    // Attach listener to the main "Add Variant Group" button
    if (addVariantGroupBtn) {
        addVariantGroupBtn.addEventListener('click', () => addVariantGroup());
    }

    // Delegate click events for dynamically added remove buttons
    if (variantGroupsContainer) {
        variantGroupsContainer.addEventListener('click', (event) => {
            // Remove Variant Option
            if (event.target.closest('.remove-option-btn')) {
                event.target.closest('.variant-option').remove();
            }
            // Remove Variant Group
            if (event.target.closest('.remove-group-btn')) {
                event.target.closest('.variant-group').remove();
            }
        });
    }

    // ✅ NEW: Toggle Flash Sale fields visibility
    if (isOnFlashSaleCheckbox && flashSaleFieldsContainer) {
        const toggleFlashSaleFields = () => {
            if (isOnFlashSaleCheckbox.checked) {
                flashSaleFieldsContainer.classList.remove('hidden');
            } else {
                flashSaleFieldsContainer.classList.add('hidden');
                // Clear values when hiding
                if (flashSalePriceInput) flashSalePriceInput.value = '';
                if (flashSaleEndDateInput) flashSaleEndDateInput.value = '';
            }
        };
        isOnFlashSaleCheckbox.addEventListener('change', toggleFlashSaleFields);
        // Initial call to set correct state on page load
        toggleFlashSaleFields();
    }


// ----------------------------------------------------
// منطق تحميل بيانات المنتج للتعديل (Product Edit Logic)
// ----------------------------------------------------
if (currentPath.startsWith('/admin/products/edit/') && productId) {
    async function loadProductForEdit() {
        try {
            const response = await fetch(`http://localhost:3000/api/admin/products/${productId}`, {
                headers: window.getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch product for editing.');
            }
            const product = await response.json();

            if (productNameInput) productNameInput.value = product.name;
            if (productDescriptionInput) productDescriptionInput.value = product.description;
            if (productPriceInput) productPriceInput.value = product.price;
            if (productStockInput) productStockInput.value = product.stock;
            if (minStockThresholdInput) minStockThresholdInput.value = product.minStockThreshold !== undefined ? product.minStockThreshold : 10;
            if (specificationsInput) specificationsInput.value = product.specifications || '';
            if (shippingAndReturnsInput) shippingAndReturnsInput.value = product.shippingAndReturns || '';

            if (formTitle) {
                formTitle.textContent = `Edit Product: ${product.name}`;
            }

            // ✅ MODIFIED: Pass product.category._id for selection
            if (product.category && product.category._id) { // Ensure category and its ID exist
                await fetchCategoriesForDropdown(product.category._id);
            } else {
                await fetchCategoriesForDropdown(); // Load without pre-selection if category is missing or not populated
            }

            if (product.imageUrl) {
                if (mainMediaPlaceholder) mainMediaPlaceholder.classList.add('hidden');
                if (product.imageUrl.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg)$/i)) {
                    if (product.imageUrl.match(/\.(mp4|webm|ogg)$/i)) {
                        if (mainVideoPreview) {
                            mainVideoPreview.src = product.imageUrl;
                            mainVideoPreview.classList.remove('hidden');
                            mainVideoPreview.load();
                        }
                    } else {
                        if (mainImagePreview) {
                            mainImagePreview.src = product.imageUrl;
                            mainImagePreview.classList.remove('hidden');
                        }
                    }
                } else {
                    if (mainMediaPlaceholder) {
                        mainMediaPlaceholder.classList.remove('hidden');
                        mainMediaPlaceholder.textContent = 'Current main media URL (unsupported format for preview): ' + product.imageUrl;
                    }
                }
            } else {
                if (mainMediaPlaceholder) mainMediaPlaceholder.classList.remove('hidden');
            }

            if (product.imageUrls && product.imageUrls.length > 0) {
                if (additionalPreviewsContainer) additionalPreviewsContainer.innerHTML = '';
                if (additionalMediaPlaceholder) additionalMediaPlaceholder.classList.add('hidden');
                product.imageUrls.forEach(url => {
                    let mediaElement;
                    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                        mediaElement = document.createElement('img');
                        mediaElement.classList.add('image-preview');
                        mediaElement.src = url;
                        mediaElement.alt = 'Additional Image';
                    } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
                        mediaElement = document.createElement('video');
                        mediaElement.classList.add('image-preview');
                        mediaElement.src = url;
                        mediaElement.controls = true;
                        mediaElement.muted = true;
                        mediaElement.loop = true;
                        mediaElement.alt = 'Additional Video';
                    } else {
                        console.warn('Unsupported file type for additional media URL:', fileType);
                        return;
                    }
                    if (additionalPreviewsContainer) additionalPreviewsContainer.appendChild(mediaElement);
                });
            } else {
                if (additionalMediaPlaceholder) additionalMediaPlaceholder.classList.remove('hidden');
            }

            // ✅ NEW: Load existing variants for editing
            if (product.variants && product.variants.length > 0) {
                product.variants.forEach(group => {
                    addVariantGroup(group); // Render existing variant groups
                });
            }

            // ✅ NEW: Load Flash Sale fields
            if (isOnFlashSaleCheckbox) {
                isOnFlashSaleCheckbox.checked = product.isOnFlashSale || false;
            }
            if (flashSalePriceInput) {
                flashSalePriceInput.value = product.flashSalePrice !== null && product.flashSalePrice !== undefined ? product.flashSalePrice : '';
            }
            if (flashSaleEndDateInput) {
                // Format date for input type="datetime-local"
                if (product.flashSaleEndDate) {
                    const date = new Date(product.flashSaleEndDate);
                    // Ensure local timezone is used for formatting to avoid offset issues
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    flashSaleEndDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                } else {
                    flashSaleEndDateInput.value = '';
                }
            }
            // Trigger visibility toggle after setting values
            if (isOnFlashSaleCheckbox && flashSaleFieldsContainer) {
                flashSaleFieldsContainer.classList.toggle('hidden', !isOnFlashSaleCheckbox.checked);
            }


        } catch (error) {
            console.error('Error fetching product for edit form:', error);
            window.showToast(`Failed to load product for editing: ${error.message}`, 'danger');
            if (formTitle) {
                formTitle.textContent = 'Error Loading Product';
            }
        }
    }
    loadProductForEdit();
}
// ----------------------------------------------------
// منطق إضافة المنتج (Product Add Logic)
// ----------------------------------------------------
else if (currentPath === '/admin/products/new') {
    fetchCategoriesForDropdown(); // فقط لجلب الفئات لنموذج إضافة منتج جديد
     // Ensure flash sale fields are hidden by default for new products
    if (isOnFlashSaleCheckbox && flashSaleFieldsContainer) {
        isOnFlashSaleCheckbox.checked = false;
        flashSaleFieldsContainer.classList.add('hidden');
    }
}


// ----------------------------------------------------
// منطق تقديم نموذج المنتج (Product Form Submission)
// ----------------------------------------------------
if (productForm) { // تأكد من أننا في نموذج المنتج
    productForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('Admin-core: Product form submission started.');

        const formData = new FormData();
        let isValid = true; // Flag to track overall form validation status

        formData.append('name', productNameInput.value);
        formData.append('description', productDescriptionInput.value);
        formData.append('price', parseFloat(productPriceInput.value));
        formData.append('category', productCategorySelect.value);
        formData.append('stock', parseInt(productStockInput.value));
        formData.append('specifications', specificationsInput.value);
        formData.append('shippingAndReturns', shippingAndReturnsInput.value);
        formData.append('minStockThreshold', parseInt(minStockThresholdInput.value));


        if (mainImageUploadInput && mainImageUploadInput.files[0]) {
            formData.append('mainImage', mainImageUploadInput.files[0]);
            console.log('Admin-core: Main image file detected.');
        }
        if (additionalImagesUploadInput && additionalImagesUploadInput.files.length > 0) {
            for (let i = 0; i < additionalImagesUploadInput.files.length; i++) {
                formData.append('additionalImages', additionalImagesUploadInput.files[i]);
            }
            console.log(`Admin-core: ${additionalImagesUploadInput.files.length} additional images detected.`);
        }

        // ✅ NEW: Collect and append variants data
        const variants = [];
        // تصفية المجموعات الفارغة قبل البدء بمعالجتها
        const allVariantGroups = variantGroupsContainer.querySelectorAll('.variant-group');
        let filteredVariantGroups = [];

        allVariantGroups.forEach(groupDiv => {
            const groupNameInput = groupDiv.querySelector('.variant-group-name');
            // إذا كان اسم المجموعة موجوداً وغير فارغ، أو إذا كانت المجموعة تحتوي على خيارات
            if (groupNameInput && groupNameInput.value.trim() !== '') {
                filteredVariantGroups.push(groupDiv);
            } else {
                // إذا كانت المجموعة فارغة (لا اسم ولا خيارات)، فلا يتم تضمينها
                const optionsInGroup = groupDiv.querySelectorAll('.variant-option').length;
                if (optionsInGroup > 0) {
                     filteredVariantGroups.push(groupDiv); // اذا كان لها خيارات ولكن لا اسم, ستفشل لاحقا في ال validation
                }
                // إذا لم يكن لها اسم ولا خيارات، يتم تجاهلها ولا تسبب خطأ
            }
        });

        if (filteredVariantGroups.length === 0 && allVariantGroups.length > 0) {
            // هذا السيناريو يحدث إذا كان هناك جروب واحد فقط وفارغ تمامًا وتم تجاهله
            // يمكن إضافة رسالة تنبيه هنا إذا لزم الأمر، ولكن التحقق الأسفل سيغطيه
        }

        filteredVariantGroups.forEach((groupDiv, groupIndex) => {
            const groupNameInput = groupDiv.querySelector('.variant-group-name'); // Correctly selecting by class
            if (!groupNameInput || !groupNameInput.value.trim()) {
                window.showToast('Variant group name cannot be empty.', 'warning');
                isValid = false; // Mark as invalid
                return; // Stop processing this variant group and move to the next in the loop
            }

            const options = [];
            groupDiv.querySelectorAll('.variant-option').forEach((optionDiv, optionIndex) => {
                const optionValueInput = optionDiv.querySelector('.variant-option-value');
                const optionPriceAdjInput = optionDiv.querySelector('.variant-option-price-adj');
                const optionStockInput = optionDiv.querySelector('.variant-option-stock');
                const optionImageInput = optionDiv.querySelector('.variant-image-upload');
                const optionExistingImageUrlInput = optionDiv.querySelector('.variant-option-existing-image-url');

                if (!optionValueInput || !optionValueInput.value.trim()) {
                    window.showToast('Variant option value cannot be empty.', 'warning');
                    isValid = false; // Mark as invalid
                    return; // Stop processing this option and move to the next in the loop
                }
                if (isNaN(parseInt(optionStockInput.value)) || parseInt(optionStockInput.value) < 0) {
                    window.showToast('Variant option stock must be a non-negative integer.', 'warning');
                    isValid = false; // Mark as invalid
                    return; // Stop processing this option and move to the next in the loop
                }

                // Append variant image file to FormData
                if (optionImageInput && optionImageInput.files[0]) {
                    formData.append(`variantImage_${groupIndex}_${optionIndex}`, optionImageInput.files[0]);
                }

                options.push({
                    value: optionValueInput.value.trim(),
                    priceAdjustment: parseFloat(optionPriceAdjInput.value) || 0,
                    stock: parseInt(optionStockInput.value),
                    // If new image uploaded, its URL will be set by backend.
                    // If no new image, use existing URL from hidden input.
                    imageUrl: optionImageInput.files[0] ? '' : optionExistingImageUrlInput.value
                });
            });

            if (!isValid) return; // If an option failed validation, stop processing this group

            if (options.length === 0) {
                window.showToast('Each variant group must have at least one option.', 'warning');
                isValid = false; // Mark as invalid
                return; // Stop processing this group and move to the next in the loop
            }
            
            variants.push({
                name: groupNameInput.value.trim(),
                options: options
            });
        });

        // If any variant validation failed, stop the entire form submission
        if (!isValid) {
            console.log('Admin-core: Variant validation failed. Stopping submission.');
            return; // Stop the form submission
        }

        // Append the whole variants array as a JSON string
        formData.append('variantsData', JSON.stringify(variants));

        // ✅ NEW: Collect and append Flash Sale data
        const isOnFlashSale = isOnFlashSaleCheckbox ? isOnFlashSaleCheckbox.checked : false;
        formData.append('isOnFlashSale', isOnFlashSale);

        if (isOnFlashSale) {
            const flashSalePrice = flashSalePriceInput ? parseFloat(flashSalePriceInput.value) : null;
            const flashSaleEndDate = flashSaleEndDateInput ? flashSaleEndDateInput.value : null;

            if (flashSalePrice === null || isNaN(flashSalePrice) || flashSalePrice < 0) {
                window.showToast('Flash sale price must be a non-negative number when flash sale is active.', 'warning');
                return; isValid = false;
            }
            // Validate flash sale price vs original price
            const originalPrice = parseFloat(productPriceInput.value);
            if (flashSalePrice >= originalPrice) {
                window.showToast('Flash sale price must be less than the original price.', 'warning');
                return; isValid = false;
            }

            if (!flashSaleEndDate) {
                window.showToast('Flash sale end date is required when flash sale is active.', 'warning');
                return; isValid = false;
            }
            const parsedFlashSaleEndDate = new Date(flashSaleEndDate);
            if (isNaN(parsedFlashSaleEndDate.getTime())) {
                window.showToast('Invalid flash sale end date format.', 'warning');
                return; isValid = false;
            }
            if (parsedFlashSaleEndDate < new Date()) {
                window.showToast('Flash sale end date must be in the future.', 'warning');
                return; isValid = false;
            }

            formData.append('flashSalePrice', flashSalePrice);
            formData.append('flashSaleEndDate', flashSaleEndDate);
        } else {
            // Ensure these fields are explicitly sent as empty/null if flash sale is off
            formData.append('flashSalePrice', '');
            formData.append('flashSaleEndDate', '');
        }

        if (!isValid) {
            console.log('Admin-core: Flash Sale validation failed. Stopping submission.');
            return;
        }


        // التحقق من المدخلات الأساسية
        if (isNaN(parseFloat(productPriceInput.value)) || parseFloat(productPriceInput.value) < 0) {
            window.showToast('Price must be a non-negative number.', 'warning');
            return;
        }
        if (isNaN(parseInt(productStockInput.value)) || parseInt(productStockInput.value) < 0) {
            window.showToast('Overall Stock must be a non-negative integer.', 'warning');
            return;
        }
        if (!productCategorySelect.value) {
            window.showToast('Please select a category.', 'warning');
            return;
        }
        if (minStockThresholdInput && (isNaN(parseInt(minStockThresholdInput.value)) || parseInt(minStockThresholdInput.value) < 0)) {
            window.showToast('Minimum stock threshold must be a non-negative integer.', 'warning');
            return;
        }


        console.log('Admin-core: Form data validated. Preparing fetch request.');

        try {
            let response;
            let url;
            let method;

            if (isEditMode) {
                url = `http://localhost:3000/api/admin/products/${productId}`;
                method = 'PUT';
                console.log(`Admin-core: Edit mode - URL: ${url}, Method: ${method}`);
            } else {
                url = 'http://localhost:3000/api/admin/products';
                method = 'POST';
                console.log(`Admin-core: Add mode - URL: ${url}, Method: ${method}`);
            }

            // Manually construct headers to avoid Content-Type: application/json for FormData
            const headers = {};
            if (window.currentAuthToken) { // Only add Authorization if token exists
                headers['Authorization'] = `Bearer ${window.currentAuthToken}`;
            }

            response = await fetch(url, {
                method: method,
                headers: headers, // Pass the manually constructed headers
                body: formData
            });

            console.log('Admin-core: Fetch request sent. Waiting for response...');

            const data = await response.json();
            console.log('Admin-core: Response received:', response.status, data);

            if (!response.ok) {
                throw new Error(data.message || 'Operation failed.');
            }

            window.showToast(isEditMode ? 'Product updated successfully!' : 'Product added successfully!', 'success');
            console.log('Admin-core: Operation successful. Redirecting...');
            setTimeout(() => {
                window.location.href = '/admin/products';
            }, 1500);

        } catch (error) {
            console.error('Admin-core: Product form submission error (caught in catch):', error);
            // Catching the throw new Error from variant validation
            if (error.message.includes('Variant')) {
                window.showToast(`Validation Error: ${error.message}`, 'danger');
            } else {
                window.showToast(`Operation failed: ${error.message}`, 'danger');
            }
        }
    });
}

// ----------------------------------------------------
// منطق نماذج الفئات (Category Forms - Add/Edit)
// ----------------------------------------------------
if (currentPath.startsWith('/admin/categories/new') || currentPath.startsWith('/admin/categories/edit/')) {
    const displayCategoryImagePreview = (file) => {
        if (categoryImagePreview && categoryMediaPlaceholder) {
            if (file) {
                categoryMediaPlaceholder.classList.add('hidden');
                categoryImagePreview.src = URL.createObjectURL(file);
                categoryImagePreview.classList.remove('hidden');
            } else {
                categoryMediaPlaceholder.classList.remove('hidden');
                categoryImagePreview.classList.add('hidden');
            }
        }
    };

    if (categoryImageUploadInput) {
        categoryImageUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    displayCategoryImagePreview(file);
                } else {
                    displayCategoryImagePreview(null);
                    window.showToast('Unsupported file type for category image. Please select an image.', 'warning');
                }
            } else {
                displayCategoryImagePreview(null);
            }
        });
    }

    // Load category data for edit mode
    if (currentPath.startsWith('/admin/categories/edit/') && categoryId) {
        async function loadCategoryForEdit() {
            try {
                const response = await fetch(`http://localhost:3000/api/admin/categories/${categoryId}`, {
                    headers: window.getAuthHeaders()
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch category for editing.');
                }
                const category = await response.json();

                if (categoryNameInput) categoryNameInput.value = category.name;
                if (categoryDescriptionInput) categoryDescriptionInput.value = category.description || '';
                if (formTitle) {
                    formTitle.textContent = `Edit Category: ${category.name}`;
                }

                if (category.imageUrl && category.imageUrl !== '[https://via.placeholder.com/300x180?text=Category+Image](https://via.placeholder.com/300x180?text=Category+Image)') {
                    if (categoryImagePreview && categoryMediaPlaceholder) {
                        categoryMediaPlaceholder.classList.add('hidden');
                        categoryImagePreview.src = category.imageUrl;
                        categoryImagePreview.classList.remove('hidden');
                    }
                } else {
                    if (categoryMediaPlaceholder) categoryMediaPlaceholder.classList.remove('hidden');
                    if (categoryImagePreview) categoryImagePreview.classList.add('hidden');
                }

            } catch (error) {
                console.error('Error fetching category for edit form:', error);
                window.showToast(`Failed to load category for editing: ${error.message}`, 'danger');
                if (formTitle) {
                    formTitle.textContent = 'Error Loading Category';
                }
            }
        }
        loadCategoryForEdit();
    }


    // Handle category form submission (Add/Edit)
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Admin-core: Category form submission started.');

            const formData = new FormData();
            if (categoryNameInput) formData.append('name', categoryNameInput.value);
            if (categoryDescriptionInput) formData.append('description', categoryDescriptionInput.value);

            if (categoryImageUploadInput && categoryImageUploadInput.files[0]) {
                formData.append('categoryImage', categoryImageUploadInput.files[0]);
                console.log('Admin-core: Category image file detected.');
            }

            if (categoryNameInput && !categoryNameInput.value.trim()) {
                window.showToast('Category name cannot be empty.', 'warning');
                return;
            }

            console.log('Admin-core: Category form data validated. Preparing fetch request.');

            try {
                let response;
                let url;
                let method;

                if (isEditMode) {
                    url = `http://localhost:3000/api/admin/categories/${categoryId}`;
                    method = 'PUT';
                    console.log(`Admin-core: Edit category mode - URL: ${url}, Method: ${method}`);
                } else {
                    url = 'http://localhost:3000/api/admin/categories';
                    method = 'POST';
                    console.log(`Admin-core: Add category mode - URL: ${url}, Method: ${method}`);
                }

                // Manually construct headers to avoid Content-Type: application/json for FormData
                const headers = {};
                if (window.currentAuthToken) { // Only add Authorization if token exists
                    headers['Authorization'] = `Bearer ${window.currentAuthToken}`;
                }

                response = await fetch(url, {
                    method: method,
                    headers: headers, // Pass the manually constructed headers
                    body: formData
                });

                console.log('Admin-core: Category fetch request sent. Waiting for response...');

                const data = await response.json();
                console.log('Admin-core: Category response received:', response.status, data);

                if (!response.ok) {
                    throw new Error(data.message || 'Category operation failed.');
                }

                window.showToast(isEditMode ? 'Category updated successfully!' : 'Category added successfully!', 'success');
                console.log('Admin-core: Category operation successful. Redirecting...');
                setTimeout(() => {
                    window.location.href = '/admin/categories';
                }, 1500);

            } catch (error) {
                console.error('Admin-core: Category form submission error (caught in catch):', error);
                window.showToast(`Category operation failed: ${error.message}`, 'danger');
            }
        });
    }
}
});