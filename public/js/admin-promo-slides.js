// public/js/admin-promo-slides.js

document.addEventListener('DOMContentLoaded', () => {
    const promoSlidesContainer = document.getElementById('promoSlidesContainer');
    const addNewSlideBtn = document.getElementById('addNewSlideBtn');
    const promoSlideModal = new bootstrap.Modal(document.getElementById('promoSlideModal'));
    const promoSlideModalLabel = document.getElementById('promoSlideModalLabel');
    const promoSlideForm = document.getElementById('promoSlideForm');
    const slideIdInput = document.getElementById('slideId');
    const slideTitleInput = document.getElementById('slideTitle');
    const slideDescriptionInput = document.getElementById('slideDescription');
    const slideButtonTextInput = document.getElementById('slideButtonText');
    const slideButtonLinkInput = document.getElementById('slideButtonLink');
    const slideOrderInput = document.getElementById('slideOrder');
    const slideImageInput = document.getElementById('slideImage');
    const imagePreview = document.getElementById('imagePreview');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const slideIsActiveInput = document.getElementById('slideIsActive');
    const saveSlideBtn = document.getElementById('saveSlideBtn');

    // Base URL for API calls
    const API_BASE_URL = 'http://localhost:3000/api/admin/promo-slides'; // Changed API URL

    // Function to fetch and display promo slides
    async function fetchPromoSlides() {
        if (!promoSlidesContainer) return;
        promoSlidesContainer.innerHTML = '<div class="col-12 text-center text-muted">Loading promo slides...</div>';
        try {
            const response = await fetch(API_BASE_URL, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch promo slides.');
            }

            displayPromoSlides(data);
        } catch (error) {
            console.error('Error fetching promo slides:', error);
            promoSlidesContainer.innerHTML = `<div class="col-12 text-center text-danger">Failed to load promo slides: ${error.message}</div>`;
            window.showToast(`Failed to load promo slides: ${error.message}`, 'danger');
        }
    }

    // Function to display promo slides in the container
    function displayPromoSlides(slides) {
        promoSlidesContainer.innerHTML = '';
        if (!Array.isArray(slides) || slides.length === 0) {
            promoSlidesContainer.innerHTML = '<div class="col-12 text-center text-muted">No promo slides found. Add a new one!</div>';
            return;
        }

        slides.forEach(slide => {
            const slideCardHtml = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card promo-slide-card h-100">
                        <img src="${slide.imageUrl || 'https://placehold.co/600x150/008080/ffffff?text=Promo+Slide'}" class="card-img-top" alt="${slide.title}">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${slide.title}</h5>
                            <p class="card-text">${slide.description}</p>
                            <p class="card-text"><strong>Button:</strong> ${slide.buttonText} (<a href="${slide.buttonLink}" target="_blank">${slide.buttonLink}</a>)</p>
                            <p class="card-text"><strong>Order:</strong> <span class="slide-order">${slide.order}</span></p>
                            <p class="card-text"><strong>Status:</strong> <span class="slide-status ${slide.isActive ? 'active' : 'inactive'}">${slide.isActive ? 'Active' : 'Inactive'}</span></p>
                            <div class="mt-auto d-flex justify-content-end">
                                <button class="btn btn-sm btn-info me-2 edit-slide-btn" data-id="${slide._id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger delete-slide-btn" data-id="${slide._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            promoSlidesContainer.insertAdjacentHTML('beforeend', slideCardHtml);
        });

        attachEventListeners(); // Attach listeners to newly created buttons
    }

    // Function to attach event listeners to dynamically created buttons
    function attachEventListeners() {
        document.querySelectorAll('.edit-slide-btn').forEach(button => {
            button.removeEventListener('click', handleEditSlide); // Prevent duplicate listeners
            button.addEventListener('click', handleEditSlide);
        });
        document.querySelectorAll('.delete-slide-btn').forEach(button => {
            button.removeEventListener('click', handleDeleteSlide); // Prevent duplicate listeners
            button.addEventListener('click', handleDeleteSlide);
        });
    }

    // Handle Add New Slide button click
    if (addNewSlideBtn) {
        addNewSlideBtn.addEventListener('click', () => {
            promoSlideModalLabel.textContent = 'Add New Promo Slide';
            promoSlideForm.reset(); // Clear form fields
            slideIdInput.value = ''; // Clear hidden ID
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'block';
            slideIsActiveInput.checked = true; // Default to active
            promoSlideModal.show();
        });
    }

    // Handle image preview
    if (slideImageInput) {
        slideImageInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    imagePlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.src = '#';
                imagePreview.style.display = 'none';
                imagePlaceholder.style.display = 'block';
            }
        });
    }

    // Handle form submission (Add/Edit Slide)
    if (promoSlideForm) {
        promoSlideForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const slideId = slideIdInput.value;
            const isEditMode = !!slideId; // True if slideId exists
            const method = isEditMode ? 'PUT' : 'POST';
            const url = isEditMode ? `${API_BASE_URL}/${slideId}` : API_BASE_URL;

            const formData = new FormData();
            formData.append('title', slideTitleInput.value);
            formData.append('description', slideDescriptionInput.value);
            formData.append('buttonText', slideButtonTextInput.value);
            formData.append('buttonLink', slideButtonLinkInput.value);
            formData.append('order', slideOrderInput.value);
            formData.append('isActive', slideIsActiveInput.checked ? 'true' : 'false');

            if (slideImageInput.files && slideImageInput.files.length > 0) {
                formData.append('promoSlideImage', slideImageInput.files[0]); // Changed field name
            }

            saveSlideBtn.disabled = true;
            saveSlideBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Authorization': window.getAuthHeaders().Authorization
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    promoSlideModal.hide(); // Close modal
                    fetchPromoSlides(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to save slide.');
                }
            } catch (error) {
                console.error('Error saving promo slide:', error);
                window.showToast(`Error: ${error.message}`, 'danger');
            } finally {
                saveSlideBtn.disabled = false;
                saveSlideBtn.innerHTML = 'Save Slide';
            }
        });
    }

    // Handle Edit Slide button click
    async function handleEditSlide(event) {
        const slideId = event.currentTarget.dataset.id;
        promoSlideModalLabel.textContent = 'Edit Promo Slide';
        promoSlideForm.reset(); // Clear form fields
        slideIdInput.value = slideId; // Set hidden ID

        imagePreview.src = '#';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/${slideId}`, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch slide details for editing.');
            }

            // Populate form fields
            slideTitleInput.value = data.title;
            slideDescriptionInput.value = data.description;
            slideButtonTextInput.value = data.buttonText;
            slideButtonLinkInput.value = data.buttonLink;
            slideOrderInput.value = data.order;
            slideIsActiveInput.checked = data.isActive;

            if (data.imageUrl) {
                imagePreview.src = data.imageUrl;
                imagePreview.style.display = 'block';
                imagePlaceholder.style.display = 'none';
            } else {
                imagePreview.src = '#';
                imagePreview.style.display = 'none';
                imagePlaceholder.style.display = 'block';
            }

            promoSlideModal.show();
        } catch (error) {
            console.error('Error loading promo slide for edit:', error);
            window.showToast(`Error loading slide: ${error.message}`, 'danger');
        }
    }

    // Handle Delete Slide button click
    async function handleDeleteSlide(event) {
        const slideId = event.currentTarget.dataset.id;
        window.showConfirmationModal('Are you sure you want to delete this promo slide?', async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/${slideId}`, {
                    method: 'DELETE',
                    headers: window.getAuthHeaders()
                });
                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    fetchPromoSlides(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to delete slide.');
                }
            } catch (error) {
                console.error('Error deleting promo slide:', error);
                window.showToast(`Error deleting slide: ${error.message}`, 'danger');
            }
        });
    }

    // Initial fetch of slides when page loads
    fetchPromoSlides();
});
