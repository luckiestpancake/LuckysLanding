// scramble.js
class TextScramble {
  constructor(el) {
    this.el = el;
    this.originalText = el.textContent.trim();
    this.chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    this.frame = null;
    this.scrambleInterval = 60; // ms
    this.scrambleChance = 0.15;
  }

  start() {
    this.stop(); // clear any existing loops
    this.frame = setInterval(() => {
      const scrambled = Array.from(this.originalText)
        .map(char =>
          Math.random() < this.scrambleChance ? this.randomChar() : char
        )
        .join('');
      this.el.textContent = scrambled;
    }, this.scrambleInterval);
  }

  stop() {
    clearInterval(this.frame);
    this.el.textContent = this.originalText;
  }

  randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.floaty-name').forEach(el => {
    const scrambler = new TextScramble(el);
    el.addEventListener('mouseenter', () => scrambler.start());
    el.addEventListener('mouseleave', () => scrambler.stop());
  });
});