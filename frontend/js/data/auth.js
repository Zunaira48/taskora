const AUTH_API = "http://127.0.0.1:3000/api/auth";

async function registerAccount(email, password) {
  const res = await fetch(`${AUTH_API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // required so the httpOnly cookie gets set/sent
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

async function loginAccount(email, password) {
  const res = await fetch(`${AUTH_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

async function logoutAccount() {
  await fetch(`${AUTH_API}/logout`, {
    method: "POST",
    credentials: "include"
  });
}

async function getCurrentUser() {
  const res = await fetch(`${AUTH_API}/me`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}