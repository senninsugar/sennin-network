const API = "/api";

function getToken() {
  return localStorage.getItem("webos_token");
}

async function request(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API}${url}`,
    {
      ...options,
      headers
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Request failed"
    );
  }

  return data;
}

export async function register(
  username,
  password
) {
  const result = await request(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    }
  );

  localStorage.setItem(
    "webos_token",
    result.token
  );

  return result;
}

export async function login(
  username,
  password
) {
  const result = await request(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    }
  );

  localStorage.setItem(
    "webos_token",
    result.token
  );

  return result;
}

export async function getMe() {
  return request("/auth/me");
}

export async function getApps(search = "") {
  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";

  return request(`/apps${query}`);
}

export async function getInstalledApps() {
  return request("/apps/installed");
}

export async function installApp(id) {
  return request(
    `/apps/${id}/install`,
    {
      method: "POST"
    }
  );
}

export async function uninstallApp(id) {
  return request(
    `/apps/${id}/install`,
    {
      method: "DELETE"
    }
  );
}

export async function createApp(data) {
  return request(
    "/apps/developer/create",
    {
      method: "POST",
      body: JSON.stringify(data)
    }
  );
}

export async function getMyApps() {
  return request(
    "/apps/developer/my"
  );
}

export async function publishApp(id) {
  return request(
    `/apps/developer/${id}/publish`,
    {
      method: "POST"
    }
  );
}
