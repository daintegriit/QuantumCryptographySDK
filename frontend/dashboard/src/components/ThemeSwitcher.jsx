import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { themeName, setThemeName } = useTheme();
  return (
    <select
      value={themeName}
      onChange={(e) => setThemeName(e.target.value)}
      className="text-xs px-2 py-1.5 rounded-md bg-black/40 text-gray-300 border border-gray-700 hover:border-gray-500 transition cursor-pointer focus:outline-none"
    >
      <option value="apple">Apple Black</option>
      <option value="cyberpunk">Cyberpunk</option>
      <option value="fintech">Fintech Sleek</option>
      <option value="glass">Glassmorphism</option>
      <option value="neon">Neon Glow</option>
      <option value="microsoft">Microsoft Security</option>
      <option value="quant">Quant Terminal</option>
    </select>
  );
}
