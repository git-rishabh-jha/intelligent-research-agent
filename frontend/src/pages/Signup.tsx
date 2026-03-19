import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../services/api";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");

    if (!email || !username || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length > 72) {
      setError("Password must be less than 72 characters");
      return;
    }

    try {
      setLoading(true);

      await api("/auth/signup", "POST", {
        email,
        username,
        password,
      });

      // ✅ Success
      alert("Signup successful! Please login.");

      navigate("/login"); // go to login page

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">
      <div className="bg-slate-800 p-10 rounded-2xl w-full max-w-md shadow-lg border border-slate-700">

        <h1 className="text-3xl font-bold text-center mb-8 text-emerald-400">
          Research Assistant
        </h1>

        <div className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="text"
            placeholder="Username"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-black font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </div>

        <p className="text-sm text-slate-400 mt-6 text-center">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/")}
            className="text-emerald-400 cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>

      </div>
    </div>
  );
}