import { API_URL } from "../config";
import { useState } from "react";
import { errorMessage } from "../api";

const Login = ({ login }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Login failed"));
      const data = await response.json();
      login(username, data.token);
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required for registration.");
      return;
    }
    try {
      const registerResponse = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!registerResponse.ok)
        throw new Error(await errorMessage(registerResponse, "Registration failed"));

      const loginResponse = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!loginResponse.ok) throw new Error("Login after registration failed");
      const data = await loginResponse.json();
      login(username, data.token);
      setError("");
    } catch (err) {
      setError(err.message || "An error occurred during registration. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl shadow-2xl border border-gradient-to-r from-indigo-500 to-purple-500">
        <h1 className="text-4xl font-bold text-white text-center mb-6 tracking-wide animate-pulse">
          Todo Login
        </h1>
        {error && (
          <p
            role="alert"
            className="text-red-400 text-center mb-4 text-sm font-medium bg-red-900/50 p-2 rounded"
          >
            {error}
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 placeholder-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              aria-label="Username"
              autoComplete="username"
              autoCapitalize="off"
            />
          </div>
          <div>
            <input
              type="password"
              className="w-full p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300 placeholder-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 transform hover:scale-105 font-semibold"
          >
            Login
          </button>
        </form>
        <p className="text-center text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            className="text-indigo-400 hover:text-indigo-300 underline transition duration-300"
            onClick={handleRegister}
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
