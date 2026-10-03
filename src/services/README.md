Attendance endpoints expected by the client:

- GET /parents/child/{studentId}/attendance?month=YYYY-MM
- GET /attendance/daily?date=YYYY-MM-DD&search=...
- GET /attendance/history?from=YYYY-MM-DD&to=YYYY-MM-DD&search=...&status=...
- GET /attendance/biometric?date=YYYY-MM-DD&search=...
- POST /attendance/cutoff with { date }
- POST /attendance/submit with { records }
- GET /attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=PDF|CSV|Excel
- GET /fees/summary
- GET /fees/pending
- GET /fees/transactions
- GET /exams?student_id=...
- GET /parents/child/{studentId}/exams
- GET /exams/student/{studentId}/hall-ticket/{examId}
- GET /timetable
- GET /leaves?student_id=...
- POST /leaves/apply with { student_id, leave_type, start_date, end_date, reason }
- GET /transport/buses
- GET /transport/routes
- GET /transport/routes/{routeId}/stops
- GET /transport/mappings?student_id=...
- GET /transport/fares

Set EXPO_PUBLIC_API_URL to the backend origin. The authenticated access token is sent as a Bearer token when the login flow supplies one.
