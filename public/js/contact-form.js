// public/js/contact-form.js

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');

    if (contactForm) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // منع السلوك الافتراضي للنموذج (إعادة تحميل الصفحة)

            const name = document.getElementById('contact-name').value;
            const email = document.getElementById('contact-email').value;
            const subject = document.getElementById('contact-subject').value;
            const message = document.getElementById('contact-message').value;

            // بسيطة للتحقق من الحقول الأساسية
            if (!name || !email || !subject || !message) {
                window.showToast('Please fill in all fields.', 'warning');
                return;
            }

            if (!email.includes('@') || !email.includes('.')) {
                window.showToast('Please enter a valid email address.', 'warning');
                return;
            }

            // عرض رسالة "جاري الإرسال"
            window.showToast('Sending your message...', 'info');

            try {
                const response = await fetch('http://localhost:3000/api/contact', { // ✅ NEW: نقطة نهاية Backend جديدة
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, subject, message })
                });

                const data = await response.json();

                if (response.ok) {
                    window.showToast(data.message, 'success');
                    contactForm.reset(); // مسح حقول النموذج بعد الإرسال الناجح
                } else {
                    window.showToast(data.message || 'Failed to send your message. Please try again.', 'danger');
                }
            } catch (error) {
                console.error('Contact form submission error:', error);
                window.showToast('An error occurred. Please try again later.', 'danger');
            }
        });
    }
});