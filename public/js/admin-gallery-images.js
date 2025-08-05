// public/js/admin-gallery-images.js

document.addEventListener('DOMContentLoaded', () => {
    const galleryImagesContainer = document.getElementById('galleryImagesContainer');
    const addNewImageBtn = document.getElementById('addNewImageBtn');
    const galleryImageModal = new bootstrap.Modal(document.getElementById('galleryImageModal'));
    const galleryImageModalLabel = document.getElementById('galleryImageModalLabel');
    const galleryImageForm = document.getElementById('galleryImageForm');
    const imageIdInput = document.getElementById('imageId');
    const imageDescriptionInput = document.getElementById('imageDescription');
    const imageOrderInput = document.getElementById('imageOrder');
    const galleryImageUploadInput = document.getElementById('galleryImageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imageIsActiveInput = document.getElementById('imageIsActive');
    const saveImageBtn = document.getElementById('saveImageBtn');

    // Base URL for API calls
    const API_BASE_URL = 'http://localhost:3000/api/admin/gallery-images';

    // Function to update image preview visibility
    const updateImagePreview = (imageUrl) => {
        if (imagePreview && imagePlaceholder) {
            if (imageUrl && imageUrl !== '#' && imageUrl !== 'undefined') { // Added 'undefined' check
                imagePreview.src = imageUrl;
                imagePreview.style.display = 'block';
                imagePlaceholder.style.display = 'none';
            } else {
                imagePreview.src = '#';
                imagePreview.style.display = 'none';
                imagePlaceholder.style.display = 'block';
            }
        }
    };

    // Function to fetch and display gallery images
    async function fetchGalleryImages() {
        if (!galleryImagesContainer) return;
        galleryImagesContainer.innerHTML = '<div class="col-12 text-center text-muted">Loading gallery images...</div>';
        try {
            const response = await window.fetchWithAuth(API_BASE_URL); // Using fetchWithAuth
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch gallery images.');
            }

            displayGalleryImages(data);
        } catch (error) {
            console.error('Error fetching gallery images:', error);
            galleryImagesContainer.innerHTML = `<div class="col-12 text-center text-danger">Failed to load gallery images: ${error.message}</div>`;
            window.showToast(`Failed to load gallery images: ${error.message}`, 'danger');
        }
    }

    // Function to display gallery images in the container
    function displayGalleryImages(images) {
        galleryImagesContainer.innerHTML = '';
        if (!Array.isArray(images) || images.length === 0) {
            galleryImagesContainer.innerHTML = '<div class="col-12 text-center text-muted">No gallery images found. Add a new one!</div>';
            return;
        }

        images.forEach(image => {
            const imageCardHtml = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card gallery-image-card h-100">
                        <img src="${image.imageUrl || 'https://placehold.co/600x150/e0f2f2/004d4d?text=Gallery+Image'}" class="card-img-top" alt="${image.description || 'Gallery Image'}">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${image.description || 'No Description'}</h5>
                            <p class="card-text"><strong>Order:</strong> <span class="image-order">${image.order}</span></p>
                            <p class="card-text"><strong>Status:</strong> <span class="image-status ${image.isActive ? 'active' : 'inactive'}">${image.isActive ? 'Active' : 'Inactive'}</span></p>
                            <div class="mt-auto d-flex justify-content-end">
                                <button class="btn btn-sm btn-info me-2 edit-image-btn" data-id="${image._id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger delete-image-btn" data-id="${image._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            galleryImagesContainer.insertAdjacentHTML('beforeend', imageCardHtml);
        });

        attachEventListeners(); // Attach listeners to newly created buttons
    }

    // Function to attach event listeners to dynamically created buttons
    function attachEventListeners() {
        document.querySelectorAll('.edit-image-btn').forEach(button => {
            button.removeEventListener('click', handleEditImage); // Prevent duplicate listeners
            button.addEventListener('click', handleEditImage);
        });
        document.querySelectorAll('.delete-image-btn').forEach(button => {
            button.removeEventListener('click', handleDeleteImage); // Prevent duplicate listeners
            button.addEventListener('click', handleDeleteImage);
        });
    }

    // Handle Add New Image button click
    if (addNewImageBtn) {
        addNewImageBtn.addEventListener('click', () => {
            galleryImageModalLabel.textContent = 'Add New Gallery Image';
            galleryImageForm.reset(); // Clear form fields
            imageIdInput.value = ''; // Clear hidden ID
            updateImagePreview(''); // Clear image preview
            imageIsActiveInput.checked = true; // Default to active
            galleryImageModal.show();
        });
    }

    // Handle image input change for live preview
    if (galleryImageUploadInput) {
        galleryImageUploadInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    updateImagePreview(e.target.result); // Update with new file
                };
                reader.readAsDataURL(file);
            } else {
                updateImagePreview(''); // Clear preview if no file selected
            }
        });
    }

    // Handle form submission (Add/Edit Image)
    if (galleryImageForm) {
        galleryImageForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const imageId = imageIdInput.value;
            const isEditMode = !!imageId; // True if imageId exists
            const method = isEditMode ? 'PUT' : 'POST';
            const url = isEditMode ? `${API_BASE_URL}/${imageId}` : API_BASE_URL;

            const formData = new FormData();
            formData.append('description', imageDescriptionInput.value);
            formData.append('order', imageOrderInput.value);
            formData.append('isActive', imageIsActiveInput.checked ? 'true' : 'false');

            if (galleryImageUploadInput.files && galleryImageUploadInput.files.length > 0) {
                formData.append('galleryImage', galleryImageUploadInput.files[0]); // Field name for Multer
            } else if (!isEditMode) { // Image is required for new images
                window.showToast('Gallery image is required for new entries.', 'danger');
                return;
            }

            saveImageBtn.disabled = true;
            saveImageBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

            try {
                const response = await window.fetchWithAuth(url, {
                    method: method,
                    headers: {
                        'Authorization': window.getAuthHeaders().Authorization
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    galleryImageModal.hide(); // Close modal
                    fetchGalleryImages(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to save image.');
                }
            } catch (error) {
                console.error('Error saving gallery image:', error);
                window.showToast(`Error: ${error.message}`, 'danger');
            } finally {
                saveImageBtn.disabled = false;
                saveImageBtn.innerHTML = 'Save Image';
            }
        });
    }

    // Handle Edit Image button click
    async function handleEditImage(event) {
        const imageId = event.currentTarget.dataset.id;
        galleryImageModalLabel.textContent = 'Edit Gallery Image';
        galleryImageForm.reset(); // Clear form fields
        imageIdInput.value = imageId; // Set hidden ID

        updateImagePreview(''); // Clear preview before loading new one

        try {
            const response = await window.fetchWithAuth(`${API_BASE_URL}/${imageId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch image details for editing.');
            }

            // Populate form fields
            imageDescriptionInput.value = data.description;
            imageOrderInput.value = data.order;
            imageIsActiveInput.checked = data.isActive;

            // Update image preview with existing image URL
            updateImagePreview(data.imageUrl);

            galleryImageModal.show();
        } catch (error) {
            console.error('Error loading gallery image for edit:', error);
            window.showToast(`Error loading image: ${error.message}`, 'danger');
        }
    }

    // Handle Delete Image button click
    async function handleDeleteImage(event) {
        const imageId = event.currentTarget.dataset.id;
        window.showConfirmationModal('Are you sure you want to delete this gallery image?', async () => {
            try {
                const response = await window.fetchWithAuth(`${API_BASE_URL}/${imageId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    fetchGalleryImages(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to delete image.');
                }
            } catch (error) {
                console.error('Error deleting gallery image:', error);
                window.showToast(`Error deleting image: ${error.message}`, 'danger');
            }
        });
    }

    // Initial fetch of images when page loads
    fetchGalleryImages();
});
