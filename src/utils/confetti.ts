import confetti from 'canvas-confetti';

export function fireRewardConfetti(): void {
  try {
    // Coral & green brand confetti explosion
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#FF765F', '#8BE3A2', '#F7F4F0', '#FFB4A2'],
      zIndex: 99999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  } catch (err) {
    console.warn('Confetti error:', err);
  }
}
