//tailwind.config.js
module.exports = {
    content: [
        './src/**/*.{astro,html,js,jsx,svelte,ts,tsx,vue,mdx, md}'
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0078D4',   // Blue
                secondary: '#D83B01', // Orange
                accent: '#107C10',    // Green
                neutral: '#F3F2F1',   // Light Gray
                dark: '#201F1E',      // Dark Gray
            },
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
                serif: ['Merriweather', 'serif'],
            },
        }
    },
    plugins: [],
};