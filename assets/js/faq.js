document.addEventListener('DOMContentLoaded', function () {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const button = item.querySelector('.faq-question');

        button.addEventListener('click', () => {
            // Optional: Close other open items when one is clicked
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('is-open');
                }
            });

            // Toggle the clicked item
            item.classList.toggle('is-open');
        });
    });
});