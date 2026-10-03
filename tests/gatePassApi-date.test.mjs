import assert from "node:assert/strict";
import test from "node:test";

global.__DEV__ = false;

const originalFetch = global.fetch;

test("gate pass create uses the issue endpoint and exact payload contract", async () => {
  global.fetch = async (url, options) => {
    const requestUrl = new URL(url);
    const body = JSON.parse(options.body);

    assert.equal(requestUrl.pathname, "/api/gate-passes");
    assert.equal(options.headers.Authorization, "Bearer demo");
    assert.equal(body.student_id, 101);
    assert.equal(body.class_id, 1);
    assert.equal(body.division_id, 2);
    assert.equal(body.reason_type, "Medical / Sickness");
    assert.equal(body.reason_details, "Student is unwell.");
    assert.equal(body.accompanied_by, "Parent: Ramesh Sharma");
    assert.equal(body.relation_with_student, "Parent");
    assert.equal(body.contact_number, "9876543210");
    assert.equal(body.out_time, "2026-09-22T17:14");
    assert.equal(body.is_one_way, false);
    assert.equal(body.expected_return_time, "2026-09-22T20:00");
    assert.equal(body.approved_by, "Sudarsan Kumar");
    assert.equal(body.security_remarks, "");

    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({
        success: true,
        message: "Gate pass issued successfully.",
      }),
    };
  };

  try {
    const { gatePassApi } = await import("../src/services/gatePassApi.js");

    const result = await gatePassApi.create(
      {
        studentId: 101,
        classId: 1,
        divisionId: 2,
        reason: "Medical / Sickness",
        notes: "Student is unwell.",
        escortName: "Parent: Ramesh Sharma",
        escortContact: "9876543210",
        outTime: "2026-09-22T17:14",
        returnRequired: true,
        expectedReturnTime: "2026-09-22T20:00",
        approvedBy: "Sudarsan Kumar",
      },
      { token: "demo" },
    );

    assert.deepEqual(result, {
      success: true,
      message: "Gate pass issued successfully.",
    });
  } finally {
    global.fetch = originalFetch;
  }
});
