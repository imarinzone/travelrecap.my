module.exports = {
  content: [
    "./index.html",
    "./script.js",
    "./components/**/*.{js,ts,tsx}"
  ],
  theme: {
    extend: {
      animation: {
        'plane-glide': 'plane-glide 8s ease-in-out infinite',
        'car-drive': 'car-drive 6s linear infinite',
        'train-drive': 'train-drive 5s linear infinite',
        'walk-cycle': 'walk-cycle 4s ease-in-out infinite',
        'bike-ride': 'bike-ride 5s ease-in-out infinite',
        'city-breathe': 'city-breathe 4s ease-in-out infinite',
        'window-twinkle': 'window-twinkle 2s ease-in-out infinite',
        'tree-grow': 'tree-grow 2s ease-out forwards',
        'tree-sway': 'tree-sway 3s ease-in-out infinite',
        'smoke-puff': 'smoke-puff 3s ease-out infinite',
        'character-breathe': 'character-breathe 3s ease-in-out infinite',
        'orbital-float': 'orbital-float 6s ease-in-out infinite',
        'pin-drop': 'pin-drop 0.8s ease-out forwards',
        'scene-emerge': 'scene-emerge 0.6s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'road-dash': 'road-dash 1s linear infinite',
      },
      keyframes: {
        'plane-glide': {
          '0%': { transform: 'translate(-20%, 80%) rotate(-25deg) scale(0.8)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translate(120%, -20%) rotate(-25deg) scale(1)', opacity: '0' },
        },
        'car-drive': {
          '0%': { transform: 'translateX(-30%)' },
          '100%': { transform: 'translateX(130%)' },
        },
        'train-drive': {
          '0%': { transform: 'translateX(-40%)' },
          '100%': { transform: 'translateX(140%)' },
        },
        'walk-cycle': {
          '0%, 100%': { transform: 'translateX(-20%) translateY(0)' },
          '25%': { transform: 'translateX(10%) translateY(-3px)' },
          '50%': { transform: 'translateX(40%) translateY(0)' },
          '75%': { transform: 'translateX(70%) translateY(-3px)' },
        },
        'bike-ride': {
          '0%': { transform: 'translateX(-25%) rotate(0deg)' },
          '50%': { transform: 'translateX(50%) rotate(2deg)' },
          '100%': { transform: 'translateX(125%) rotate(0deg)' },
        },
        'city-breathe': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-3px) scale(1.02)' },
        },
        'window-twinkle': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        'tree-grow': {
          '0%': { transform: 'scaleY(0) translateY(100%)', opacity: '0' },
          '60%': { transform: 'scaleY(1.1) translateY(0)', opacity: '1' },
          '100%': { transform: 'scaleY(1) translateY(0)', opacity: '1' },
        },
        'tree-sway': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'smoke-puff': {
          '0%': { transform: 'translateY(0) scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'translateY(-30px) scale(1.5)', opacity: '0' },
        },
        'character-breathe': {
          '0%, 100%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(1.02) translateY(-2px)' },
        },
        'orbital-float': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(5px, -5px) scale(1.02)' },
          '50%': { transform: 'translate(0, -8px) scale(1)' },
          '75%': { transform: 'translate(-5px, -5px) scale(1.02)' },
          '100%': { transform: 'translate(0, 0) scale(1)' },
        },
        'pin-drop': {
          '0%': { transform: 'translateY(-50px) scale(0.5)', opacity: '0' },
          '60%': { transform: 'translateY(5px) scale(1.1)', opacity: '1' },
          '80%': { transform: 'translateY(-3px) scale(0.95)' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'scene-emerge': {
          '0%': { transform: 'scale(0.8) translateZ(-50px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateZ(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' },
        },
        'road-dash': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-40' },
        },
      },
    },
  },
  plugins: [],
};



