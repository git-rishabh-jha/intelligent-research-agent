import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    if (!username || !password) {
      setError("All Fields are required");
      return;
    }

    try{

      const resposne = await fetch("http://localhost:8000/auth/login",{
        method : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await resposne.json();
      if (!resposne.ok){
        throw new Error(data.detail || "Login Failed");
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", username);
      navigate("/chat");

    }catch (err: any){
      setError(err.message);
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

          <button
            onClick={handleLogin}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-xl transition"
          >
            Login
          </button>
        </div>

        <p className="text-sm text-slate-400 mt-6 text-center">
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            className="text-emerald-400 cursor-pointer hover:underline"
          >
            Sign up
          </span>
        </p>

      </div>
    </div>
  );
}