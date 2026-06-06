import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        sage: "#4f6f52",
        signal: "#d97706",
        paper: "#f7f7f2"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(20, 33, 61, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
