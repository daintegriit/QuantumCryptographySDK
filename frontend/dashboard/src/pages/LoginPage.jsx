export default function LoginPage() {
  function handleGoogleLogin() {
    window.location.href = `${import.meta.env.VITE_API_BASE}/auth/google/login`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center space-y-3">
          <div className="text-5xl font-bold text-cyan-400 tracking-tight">Q-SENTRY</div>
          <div className="text-gray-400 text-sm">Post-Quantum Cryptographic Governance</div>
          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {["FIPS 203", "FIPS 204", "FIPS 205", "FIPS 206"].map(f => (
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
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>
          <div className="text-xs text-gray-600 text-center">No key material is shared between users.</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[["🔐","53 PQC algorithms"],["📊","Governance dashboard"],["🛡️","NIST compliant"]].map(([icon,label]) => (
            <div key={label} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
