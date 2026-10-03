import { useState } from "react";
import LoginScreen from "../screens/LoginScreen";
import ParentPortalScreen from "../screens/ParentPortalScreen";
import TeacherPortalScreen from "../screens/TeacherPortalScreen";

export default function Index() {
  const [session, setSession] = useState<{
    role: string;
    email?: string;
    token?: string;
    id?: string | number;
    name?: string;
    schoolName?: string;
    academicYearId?: string | number;
  } | null>(null);

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  if (session.role === "Teacher") {
    return (
      <TeacherPortalScreen
        session={session}
        onLogout={() => setSession(null)}
      />
    );
  }

  return (
    <ParentPortalScreen session={session} onLogout={() => setSession(null)} />
  );
}
