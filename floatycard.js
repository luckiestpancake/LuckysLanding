document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll('.card');

  // Unique phase offsets for organic motion
  const phases = Array.from(cards).map(() => ({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2
  }));

  function floatCards() {
    const time = Date.now() * 0.0015; // slower speed

    cards.forEach((card, index) => {
      const offsetX = Math.sin(time + phases[index].x) * 10; // 2x movement
      const offsetY = Math.cos(time + phases[index].y) * 10;
      card.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    requestAnimationFrame(floatCards);
  }

  floatCards();
});
