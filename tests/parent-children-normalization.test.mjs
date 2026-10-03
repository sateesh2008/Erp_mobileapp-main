import assert from "node:assert/strict";
import test from "node:test";

const { normalizeParentChildren } =
  await import("../src/services/parentNormalization.js");

test("uses student_id rather than a parent-child link id", () => {
  const result = normalizeParentChildren({
    data: [{ id: 2960, student_id: 3378, name: "Student" }],
  });

  assert.equal(result[0].id, 3378);
  assert.equal(result[0].student_id, 3378);
  assert.equal(result[0].parentChildId, 2960);
});

test("supports nested student objects and generic id fallback", () => {
  const result = normalizeParentChildren({
    children: [{ id: 2960, student: { student_id: 3378 } }, { id: 4455 }],
  });

  assert.equal(result[0].id, 3378);
  assert.equal(result[1].id, 4455);
});
