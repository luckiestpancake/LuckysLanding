document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll('.card');
  const phases = Array.from(cards).map(() => ({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2
  }));

  function floatCards() {
    const time = Date.now() * 0.0015;
    
    cards.forEach((card, index) => {
      const offsetX = Math.sin(time + phases[index].x) * 10;
      const offsetY = Math.cos(time + phases[index].y) * 10;
      card.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    requestAnimationFrame(floatCards);
  }

  floatCards();
});
