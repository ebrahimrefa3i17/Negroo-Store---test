// public/js/admin-hero-slides.js

document.addEventListener('DOMContentLoaded', () => {
    const heroSlidesContainer = document.getElementById('heroSlidesContainer');
    const addNewSlideBtn = document.getElementById('addNewSlideBtn');
    const heroSlideModal = new bootstrap.Modal(document.getElementById('heroSlideModal'));
    const heroSlideModalLabel = document.getElementById('heroSlideModalLabel');
    const heroSlideForm = document.getElementById('heroSlideForm');
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
    const API_BASE_URL = 'http://localhost:3000/api/admin/hero-slides';

    // Function to fetch and display hero slides
    async function fetchHeroSlides() {
        if (!heroSlidesContainer) return;
        heroSlidesContainer.innerHTML = '<div class="col-12 text-center text-muted">Loading hero slides...</div>';
        try {
            const response = await fetch(API_BASE_URL, {
                headers: window.getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch hero slides.');
            }

            displayHeroSlides(data);
        } catch (error) {
            console.error('Error fetching hero slides:', error);
            heroSlidesContainer.innerHTML = `<div class="col-12 text-center text-danger">Failed to load hero slides: ${error.message}</div>`;
            window.showToast(`Failed to load hero slides: ${error.message}`, 'danger');
        }
    }

    // Function to display hero slides in the container
    function displayHeroSlides(slides) {
        heroSlidesContainer.innerHTML = '';
        if (!Array.isArray(slides) || slides.length === 0) {
            heroSlidesContainer.innerHTML = '<div class="col-12 text-center text-muted">No hero slides found. Add a new one!</div>';
            return;
        }

        slides.forEach(slide => {
            const slideCardHtml = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card hero-slide-card h-100">
                        <img src="${slide.imageUrl || 'https://placehold.co/600x150/e0f2f2/004d4d?text=Hero+Slide'}" class="card-img-top" alt="${slide.title}">
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
            heroSlidesContainer.insertAdjacentHTML('beforeend', slideCardHtml);
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
            heroSlideModalLabel.textContent = 'Add New Hero Slide';
            heroSlideForm.reset(); // Clear form fields
            slideIdInput.value = ''; // Clear hidden ID
            imagePreview.src = '#';
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'block';
            slideIsActiveInput.checked = true; // Default to active
            heroSlideModal.show();
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
    if (heroSlideForm) {
        heroSlideForm.addEventListener('submit', async (event) => {
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
                formData.append('heroSlideImage', slideImageInput.files[0]);
            }

            saveSlideBtn.disabled = true;
            saveSlideBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Authorization': window.getAuthHeaders().Authorization // Get token from auth.js
                        // Do NOT set 'Content-Type': 'multipart/form-data' here, browser sets it automatically with FormData
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    heroSlideModal.hide(); // Close modal
                    fetchHeroSlides(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to save slide.');
                }
            } catch (error) {
                console.error('Error saving hero slide:', error);
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
        heroSlideModalLabel.textContent = 'Edit Hero Slide';
        heroSlideForm.reset(); // Clear form fields
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

            heroSlideModal.show();
        } catch (error) {
            console.error('Error loading slide for edit:', error);
            window.showToast(`Error loading slide: ${error.message}`, 'danger');
        }
    }

    // Handle Delete Slide button click
    async function handleDeleteSlide(event) {
        const slideId = event.currentTarget.dataset.id;
        window.showConfirmationModal('Are you sure you want to delete this hero slide?', async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/${slideId}`, {
                    method: 'DELETE',
                    headers: window.getAuthHeaders()
                });
                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    fetchHeroSlides(); // Refresh list
                } else {
                    throw new Error(data.message || 'Failed to delete slide.');
                }
            } catch (error) {
                console.error('Error deleting hero slide:', error);
                window.showToast(`Error deleting slide: ${error.message}`, 'danger');
            }
        });
    }

    // Initial fetch of slides when page loads
    fetchHeroSlides();
});
