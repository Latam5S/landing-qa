// Shared Tailwind Configuration for Latam5S
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#3B82F6" /* Azul eléctrico */,
        primary_glow: "#60A5FA",
        secondary: "#10B981" /* Verde éxito */,
        dark_bg: "#020617" /* Negro profundo Slate-950 */,
        card_bg: "#0f172a" /* Slate-900 */,
        glass: "rgba(255, 255, 255, 0.03)",
        glass_border: "rgba(255, 255, 255, 0.08)",
        brand_accent: "#D96B4F",
        brand_accent_alt: "#FF8B6A",
        brand_text: "#2b2b2b",
        danger: "#d93025",
        whatsapp: "#25D366",
        whatsapp_hover: "#20bd5a",
        // Neon colors from landing/index
        neon_blue: "#3B82F6",
        neon_purple: "#8B5CF6",
        neon_green: "#10B981",
      },
      fontFamily: {
        sans: ["Quicksand", "sans-serif"],
        label: ["Inter", "sans-serif"],
        quicksand: ["Quicksand", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(59, 130, 246, 0.15)",
        "neon-green": "0 0 20px rgba(16, 185, 129, 0.15)",
      },
      animation: {
        shake: "shake 0.5s cubic-bezier(.36,.07,.19,.97) both",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        float: "float 4s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        shake: {
          "10%, 90%": { transform: "translate3d(-1px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(2px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-4px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(4px, 0, 0)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
      },
    },
  },
};
