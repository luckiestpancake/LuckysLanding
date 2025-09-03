document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('searchbox');
  const cards = document.querySelectorAll('.card.text-center');

  searchBox.addEventListener('input', () => {
    const searchTerm = searchBox.value.trim().toLowerCase();

    cards.forEach(card => {
      const cardTitle = card.querySelector('.card-title').textContent.toLowerCase();
      if (cardTitle.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });


    const searchCard = document.querySelector('.search-card');
    if (searchCard) {
      searchCard.style.display = 'block';
    }
  });
});