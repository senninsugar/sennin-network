export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (response.status === 204) {
    return null;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error || "Request failed"
    );
  }

  return body;
}
