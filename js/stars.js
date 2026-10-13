(function () {
  const canvas = document.getElementById("sky");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stars = [];
  let meteors = [];
  let width = 0;
  let height = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let nextMeteor = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(80, Math.min(200, Math.floor((width * height) / 11000)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      r: Math.random() * 1.3 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.9 + 0.25
    }));
  }

  function spawnMeteor(now) {
    meteors.push({
      x: width * (0.15 + Math.random() * 0.7),
      y: height * Math.random() * 0.35,
      vx: 7 + Math.random() * 4,
      vy: 2.4 + Math.random() * 2,
      life: 1,
      born: now
    });
    nextMeteor = now + 5000 + Math.random() * 7000;
  }

  function frame(now) {
    ctx.clearRect(0, 0, width, height);
    const dx = (mouseX - 0.5) * 18;
    const dy = (mouseY - 0.5) * 12;

    for (const star of stars) {
      const twinkle = reduced ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.phase));
      const x = star.x * width + dx * star.z;
      const y = star.y * height + dy * star.z;
      ctx.beginPath();
      ctx.fillStyle = "rgba(236, 242, 255," + (twinkle * (0.28 + star.z * 0.72)).toFixed(3) + ")";
      ctx.arc(x, y, star.r * (0.55 + star.z), 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduced) {
      if (now > nextMeteor) spawnMeteor(now);
      meteors = meteors.filter((meteor) => meteor.life > 0);
      for (const meteor of meteors) {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= 0.012;
        const gradient = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - 90, meteor.y - 32);
        gradient.addColorStop(0, "rgba(255,255,255," + meteor.life + ")");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x - 90, meteor.y - 32);
        ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    mouseX = event.clientX / width;
    mouseY = event.clientY / height;
  });
  resize();
  requestAnimationFrame(frame);
})();
