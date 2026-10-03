import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;
const originalFormData = global.FormData;
const originalDev = global.__DEV__;
const originalWarn = console.warn;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

test("uploadChildPhoto sends the selected asset as multipart image and rejects API failures", async () => {
  const calls = [];
  const responses = [
    {
      status: 200,
      payload: { success: true, data: { url: "/uploads/profile.png" } },
    },
    {
      status: 200,
      payload: { success: true, data: { url: "/uploads/web-profile.png" } },
    },
    {
      status: 400,
      payload: { success: false, message: "No file uploaded" },
    },
    {
      status: 200,
      payload: { success: false, message: "Upload was rejected" },
    },
    {
      status: 200,
      payload: { success: true },
    },
  ];

  class CapturedFormData {
    constructor() {
      this.parts = [];
    }

    append(name, value) {
      this.parts.push({ name, value });
    }
  }

  process.env.EXPO_PUBLIC_API_URL = "https://educampus360.com/api";
  global.__DEV__ = false;
  global.FormData = CapturedFormData;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), ...options });
    const { status, payload } = responses.shift();
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify(payload),
    };
  };

  try {
    const { parentApi } = await import(
      `../src/services/parentApi.js?test=${Date.now()}`
    );
    const imageAsset = {
      uri: "file:///storage/emulated/0/Pictures/profile.png",
      fileName: "picked-profile.png",
      mimeType: "image/png",
    };

    const result = await parentApi.uploadChildPhoto(12, imageAsset, {
      token: "test-token",
    });

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://educampus360.com/api/upload/image",
    );
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
    assert.equal(calls[0].headers["Content-Type"], undefined);
    assert.ok(calls[0].body instanceof CapturedFormData);
    assert.deepEqual(calls[0].body.parts, [
      {
        name: "image",
        value: {
          uri: imageAsset.uri,
          name: imageAsset.fileName,
          type: imageAsset.mimeType,
        },
      },
    ]);

    const browserFile = {
      name: "browser-profile.png",
      type: "image/png",
    };
    const webAsset = {
      uri: "blob:https://localhost/profile",
      fileName: browserFile.name,
      mimeType: browserFile.type,
      file: browserFile,
    };
    await parentApi.uploadChildPhoto(12, webAsset, { token: "test-token" });
    assert.deepEqual(calls[1].body.parts, [
      { name: "image", value: browserFile },
    ]);

    await assert.rejects(
      parentApi.uploadChildPhoto(12, imageAsset, { token: "test-token" }),
      (error) => {
        assert.equal(error.kind, "http");
        assert.equal(error.status, 400);
        assert.equal(error.message, "No file uploaded");
        return true;
      },
    );
    assert.equal(calls.length, 3);

    await assert.rejects(
      parentApi.uploadChildPhoto(12, imageAsset, { token: "test-token" }),
      (error) => {
        assert.equal(error.kind, "api");
        assert.equal(error.status, 200);
        assert.equal(error.message, "Upload was rejected");
        return true;
      },
    );
    assert.equal(calls.length, 4);

    const { apiRequest } = await import(
      `../src/services/api.js?multipart-test=${Date.now()}`
    );
    await apiRequest("/upload/image", {
      method: "POST",
      body: new CapturedFormData(),
      isMultipart: true,
      headers: { "Content-Type": "multipart/form-data" },
    });
    assert.equal(calls[4].headers["Content-Type"], undefined);
    assert.equal(calls[4].url, "https://educampus360.com/api/upload/image");

    let networkWarning;
    console.warn = (...args) => {
      networkWarning = args;
    };
    global.fetch = async () => {
      const error = new TypeError("Network request failed");
      error.code = "E_NETWORK";
      throw error;
    };
    await assert.rejects(
      parentApi.uploadChildPhoto(12, imageAsset, { token: "test-token" }),
      (error) => {
        assert.equal(error.kind, "network");
        assert.equal(error.status, 0);
        assert.deepEqual(error.details, {
          url: "https://educampus360.com/api/upload/image",
          method: "POST",
          name: "TypeError",
          code: "E_NETWORK",
          message: "Network request failed",
        });
        return true;
      },
    );
    assert.deepEqual(networkWarning[1], {
      url: "https://educampus360.com/api/upload/image",
      method: "POST",
      name: "TypeError",
      code: "E_NETWORK",
      message: "Network request failed",
    });
    assert.equal(calls.length, 5);
  } finally {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
    console.warn = originalWarn;
    if (originalDev === undefined) {
      delete global.__DEV__;
    } else {
      global.__DEV__ = originalDev;
    }
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
  }
});
