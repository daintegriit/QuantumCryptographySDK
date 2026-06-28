import { FaGoogle, FaShieldAlt, FaChartBar, FaCertificate } from "react-icons/fa";

export default function LoginPage() {
  function handleGoogleLogin() {
    window.location.href = `${import.meta.env.VITE_API_BASE}/auth/google/login`;
  }

  const features = [
    { icon: <FaShieldAlt size={22} className="text-cyan-400" />, label: "53 PQC algorithms" },
    { icon: <FaChartBar size={22} className="text-cyan-400" />, label: "Governance dashboard" },
    { icon: <FaCertificate size={22} className="text-cyan-400" />, label: "NIST compliant" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md space-y-8 p-8">

        <div className="text-center space-y-3">
          <div className="text-5xl font-bold text-cyan-400 tracking-tight">Q-SENTRY</div>
          <div className="text-gray-400 text-sm">Post-Quantum Cryptographic Governance</div>
          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {["FIPS 203","FIPS 204","FIPS 205","FIPS 206"].map(f => (
              <span key={f} className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{f}</span>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-white text-xl font-semibold">Sign in</h2>
            <p className="text-gray-400 text-sm mt-1">Your keys are isolated to your account.</p>
          </div>
          <button onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm transition">
            <FaGoogle size={16} />
            Continue with Google
          </button>
          <div className="text-xs text-gray-600 text-center">No key material is shared between users.</div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {features.map(({ icon, label }) => (
            <div key={label} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800">
              <div className="flex justify-center mb-1">{icon}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-gray-600">
          <a href="https://qsentry.io/paper" className="hover:text-gray-400 transition">Read the paper</a>
          {" · "}
          <a href="https://github.com/daintegriit/QuantumCryptographySDK" className="hover:text-gray-400 transition">GitHub</a>
        </div>

      </div>
    </div>
  );
}
