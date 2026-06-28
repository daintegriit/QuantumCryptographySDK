// src/pages/AuthCallbackPage.jsx
// Handles the OAuth callback — extracts token from URL and stores in localStorage
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("qsentry_token", token);
    }
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-cyan-400 text-sm animate-pulse">Signing in...</div>
    </div>
  );
}
