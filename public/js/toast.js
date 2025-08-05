// public/js/toast.js
// Function to show a Bootstrap Toast notification
window.showToast = (message, type = 'success') => { // Made global: window.showToast
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.error('Toast container not found! Please add: <div class="toast-container position-fixed bottom-0 end-0 p-3"></div>');
        return;
    }

    const toastElement = document.createElement('div');
    toastElement.classList.add('toast', 'align-items-center', 'text-white', 'border-0');
    
    switch (type) {
        case 'success': toastElement.classList.add('bg-success'); break;
        case 'danger': toastElement.classList.add('bg-danger'); break;
        case 'info': toastElement.classList.add('bg-info'); break;
        case 'warning': toastElement.classList.add('bg-warning', 'text-dark'); break; 
        default: toastElement.classList.add('bg-primary'); break;
    }

    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    toastElement.setAttribute('data-bs-autohide', 'true');
    toastElement.setAttribute('data-bs-delay', '10000'); 

    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastElement);

    if (typeof bootstrap !== 'undefined' && typeof bootstrap.Toast !== 'undefined') {
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    } else {
        console.error('Bootstrap Toast not available. Check script loading order: Bootstrap JS -> custom JS.');
    }
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
};