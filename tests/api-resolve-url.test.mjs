import assert from "node:assert/strict";
import test from "node:test";

process.env.EXPO_PUBLIC_API_URL = "https://school.example/api";

const { resolveApiUrl } = await import(
  `../src/services/api.js?test=${Date.now()}`
);

test("resolveApiUrl resolves receipt paths against the backend origin", () => {
  assert.equal(
    resolveApiUrl("/storage/receipts/receipt.pdf"),
    "https://school.example/storage/receipts/receipt.pdf",
  );
  assert.equal(
    resolveApiUrl("storage/receipts/receipt.pdf"),
    "https://school.example/storage/receipts/receipt.pdf",
  );
});

test("resolveApiUrl preserves absolute receipt URLs", () => {
  assert.equal(
    resolveApiUrl("https://cdn.example/receipt.pdf?token=abc"),
    "https://cdn.example/receipt.pdf?token=abc",
  );
});
