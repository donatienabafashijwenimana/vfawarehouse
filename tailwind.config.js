export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        forest: { 50:'#f0faf0',100:'#d9f2d9',200:'#b3e4b3',300:'#7fce7f',400:'#4db54d',500:'#2d9e2d',600:'#1f7a1f',700:'#175c17',800:'#114111',900:'#0b2c0b' },
        earth:  { 50:'#fdf8f0',100:'#f5e8cc',200:'#ebd099',300:'#ddb75f',400:'#ca9b35',500:'#b07d1e',600:'#8c6016',700:'#6b4810',800:'#4d330b',900:'#332207' },
        sky:    { 50:'#f0f7ff',100:'#cce4ff',200:'#99c9ff',300:'#5fa8ff',400:'#2e88ff',500:'#0a6de0',600:'#0055b3',700:'#003d80',800:'#002b5c',900:'#001c3d' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
