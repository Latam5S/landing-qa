// Latam5S Landing Page - Main Application Script
// Environment variables available via import.meta.env

// Initialize Feather Icons
feather.replace();

// --- DARK MODE TOGGLE ---
const themeToggleBtn = document.getElementById("theme-toggle");
const themeToggleDarkIcon = document.getElementById("theme-toggle-dark-icon");
const themeToggleLightIcon = document.getElementById("theme-toggle-light-icon");

function updateIcons() {
  if (document.documentElement.classList.contains("dark")) {
    themeToggleDarkIcon.classList.add("hidden");
    themeToggleLightIcon.classList.remove("hidden");
  } else {
    themeToggleDarkIcon.classList.remove("hidden");
    themeToggleLightIcon.classList.add("hidden");
  }
}

if (
  localStorage.getItem("color-theme") === "dark" ||
  (!("color-theme" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}
updateIcons();

themeToggleBtn.addEventListener("click", function () {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(
    "color-theme",
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  updateIcons();
});

// --- CANVAS PARTICLES ---
const canvas = document.getElementById("chaosCanvas");
const ctx = canvas.getContext("2d");
let particles = [];

function initChaos() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    });
  }
}

function drawChaos() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = document.documentElement.classList.contains("dark")
    ? "rgba(59, 130, 246, 0.2)"
    : "rgba(59, 130, 246, 0.08)";
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    ctx.fill();
  });
  requestAnimationFrame(drawChaos);
}

window.addEventListener("resize", initChaos);
initChaos();
drawChaos();
