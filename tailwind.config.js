const colors = require('tailwindcss/colors') // Import default colors

module.exports = {
  purge: [],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        stone: colors.stone,
        emerald: colors.emerald
      },
      fontFamily: {
        'sans': ['AlteHaasGrotesk', 'sans-serif'],
        'serif': ['AlteHaasGrotesk', 'serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      gridTemplateColumns: {
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
