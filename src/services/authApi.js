import { apiRequest, getApiBaseUrl } from "./api.js";

const DEFAULT_LOGIN_PATH = "/auth/login";
const FALLBACK_LOGIN_PATH = "/login";

const sanitizeLoginPath = (path) => {
  const normalizedPath = String(path ?? "")
    .trim()
    .replace(/[`]+/g, "")
    .replace(/\/+$/, "");
  if (!normalizedPath) {
    return "";
  }

  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
};

const buildFullLoginUrl = (path) => {
  const sanitizedPath = sanitizeLoginPath(path || DEFAULT_LOGIN_PATH);
  if (!sanitizedPath) {
    return "";
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return sanitizedPath;
  }

  try {
    return new URL(`${baseUrl}${sanitizedPath}`).toString();
  } catch {
    return `${baseUrl}${sanitizedPath}`;
  }
};

export async function login(email, password) {
  const configuredLoginPath = sanitizeLoginPath(
    process.env.EXPO_PUBLIC_LOGIN_PATH,
  );
  const loginPaths = Array.from(
    new Set(
      [
        configuredLoginPath || DEFAULT_LOGIN_PATH,
        DEFAULT_LOGIN_PATH,
        FALLBACK_LOGIN_PATH,
      ].filter(Boolean),
    ),
  );

  let lastError;

  for (const loginPath of loginPaths) {
    try {
      return await apiRequest(loginPath, {
        method: "POST",
        body: { email, password },
      });
    } catch (error) {
      lastError = error;
      if (error?.status !== 404) {
        throw error;
      }
    }
  }

  if (lastError?.status === 404) {
    lastError.message = `Login endpoint was not found at ${buildFullLoginUrl(DEFAULT_LOGIN_PATH)}. Please confirm the backend route is available.`;
  }

  throw lastError;
}
