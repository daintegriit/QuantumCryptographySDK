import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full border border-gray-700" />
          : <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">{user.name?.[0]?.toUpperCase()}</div>
        }
        <span className="text-sm text-gray-300 hidden md:block">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 p-2">
          <div className="px-3 py-2 border-b border-gray-800 mb-1">
            <div className="text-sm text-white font-medium">{user.name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
            {user.is_admin && <span className="text-xs text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Admin</span>}
          </div>
          <button onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
