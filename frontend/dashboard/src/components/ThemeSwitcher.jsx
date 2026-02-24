import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { themeName, setThemeName } = useTheme();

  const handleChange = (e) => {
    setThemeName(e.target.value);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <select
        value={themeName}
        onChange={handleChange}
        className="p-2 rounded bg-black/40 text-white border border-white/20 backdrop-blur"
      >
        <option value="apple">Apple Black</option>
        <option value="cyberpunk">Cyberpunk</option>
        <option value="fintech">Fintech Sleek</option>
        <option value="glass">Glassmorphism</option>
        <option value="neon">Neon Glow</option>
        <option value="microsoft">Microsoft Security</option>
        <option value="quant">Quant Terminal</option>
      </select>
    </div>
  );
}