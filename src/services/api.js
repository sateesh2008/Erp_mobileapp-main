export const getApiBaseUrl = () =>
  String(process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(message, status, details, kind) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.kind = kind || (status === 0 ? "network" : "http");
  }
}

export const getIsApiConfigured = () => Boolean(getApiBaseUrl());
export const isApiConfigured = Boolean(getApiBaseUrl());

export function resolveApiUrl(path) {
  const value = String(path ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return value;

  try {
    const baseOrigin = new URL(baseUrl).origin;
    return new URL(
      value.startsWith("/") ? value : `/${value}`,
      baseOrigin,
    ).toString();
  } catch {
    return value;
  }
}

const errorMessageForStatus = (status) => {
  if (status === 401) return "Your session has expired. Please login again.";
  if (status === 403)
    return "You do not have permission to complete this request.";
  if (status === 404) return "The requested API endpoint was not found.";
  if (status >= 500) return "Something went wrong. Please try again later.";
  return "The request could not be completed. Please try again.";
};

const parseResponseBody = async (response) => {
  if (typeof response?.text === "function") {
    const contentType = response.headers?.get?.("content-type") || "";
    let rawBody;
    try {
      rawBody = await response.text();
    } catch {
      return null;
    }

    if (!rawBody) {
      return null;
    }

    if (!contentType.includes("application/json")) {
      return rawBody;
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  if (typeof response?.json === "function") {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  return null;
};

export async function apiRequest(
  path,
  {
    method = "GET",
    token,
    query,
    body,
    signal,
    headers: extraHeaders,
    isMultipart,
    suppressResponseBodyLog = false,
  } = {},
) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const normalizedPath = String(path ?? "").trim();
  const cleanPath = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  const url = new URL(`${baseUrl}${cleanPath}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  });

  const requestUrl = url.toString();
  const isDev =
    typeof __DEV__ !== "undefined"
      ? Boolean(__DEV__)
      : process.env.NODE_ENV !== "production";

  if (isDev) {
    console.info(`[API] ${method} ${requestUrl}`);
  }

  const hasFormData = Boolean(isMultipart) || (typeof FormData !== "undefined" && body instanceof FormData);
  const requestBody = hasFormData ? body : body ? JSON.stringify(body) : undefined;
  const requestHeaders = {
    Accept: "application/json",
    ...(extraHeaders || {}),
    ...(!hasFormData && body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (hasFormData) {
    Object.keys(requestHeaders)
      .filter((headerName) => headerName.toLowerCase() === "content-type")
      .forEach((headerName) => delete requestHeaders[headerName]);
  }

  let response;
  try {
    response = await fetch(requestUrl, {
      method,
      signal,
      headers: requestHeaders,
      ...(requestBody ? { body: requestBody } : {}),
    });
  } catch (error) {
    const networkDetails = {
      url: requestUrl,
      method,
      name: error?.name || "Error",
      code: error?.code || null,
      message: error?.message || "No response was received.",
    };
    console.warn(
      `[API] ${method} request failed before receiving an HTTP response`,
      networkDetails,
    );
    throw new ApiError(
      "Unable to connect to the server. Please check your internet connection and try again.",
      0,
      networkDetails,
      "network",
    );
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    if (isDev) {
      const statusMessage =
        `[API] ${method} ${requestUrl} returned status ${response.status}`;
      if (suppressResponseBodyLog) console.warn(statusMessage);
      else console.warn(statusMessage, payload);
    }

    const payloadMessage =
      payload && typeof payload === "object"
        ? payload.message || payload.error || payload.errors
        : undefined;
    const message = Array.isArray(payloadMessage)
      ? payloadMessage.filter(Boolean).join(" ")
      : typeof payloadMessage === "object"
        ? Object.values(payloadMessage).flat().filter(Boolean).join(" ")
        : payloadMessage;

    throw new ApiError(
      message ||
        `${errorMessageForStatus(response.status)} (${method} ${path})`,
      response.status,
      payload,
      "http",
    );
  }

  if (isDev) {
    const successMessage =
      `[API] ${method} ${requestUrl} succeeded with status ${response.status}`;
    if (suppressResponseBodyLog) console.info(successMessage);
    else console.info(successMessage, payload);
  }
  return payload;
}
