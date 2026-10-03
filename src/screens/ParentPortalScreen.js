import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AppColors as colors } from "../constants/theme";
import { announcementsApi } from "../services/announcementsApi";
import { resolveApiUrl } from "../services/api";
import { attendanceApi } from "../services/attendanceApi";
import { examsApi } from "../services/examsApi";
import { feesApi } from "../services/feesApi";
import { homeworkApi } from "../services/homeworkApi";
import { parentApi } from "../services/parentApi";
import ChangePhotoScreen from "./ChangePhotoScreen";
import ParentAdditionalModuleScreen from "./ParentAdditionalModuleScreen";
import ParentAnnouncementsScreen from "./ParentAnnouncementsScreen";
import ParentAttendanceScreen from "./ParentAttendanceScreen";
import ParentExamsScreen from "./ParentExamsScreen";
import ParentFeesScreen from "./ParentFeesScreen";
import ParentHomeworkScreen from "./ParentHomeworkScreen";
import ParentLeaveScreen from "./ParentLeaveScreen";
import ParentTimetableScreen from "./ParentTimetableScreen";
import ParentTransportScreen from "./ParentTransportScreen";

const navItems = [
  { label: "Home", icon: "home-outline" },
  { label: "Attendance", icon: "calendar-outline" },
  { label: "Fees", icon: "wallet-outline" },
  { label: "Homework", icon: "book-outline" },
  { label: "Leave", icon: "create-outline" },
  { label: "Exams", icon: "ribbon-outline" },
  { label: "More", icon: "grid-outline" },
];

function Icon({ name, size = 20, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={styles.seeAll}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const additionalModules = [
  {
    title: "Timetable",
    icon: "time-outline",
    tab: "Timetable",
    tint: colors.paleBlue,
    accent: colors.teal,
  },
  {
    title: "Student Profile",
    icon: "person-circle-outline",
    tab: "Student Profile",
    tint: "#EAF0FB",
    accent: "#5274B8",
  },
  {
    title: "Exams & Results",
    icon: "ribbon-outline",
    tab: "Exams",
    tint: "#FFF1DF",
    accent: "#D9822B",
  },
  {
    title: "Transport",
    icon: "bus-outline",
    tab: "Transport",
    tint: "#FDECEC",
    accent: "#C65353",
  },
  {
    title: "Messaging / Notifications",
    icon: "megaphone-outline",
    tab: "Messaging / Notifications",
    tint: "#F2ECFB",
    accent: "#7A5AA6",
  },
  {
    title: "Events",
    icon: "school-outline",
    tab: "Events",
    tint: "#EAF5FB",
    accent: "#3284A8",
  },
  {
    title: "Leave",
    icon: "create-outline",
    tab: "Leave",
    tint: "#FFF6D9",
    accent: "#B8861B",
  },
  {
    title: "Documents",
    icon: "document-text-outline",
    tab: "Documents",
    tint: "#F0EDF8",
    accent: "#6C63A8",
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning, Parent";
  if (hour < 17) return "Good Afternoon, Parent";
  return "Good Evening, Parent";
}

function DashboardCard({
  icon,
  label,
  value,
  detail,
  tint,
  iconColor,
  cardWidth,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        dashboardStyles.summaryCard,
        { width: cardWidth, borderLeftColor: iconColor },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          dashboardStyles.summaryIcon,
          { backgroundColor: tint, borderColor: `${iconColor}30` },
        ]}
      >
        <Icon name={icon} color={iconColor} />
      </View>
      <Text style={dashboardStyles.summaryLabel}>{label}</Text>
      <Text style={dashboardStyles.summaryValue}>{value}</Text>
      <Text style={dashboardStyles.summaryDetail}>{detail}</Text>
    </Pressable>
  );
}

function ModuleCard({ module, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        dashboardStyles.moduleCard,
        {
          backgroundColor: module.tint,
          borderColor: module.accent,
          borderLeftColor: module.accent,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={dashboardStyles.moduleIcon}>
        <Icon name={module.icon} size={21} color={module.accent} />
      </View>
      <Text style={dashboardStyles.moduleTitle}>{module.title}</Text>
      <Icon name="arrow-forward" size={15} color={module.accent} />
    </Pressable>
  );
}

function QuickAction({ icon, label, tint, accent, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        dashboardStyles.quickAction,
        { backgroundColor: tint },
        pressed && styles.pressed,
      ]}
    >
      <View style={[dashboardStyles.quickActionIcon, { backgroundColor: accent }]}>
        <Icon name={icon} size={18} color={colors.white} />
      </View>
      <Text style={dashboardStyles.quickActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MoreModules({ goTo }) {
  return (
    <View style={dashboardStyles.moreModules}>
      {additionalModules.map((module) => (
        <ModuleCard
          key={module.title}
          module={module}
          onPress={() => goTo(module.tab)}
        />
      ))}
    </View>
  );
}

const getStudentPhotoSource = (student) => {
  const candidate = student?.profile_image_url !== undefined
    ? student.profile_image_url
    : student?.photo ||
      student?.photoUrl ||
      student?.photo_url ||
      student?.profile_photo ||
      student?.profilePhoto ||
      student?.profile_image ||
      student?.profileImage ||
      student?.image_url ||
      student?.imageUrl ||
      student?.avatar_url ||
      student?.avatarUrl ||
      "";

  if (!candidate || typeof candidate !== "string") return null;

  const value = candidate.trim();
  if (!value) return null;
  if (/^file:\/\//i.test(value)) return { uri: value };

  try {
    const imageUrl = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(resolveApiUrl(value));
    if (!["http:", "https:"].includes(imageUrl.protocol)) return null;
    return { uri: imageUrl.toString() };
  } catch {
    return null;
  }
};

function ProfileAvatar({ student }) {
  const photoSource = getStudentPhotoSource(student);
  const [loadedUri, setLoadedUri] = useState("");
  const [failedUri, setFailedUri] = useState("");
  const photoAvailable = photoSource && failedUri !== photoSource.uri;

  return (
    <View style={dashboardStyles.profileAvatar}>
      {photoAvailable ? (
        <>
          {loadedUri !== photoSource.uri ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : null}
          <Image
            source={photoSource}
            style={[
              dashboardStyles.profileAvatarImage,
              { opacity: loadedUri === photoSource.uri ? 1 : 0 },
            ]}
            onLoad={() => setLoadedUri(photoSource.uri)}
            onError={() => setFailedUri(photoSource.uri)}
            accessibilityLabel={`${student?.name || "Student"} profile photo`}
          />
        </>
      ) : (
        <Text style={dashboardStyles.profileAvatarText}>
          {(student?.name || "S").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function StudentCard({ student, selected, onPress }) {
  const studentPhotoSource = getStudentPhotoSource(student);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${student.name}, ${student.className}${student.section ? `, section ${student.section}` : ""}${selected ? ", selected" : ""}`}
      onPress={onPress}
      style={[
        dashboardStyles.studentCard,
        selected && dashboardStyles.studentCardSelected,
      ]}
    >
      <View style={dashboardStyles.studentAvatar}>
        {studentPhotoSource ? (
          <Image
            source={studentPhotoSource}
            style={dashboardStyles.studentAvatarImage}
          />
        ) : (
          <Text style={dashboardStyles.studentAvatarText}>{student.initial}</Text>
        )}
      </View>
      <View style={dashboardStyles.studentCardCopy}>
        <Text style={dashboardStyles.studentCardName}>{student.name}</Text>
        <Text style={dashboardStyles.studentCardClass}>
          {student.className}
          {student.section ? ` - Section ${student.section}` : ""}
        </Text>
      </View>
      {selected ? (
        <Icon name="checkmark-circle" size={22} color={colors.blue} />
      ) : null}
    </Pressable>
  );
}

function HomeContent({
  session,
  goTo,
  dashboard,
  selectedStudent,
  students,
  onSelectStudent,
  onRefresh,
  onAnnouncementRead,
  onEditProfile,
  onChangePhoto,
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const summaryCardWidth = viewportWidth >= 900 ? "23.5%" : "48.5%";
  const attendanceValue = Number.isFinite(Number(dashboard.attendancePercentage))
    ? Math.round(Number(dashboard.attendancePercentage))
    : 0;
  const selectedWard = selectedStudent || students[0] || null;
  const wardName = selectedWard?.name || "Student";
  const wardClass =
    selectedWard?.className ||
    selectedWard?.class_name ||
    selectedWard?.class ||
    "N/A";
  const wardSection =
    selectedWard?.section ||
    selectedWard?.division_name ||
    selectedWard?.division ||
    "N/A";
  const profileFields = [
    {
      label: "Admission Number",
      value:
        selectedWard?.admission_number ||
        selectedWard?.admissionNumber ||
        selectedWard?.admission_no ||
        "N/A",
    },
    {
      label: "Roll Number",
      value:
        selectedWard?.roll_number ||
        selectedWard?.rollNo ||
        selectedWard?.roll_number_value ||
        "N/A",
    },
    { label: "Class", value: wardClass },
    { label: "Section", value: wardSection },
    { label: "Gender", value: selectedWard?.gender || "N/A" },
    {
      label: "Blood Group",
      value:
        selectedWard?.blood_group ||
        selectedWard?.bloodGroup ||
        selectedWard?.blood_group_name ||
        "N/A",
    },
    {
      label: "Date of Birth",
      value:
        selectedWard?.dob ||
        selectedWard?.date_of_birth ||
        selectedWard?.dateOfBirth ||
        "N/A",
    },
    {
      label: "Bus Route",
      value:
        selectedWard?.bus_route ||
        selectedWard?.busRoute ||
        selectedWard?.transport_route ||
        "N/A",
    },
  ];

  return (
    <View style={dashboardStyles.container}>
      <View style={dashboardStyles.welcomeBanner}>
        <View style={dashboardStyles.welcomeCopy}>
          <Text style={dashboardStyles.welcomeEyebrow}>IDPS Madanapalle · PARENT PORTAL</Text>
          <Text style={dashboardStyles.welcomeTitle}>{getGreeting()}</Text>
          <Text style={dashboardStyles.welcomeSubtitle}>
            Stay connected with your child&apos;s learning journey.
          </Text>
        </View>
        <Image
          source={require("../../assets/Dpslogo.jpeg")}
          resizeMode="contain"
          style={dashboardStyles.welcomeLogo}
          accessibilityLabel="DPS logo"
        />
      </View>

      {students.length === 0 ? (
        <View style={dashboardStyles.emptyState}>
          {dashboard.loading ? (
            <>
              <ActivityIndicator color={colors.blue} />
              <Text style={dashboardStyles.stateText}>Loading your wards...</Text>
            </>
          ) : dashboard.error ? (
            <>
              <Text style={dashboardStyles.emptyTitle}>Unable to load wards</Text>
              <Text style={dashboardStyles.stateText}>{dashboard.error}</Text>
              <Pressable style={dashboardStyles.retryButton} onPress={onRefresh}>
                <Text style={dashboardStyles.retryButtonText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Icon name="people-outline" size={28} color={colors.blue} />
              <Text style={dashboardStyles.emptyTitle}>No children linked</Text>
              <Text style={dashboardStyles.stateText}>
                No student profiles are linked to this parent account yet.
              </Text>
              <Pressable style={dashboardStyles.retryButton} onPress={onRefresh}>
                <Text style={dashboardStyles.retryButtonText}>Refresh</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <>
          <View style={dashboardStyles.quickHeading}>
            <View style={dashboardStyles.quickHeadingTitle}>
              <Icon name="flash" size={17} color={colors.blue} />
              <Text style={dashboardStyles.sectionHeading}>Quick actions</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => goTo("More")}
              style={dashboardStyles.viewAllButton}
            >
              <Text style={dashboardStyles.viewAllText}>View all</Text>
              <Icon name="chevron-forward" size={13} color={colors.blue} />
            </Pressable>
          </View>
          <View style={dashboardStyles.quickActions}>
            <QuickAction
              icon="calendar-outline"
              label="Attendance"
              tint="#E9F1FF"
              accent="#4388ED"
              onPress={() => goTo("Attendance")}
            />
            <QuickAction
              icon="book-outline"
              label="Homework"
              tint="#E7F8EF"
              accent="#23A66D"
              onPress={() => goTo("Homework")}
            />
            <QuickAction
              icon="ribbon-outline"
              label="Exams"
              tint="#FFF3DE"
              accent="#ED9B1D"
              onPress={() => goTo("Exams")}
            />
            <QuickAction
              icon="person-outline"
              label="Profile"
              tint="#FDECEF"
              accent="#E95C72"
              onPress={onEditProfile}
            />
            <QuickAction
              icon="grid-outline"
              label="More"
              tint="#E8F5FF"
              accent="#248FE0"
              onPress={() => goTo("More")}
            />
          </View>

          <View style={dashboardStyles.importantNotice}>
            <View style={dashboardStyles.noticeIcon}>
              <Icon name="megaphone-outline" size={19} color="#C47A00" />
            </View>
            <View style={dashboardStyles.importantNoticeCopy}>
              <Text style={dashboardStyles.importantNoticeTitle} numberOfLines={1}>
                {dashboard.announcements[0]?.title || "Important notice"}
              </Text>
              <Text style={dashboardStyles.importantNoticeText} numberOfLines={2}>
                {dashboard.announcements[0]?.message || "School notices and updates will appear here."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all school notices"
              onPress={() => {
                if (dashboard.announcements[0]?.id) {
                  onAnnouncementRead?.(dashboard.announcements[0].id, true);
                }
                goTo("Messaging / Notifications");
              }}
              style={dashboardStyles.noticeAction}
            >
              <Text style={dashboardStyles.noticeActionText}>View</Text>
              <Icon name="chevron-forward" size={13} color={colors.blue} />
            </Pressable>
          </View>

          <View style={dashboardStyles.studentsHeading}>
            <Text style={dashboardStyles.studentsLabel}>SELECT A CHILD</Text>
            <Text style={dashboardStyles.studentsCount}>{students.length} linked</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dashboardStyles.studentList}
          >
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                selected={student.id === selectedWard?.id}
                onPress={() => onSelectStudent(student.id)}
              />
            ))}
          </ScrollView>

          <View style={dashboardStyles.summaryBanner}>
            <ProfileAvatar student={selectedWard} />
            <View style={dashboardStyles.summaryBannerCopy}>
              <Text style={dashboardStyles.summaryBannerLabel}>CURRENT CHILD</Text>
              <Text style={dashboardStyles.summaryBannerTitle} numberOfLines={1}>
                {wardName}
              </Text>
              <Text style={dashboardStyles.summaryBannerMeta} numberOfLines={1}>
                {wardClass} · Section {wardSection}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${wardName}'s profile`}
              style={dashboardStyles.editProfileButton}
              onPress={onEditProfile}
            >
              <Icon name="create-outline" size={17} color={colors.blue} />
              <Text style={dashboardStyles.editProfileText}>Edit</Text>
            </Pressable>
          </View>

          {dashboard.loading ? (
            <View style={dashboardStyles.state}>
              <ActivityIndicator color={colors.blue} />
              <Text style={dashboardStyles.stateText}>Updating ward overview...</Text>
            </View>
          ) : (
            <>
              {dashboard.error ? (
            <View style={dashboardStyles.error}>
              <Text style={dashboardStyles.errorText}>{dashboard.error}</Text>
              <Pressable onPress={onRefresh}>
                <Text style={dashboardStyles.retry}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={dashboardStyles.overviewHeading}>
            <View>
              <Text style={dashboardStyles.sectionHeading}>Student overview</Text>
              <Text style={dashboardStyles.overviewSubtitle}>
                {wardName} · Class {wardClass}
              </Text>
            </View>
            <Text style={dashboardStyles.sessionPill}>
              {session?.academicYear || "Academic year"}
            </Text>
          </View>
          <View style={dashboardStyles.summaryGrid}>
            <DashboardCard
              icon="calendar-outline"
              label="Attendance Rate"
              value={`${attendanceValue}%`}
              detail={`${dashboard.daysPresent || 0} Present / ${dashboard.daysAbsent || 0} Absent`}
              tint="#EAF5FB"
              iconColor="#3284A8"
              cardWidth={summaryCardWidth}
              onPress={() => goTo("Attendance")}
            />
            <DashboardCard
              icon="wallet-outline"
              label="Fee Balance"
              value={dashboard.fees}
              detail="Outstanding"
              tint="#F3E8FF"
              iconColor="#7A5AA6"
              cardWidth={summaryCardWidth}
              onPress={() => goTo("Fees")}
            />
            <DashboardCard
              icon="ribbon-outline"
              label="Published Exams"
              value={`${dashboard.examCount ?? 0}`}
              detail="Exams"
              tint="#FFF1DF"
              iconColor="#D9822B"
              cardWidth={summaryCardWidth}
              onPress={() => goTo("Exams")}
            />
            <DashboardCard
              icon="megaphone-outline"
              label="Active Notices"
              value={`${dashboard.noticeCount ?? dashboard.announcements.length ?? 0}`}
              detail="Updates"
              tint="#EAF5FB"
              iconColor="#1D7A8C"
              cardWidth={summaryCardWidth}
              onPress={() => goTo("Messaging / Notifications")}
            />
          </View>

          <SectionTitle
            title="Child details"
            action="Change photo"
            onAction={onChangePhoto}
          />
          <View style={dashboardStyles.profileCard}>
            <View style={dashboardStyles.profileGrid}>
              {profileFields.map((field) => (
                <View key={field.label} style={dashboardStyles.profileField}>
                  <Text style={dashboardStyles.profileFieldLabel}>{field.label}</Text>
                  <Text style={dashboardStyles.profileFieldValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <SectionTitle title="Academic Attendance Progress" />
          <View style={dashboardStyles.progressCard}>
            <View style={dashboardStyles.progressHeader}>
                <Text style={dashboardStyles.progressTitle}>
                  Attendance this year
              </Text>
              <Text style={dashboardStyles.progressHint}>
                {dashboard.daysPresent || 0} present • {dashboard.daysAbsent || 0} absent • {dashboard.lateEntries || 0} late
              </Text>
            </View>
            <View style={dashboardStyles.progressTrack}>
              <View
                style={[
                  dashboardStyles.progressFill,
                  { width: `${Math.min(Math.max(attendanceValue, 0), 100)}%` },
                ]}
              />
            </View>
            <View style={dashboardStyles.progressStats}>
              <Text style={dashboardStyles.progressStatItem}>Days Present: {dashboard.daysPresent || 0}</Text>
              <Text style={dashboardStyles.progressStatItem}>Days Absent: {dashboard.daysAbsent || 0}</Text>
              <Text style={dashboardStyles.progressStatItem}>Late Arrivals: {dashboard.lateEntries || 0}</Text>
            </View>
          </View>

          <SectionTitle title="Parent Modules" />
          <View style={dashboardStyles.moduleGrid}>
            {additionalModules.map((module) => (
              <ModuleCard
                key={module.title}
                module={module}
                onPress={() => goTo(module.tab)}
              />
            ))}
          </View>

          <SectionTitle title="School Notices & Feed" action={`${dashboard.noticeCount ?? dashboard.announcements.length ?? 0} Updates`} />
          <View style={dashboardStyles.listCard}>
            {dashboard.announcements.length ? (
              dashboard.announcements.slice(0, 6).map((announcement) => (
                <Pressable
                  key={announcement.id || announcement.title}
                  style={dashboardStyles.notificationRow}
                  onPress={() => {
                    onAnnouncementRead?.(announcement.id, true);
                    goTo("Messaging / Notifications");
                  }}
                >
                  <View style={dashboardStyles.notificationTag}>
                    <Text style={dashboardStyles.notificationTagText}>
                      {announcement.type || announcement.category || "General"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dashboardStyles.notificationTitle}>
                      {announcement.title}
                    </Text>
                    <Text style={dashboardStyles.notificationMeta}>
                      {announcement.date ? new Date(announcement.date).toLocaleDateString("en-GB") : "Recent"}
                    </Text>
                    <Text style={dashboardStyles.notificationMessage} numberOfLines={2}>
                      {announcement.message || "No summary available."}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={dashboardStyles.emptyText}>No notices available</Text>
            )}
          </View>
          </>
        )}
        </>
      )}
    </View>
  );
}

function DetailContent({
  section,
  goTo,
  session,
  onSessionExpired,
  selectedStudentId,
  selectedStudent,
  onAnnouncementsLoaded,
  onAnnouncementRead,
}) {
  if (section === "More")
    return (
      <View style={dashboardStyles.moreScreen}>
        <Text style={dashboardStyles.sectionHeading}>More services</Text>
        <Text style={dashboardStyles.overviewSubtitle}>
          School services for {selectedStudent?.name || "your child"}
        </Text>
        <MoreModules goTo={goTo} />
      </View>
    );
  if (section === "Attendance")
    return (
      <ParentAttendanceScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Fees")
    return (
      <ParentFeesScreen
        session={session}
        selectedStudentId={selectedStudentId}
        selectedStudent={selectedStudent}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Homework")
    return (
      <ParentHomeworkScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Exams")
    return (
      <ParentExamsScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Timetable")
    return (
      <ParentTimetableScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Messaging / Notifications")
    return (
      <ParentAnnouncementsScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
        onAnnouncementsLoaded={onAnnouncementsLoaded}
        onAnnouncementRead={onAnnouncementRead}
      />
    );
  if (section === "Events")
    return (
      <ParentAnnouncementsScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
        title="Events"
        eventOnly
      />
    );
  if (section === "Leave")
    return (
      <ParentLeaveScreen
        session={session}
        selectedStudentId={selectedStudentId}
        selectedStudent={selectedStudent}
        onSessionExpired={onSessionExpired}
      />
    );
  if (section === "Transport")
    return (
      <ParentTransportScreen
        session={session}
        selectedStudentId={selectedStudentId}
        onSessionExpired={onSessionExpired}
      />
    );
  if (["Student Profile", "Documents"].includes(section))
    return (
      <ParentAdditionalModuleScreen
        title={section}
        selectedStudent={selectedStudent}
      />
    );
  return <NoticesContent />;
}

function NoticesContent() {
  return (
    <>
      <View style={styles.filterRow}>
        <Text style={styles.subtle}>No notifications available</Text>
        <View style={styles.filterChip}>
          <Text style={styles.filterText}>
            All notices{" "}
            <Icon name="chevron-down" size={13} color={colors.blue} />
          </Text>
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.subtle}>
          Open Messaging / Notifications to view announcements.
        </Text>
      </View>
    </>
  );
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const getProfileValue = (profile, ...keys) => {
  for (const key of keys) {
    if (profile?.[key] !== undefined && profile?.[key] !== null) {
      return String(profile[key]);
    }
  }
  return "";
};

const profileFormFromStudent = (student) => ({
  mobile_number: getProfileValue(student, "mobile_number", "mobile"),
  email: getProfileValue(student, "email"),
  blood_group: getProfileValue(student, "blood_group", "bloodGroup"),
  mother_tongue: getProfileValue(student, "mother_tongue", "motherTongue"),
  street_address: getProfileValue(
    student,
    "street_address",
    "streetAddress",
    "address",
  ),
  city: getProfileValue(student, "city"),
  pincode: getProfileValue(student, "pincode", "pin_code", "postal_code"),
  state: getProfileValue(student, "state"),
  religion: getProfileValue(student, "religion"),
});

function ProfileModal({ visible, onClose, onSaved, onOpenChangePhoto, session, selectedStudent }) {
  const [form, setForm] = useState(() =>
    profileFormFromStudent(selectedStudent),
  );
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [bloodGroupOpen, setBloodGroupOpen] = useState(false);
  const studentPhotoSource = getStudentPhotoSource(selectedStudent);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    const loadProfile = async () => {
      setForm(profileFormFromStudent(selectedStudent));
      setError("");
      setFieldErrors({});
      if (!selectedStudent?.id) return;
      setLoadingProfile(true);
      try {
        const profile = await parentApi.getChildProfile(
          selectedStudent.id,
          session,
        );
        if (active && profile) {
          setForm(profileFormFromStudent({ ...selectedStudent, ...profile }));
        }
      } catch (requestError) {
        if (active && requestError?.status !== 404) {
          setError(requestError?.message || "Unable to load ward profile.");
        }
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [visible, selectedStudent, session]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!/^\d{10}$/.test(form.mobile_number)) {
      nextErrors.mobile_number = "Enter a valid 10-digit mobile number.";
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!BLOOD_GROUPS.includes(form.blood_group)) {
      nextErrors.blood_group = "Select a blood group.";
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      nextErrors.pincode = "Enter a valid 6-digit pincode.";
    }
    ["mother_tongue", "street_address", "city", "state", "religion"].forEach(
      (field) => {
        if (!form[field].trim()) nextErrors[field] = "This field is required.";
      },
    );
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveProfile = async () => {
    if (saving || !validate()) return;
    setError("");
    setSaving(true);
    try {
      const updatedProfile = await parentApi.updateChildProfile(
        selectedStudent?.id,
        form,
        session,
      );
      onSaved({ ...selectedStudent, ...form, ...(updatedProfile || {}) });
      Alert.alert(
        "Profile updated successfully",
        "Ward profile changes were saved.",
        [{ text: "OK", onPress: onClose }],
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to update profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (label, name, options = {}) => (
    <View style={styles.profileField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={form[name]}
        onChangeText={(value) => {
          if (name === "mobile_number") {
            updateField(
              name,
              value
                .replace(/[^\d+]/g, "")
                .replace(/(?!^)\+/g, "")
                .slice(0, 10),
            );
          } else if (name === "pincode") {
            updateField(name, value.replace(/\D/g, "").slice(0, 6));
          } else {
            updateField(name, value);
          }
        }}
        style={[styles.input, options.multiline && styles.multilineInput]}
        placeholderTextColor={colors.muted}
        keyboardType={options.keyboardType}
        autoCapitalize={options.autoCapitalize || "sentences"}
        multiline={options.multiline}
        numberOfLines={options.multiline ? 3 : 1}
      />
      {fieldErrors[name] ? (
        <Text style={styles.fieldError}>{fieldErrors[name]}</Text>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.profileModal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.profileModalTitle}>
              Update Ward Profile: {selectedStudent?.name || "Ward"}
            </Text>
            <Pressable onPress={onClose}>
              <Icon name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photoUploadSection}>
              <View style={styles.photoUploadPreview}>
                {studentPhotoSource ? (
                  <Image
                    source={studentPhotoSource}
                    style={styles.photoUploadImage}
                  />
                ) : (
                  <Text style={styles.photoUploadFallback}>
                    {(selectedStudent?.name || "S").charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Pressable
                style={styles.photoUploadButton}
                onPress={() => {
                  onClose();
                  if (onOpenChangePhoto) onOpenChangePhoto();
                }}
              >
                <Text style={styles.photoUploadButtonText}>Change Photo</Text>
              </Pressable>
            </View>
            {loadingProfile ? (
              <Text style={styles.loadingText}>
                Loading existing profile...
              </Text>
            ) : null}
            {field("Mobile Number", "mobile_number", {
              keyboardType: "phone-pad",
            })}
            {field("Email Address", "email", {
              keyboardType: "email-address",
              autoCapitalize: "none",
            })}
            <View style={styles.profileField}>
              <Text style={styles.inputLabel}>Blood Group</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setBloodGroupOpen(true)}
              >
                <Text
                  style={
                    form.blood_group
                      ? styles.selectText
                      : styles.placeholderText
                  }
                >
                  {form.blood_group || "Select blood group"}
                </Text>
                <Icon name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
              {fieldErrors.blood_group ? (
                <Text style={styles.fieldError}>{fieldErrors.blood_group}</Text>
              ) : null}
            </View>
            {field("Mother Tongue", "mother_tongue")}
            {field("Street Address", "street_address", { multiline: true })}
            {field("City", "city")}
            {field("Pincode", "pincode", { keyboardType: "numeric" })}
            {field("State", "state")}
            {field("Religion", "religion")}
            {error ? <Text style={styles.formError}>{error}</Text> : null}
            <View style={styles.profileButtonRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, saving && styles.disabledButton]}
                onPress={saveProfile}
                disabled={saving || loadingProfile}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
          <Modal
            visible={bloodGroupOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setBloodGroupOpen(false)}
          >
            <Pressable
              style={styles.dropdownBackdrop}
              onPress={() => setBloodGroupOpen(false)}
            >
              <View style={styles.dropdownCard}>
                {BLOOD_GROUPS.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => {
                      updateField("blood_group", option);
                      setBloodGroupOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function ParentPortalScreen({ onLogout, session }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Home");
  const dashboardRequestIdRef = useRef(0);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [dashboard, setDashboard] = useState({
    loading: true,
    error: "",
    attendance: "0%",
    attendancePercentage: 0,
    daysPresent: 0,
    daysAbsent: 0,
    lateEntries: 0,
    fees: "₹0",
    feeBalance: 0,
    homeworkDetail: "No data available",
    classes: [],
    announcements: [],
    unreadAnnouncementCount: 0,
    noticeCount: 0,
    examCount: 0,
    schoolName: session?.schoolName || "",
    studentCount: students.length,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePhotoOpen, setChangePhotoOpen] = useState(false);
  const [changePhotoKey, setChangePhotoKey] = useState(0);
  const [photoSuccessMessage, setPhotoSuccessMessage] = useState("");
  const isHome = activeTab === "Home";
  const syncAnnouncements = useCallback((announcements) => {
    setDashboard((current) => ({
      ...current,
      announcements,
      noticeCount: announcements.length,
      unreadAnnouncementCount: announcementsApi.getUnreadCount(announcements),
    }));
  }, []);
  const updateAnnouncementReadState = useCallback((announcementId, isRead) => {
    if (!announcementId) return;
    setDashboard((current) => {
      const nextAnnouncements = current.announcements.map((announcement) =>
        String(announcement.id) === String(announcementId)
          ? { ...announcement, is_read: isRead }
          : announcement,
      );
      return {
        ...current,
        announcements: nextAnnouncements,
        noticeCount: nextAnnouncements.length,
        unreadAnnouncementCount: announcementsApi.getUnreadCount(nextAnnouncements),
      };
    });
  }, []);
  const handleLogout = () => {
    if (Platform.OS === "web") {
      onLogout();
      return;
    }

    Alert.alert("Signed out", "Your session has ended.", [
      { text: "OK", onPress: onLogout },
    ]);
  };

  const loadDashboard = useCallback(async () => {
    const requestId = ++dashboardRequestIdRef.current;
    setDashboard((current) => ({ ...current, loading: true, error: "" }));
    try {
      const children = await parentApi.getChildren(session);
      const nextStudents = children.map((student) => ({
        ...student,
        initial: (student.first_name || student.name || "?")
          .charAt(0)
          .toUpperCase(),
        name:
          [student.first_name, student.last_name].filter(Boolean).join(" ") ||
          student.name ||
          "Student",
        className: student.class_name || student.className || "",
        section: student.division_name || student.section || "",
      }));
      if (requestId !== dashboardRequestIdRef.current) return;

      setStudents(nextStudents);
      const selectedStudent = nextStudents.find(
        (student) =>
          String(student.id) === String(selectedStudentId) ||
          String(student.parentChildId) === String(selectedStudentId),
      );
      const activeStudentId = String(
        selectedStudent?.id || nextStudents[0]?.id || "",
      );
      if (!activeStudentId) {
        setDashboard((current) => ({
          ...current,
          loading: false,
          studentCount: 0,
          attendance: "0%",
          attendancePercentage: 0,
          daysPresent: 0,
          daysAbsent: 0,
          lateEntries: 0,
          fees: "₹0",
          feeBalance: 0,
          examCount: 0,
          noticeCount: 0,
          announcements: [],
          unreadAnnouncementCount: 0,
          error: "",
        }));
        return;
      }
      if (String(activeStudentId) !== String(selectedStudentId)) {
        setSelectedStudentId(activeStudentId);
      }

      const results = await Promise.allSettled([
        feesApi.getSummary(session, activeStudentId),
        attendanceApi.getSummary(
          new Date().toISOString().slice(0, 10),
          session,
          activeStudentId,
        ),
        homeworkApi.getAssignments(session, activeStudentId),
        examsApi.getResults(session, activeStudentId),
        announcementsApi.getAnnouncements(session, activeStudentId),
      ]);
      if (requestId !== dashboardRequestIdRef.current) return;

      const [
        feesResult,
        attendanceResult,
        homeworkResult,
        examsResult,
        announcementsResult,
      ] = results;
      const failedServices = results
        .map((result, index) =>
          result.status === "rejected"
            ? `${["fees", "attendance", "homework", "exams", "announcements"][index]}: ${result.reason?.message || "request failed"}`
            : null,
        )
        .filter(Boolean);
      const fees = feesResult.status === "fulfilled" ? feesResult.value : null;
      const attendance =
        attendanceResult.status === "fulfilled" ? attendanceResult.value : null;
      const homework =
        homeworkResult.status === "fulfilled" ? homeworkResult.value : [];
      const exams = examsResult.status === "fulfilled" ? examsResult.value : [];
      const announcements =
        announcementsResult.status === "fulfilled"
          ? announcementsResult.value
          : [];
      setDashboard({
        loading: false,
        attendance: `${attendance?.attendanceRate ?? 0}%`,
        attendancePercentage: Number(attendance?.attendanceRate ?? 0),
        daysPresent: attendance?.daysPresent ?? 0,
        daysAbsent: attendance?.daysAbsent ?? 0,
        lateEntries: attendance?.lateEntries ?? 0,
        fees: `₹${Number(fees?.institutionalDues || 0).toLocaleString("en-IN")}`,
        feeBalance: Number(fees?.institutionalDues || 0),
        homeworkDetail: homework?.length
          ? `${homework.length} available`
          : "No data available",
        classes: [],
        announcements,
        noticeCount: announcements.length,
        unreadAnnouncementCount: announcementsApi.getUnreadCount(announcements),
        schoolName: session?.schoolName || "",
        studentCount: nextStudents.length,
        examCount: Array.isArray(exams) ? exams.length : 0,
        error: failedServices.length
          ? `Some services are unavailable: ${failedServices.join(", ")}.`
          : "",
      });
    } catch (error) {
      if (requestId !== dashboardRequestIdRef.current) return;
      setDashboard((current) => ({
        ...current,
        loading: false,
        error:
          error?.message || "Unable to load dashboard data. Please try again.",
      }));
    }
  }, [session, selectedStudentId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const selectedStudent = students.find(
    (student) => String(student.id) === String(selectedStudentId),
  ) ||
    students[0] || {
      id: "",
      initial: "?",
      name: "Student",
      className: "",
    };
  const selectedStudentIdForProfile = selectedStudent?.id;
  const selectedStudentPhotoUri = getStudentPhotoSource(selectedStudent)?.uri;
  const updateSelectedStudent = useCallback((updatedStudent) => {
    setStudents((current) =>
      current.map((student) =>
        String(student.id) === String(updatedStudent?.id)
          ? { ...student, ...updatedStudent }
          : student,
      ),
    );
  }, []);
  useEffect(() => {
    const childId = selectedStudentIdForProfile;
    if (!childId || selectedStudentPhotoUri) return undefined;

    let active = true;
    parentApi
      .getChildProfile(childId, session)
      .then((profile) => {
        if (!active) return;
        const imageUrl =
          typeof profile?.profile_image_url === "string"
            ? profile.profile_image_url.trim()
            : null;
        if (imageUrl) {
          updateSelectedStudent({ id: childId, profile_image_url: imageUrl });
        }
      })
      .catch((requestError) => {
        if (active && __DEV__) {
          console.warn("[Parent] child profile image request failed", {
            childId,
            kind: requestError?.kind,
            status: requestError?.status,
            message: requestError?.message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedStudentIdForProfile, selectedStudentPhotoUri, session, updateSelectedStudent]);
  const openChangePhoto = () => {
    setPhotoSuccessMessage("");
    setChangePhotoKey((current) => current + 1);
    setChangePhotoOpen(true);
  };
  const finishPhotoUpdate = () => {
    setActiveTab("Home");
    setChangePhotoOpen(false);
    setPhotoSuccessMessage("Profile photo updated successfully.");
  };
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/Dpslogo.jpeg")}
            resizeMode="contain"
            style={styles.headerLogo}
            accessibilityLabel="DPS logo"
          />
          <View style={styles.brandCopy}>
            <Text style={styles.brand} numberOfLines={1}>
              IDPS <Text style={styles.brandAccent}>Madanapalle</Text>
            </Text>
            <Text style={styles.portal} numberOfLines={1}>
              Parent portal
              {session?.academicYear ? (
                <Text style={styles.year}> · {session.academicYear}</Text>
              ) : null}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setActiveTab("Messaging / Notifications")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerAction}
          >
            <View style={styles.headerIconContainer}>
              <Icon name="notifications-outline" size={19} color={colors.blue} />
              {dashboard.announcements.length ? (
                <Text pointerEvents="none" style={styles.unreadBadge}>
                  {dashboard.unreadAnnouncementCount}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Parent profile"
            onPress={() => setProfileOpen(true)}
            style={styles.parentIdentity}
          >
            <View style={styles.parentAvatar}>
              <Text style={styles.parentAvatarText}>
                {(session?.name || "P").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.parentName} numberOfLines={1}>
              {session?.name || "Parent"}
            </Text>
            <Icon name="chevron-down" size={13} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Logout"
            onPress={handleLogout}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.logout}
          >
            <Icon name="log-out-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isHome && dashboard.loading}
            onRefresh={loadDashboard}
            tintColor={colors.blue}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isHome && photoSuccessMessage ? (
          <View style={styles.photoSuccessBanner}>
            <Icon name="checkmark-circle" size={18} color={colors.teal} />
            <Text style={styles.photoSuccessText}>{photoSuccessMessage}</Text>
          </View>
        ) : null}
        {isHome ? (
          <HomeContent
            session={session}
            goTo={setActiveTab}
            dashboard={dashboard}
            selectedStudent={selectedStudent}
            students={students}
            onSelectStudent={setSelectedStudentId}
            onRefresh={loadDashboard}
            onAnnouncementRead={updateAnnouncementReadState}
            onEditProfile={() => setProfileOpen(true)}
            onChangePhoto={openChangePhoto}
          />
        ) : (
          <>
            <View style={styles.pageHeading}>
              <Pressable onPress={() => setActiveTab("Home")}>
                <Icon name="arrow-back" color={colors.ink} size={23} />
              </Pressable>
              <View>
                <Text style={styles.pageTitle}>{activeTab}</Text>
                <Text style={styles.pageContext} numberOfLines={1}>
                  {selectedStudent?.name || "Selected child"}
                  {selectedStudent?.className
                    ? ` · Class ${selectedStudent.className}`
                    : ""}
                  {selectedStudent?.section
                    ? ` · Section ${selectedStudent.section}`
                    : ""}
                </Text>
              </View>
            </View>
            <DetailContent
              section={activeTab}
              goTo={setActiveTab}
              session={session}
              selectedStudentId={selectedStudentId}
              selectedStudent={selectedStudent}
              onSessionExpired={onLogout}
              onAnnouncementsLoaded={syncAnnouncements}
              onAnnouncementRead={updateAnnouncementReadState}
            />
          </>
        )}
      </ScrollView>
      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {navItems.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === item.label }}
            onPress={() => setActiveTab(item.label)}
            style={styles.navItem}
          >
            <Icon
              name={item.icon}
              size={21}
              color={activeTab === item.label ? colors.blue : colors.muted}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === item.label && styles.navLabelActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setProfileOpen(true)}
          style={styles.navItem}
        >
          <Icon name="person-outline" size={21} color={colors.muted} />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenChangePhoto={() => {
          setProfileOpen(false);
          openChangePhoto();
        }}
        session={session}
        selectedStudent={selectedStudent}
        onSaved={updateSelectedStudent}
        onSuccess={finishPhotoUpdate}
      />
      <ChangePhotoScreen
        key={changePhotoKey}
        visible={changePhotoOpen}
        onClose={() => setChangePhotoOpen(false)}
        session={session}
        selectedStudent={selectedStudent}
        onSaved={updateSelectedStudent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  header: {
    minHeight: 62,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 5,
  },
  headerLogo: { width: 38, height: 38, flexShrink: 0 },
  brandCopy: { flex: 1, minWidth: 0 },
  brand: {
    color: colors.blue,
    fontSize: 14,
    letterSpacing: 0,
    fontWeight: "900",
  },
  brandAccent: { color: colors.teal },
  portal: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 1 },
  year: { color: colors.blue, fontSize: 9, fontWeight: "700" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    gap: 2,
  },
  headerAction: {
    width: 36,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconContainer: {
    position: "relative",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -8,
    right: -12,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.red,
    color: colors.white,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 15,
    overflow: "hidden",
    pointerEvents: "none",
  },
  parentIdentity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 4,
    gap: 4,
  },
  parentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  parentAvatarText: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  parentName: { color: colors.ink, maxWidth: 54, fontSize: 9, fontWeight: "800" },
  logout: {
    width: 34,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 14, paddingBottom: 20 },
  photoSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.paleTeal,
  },
  photoSuccessText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  greeting: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 5,
  },
  subtle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCEBFB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.blue, fontSize: 19, fontWeight: "800" },
  studentBanner: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  studentInitial: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#2E5D91",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  studentInitialText: { color: colors.white, fontWeight: "800", fontSize: 17 },
  studentName: { color: colors.white, fontSize: 16, fontWeight: "800" },
  studentMeta: { color: "#B8D0EC", fontSize: 11, marginTop: 3 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    width: "48%",
    minHeight: 145,
  },
  pressed: { opacity: 0.7 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  statValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 5,
  },
  statDetail: { color: colors.muted, fontSize: 10, marginTop: 4 },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 3,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  seeAll: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  panel: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 15,
    marginBottom: 22,
  },
  noticeRow: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 11,
  },
  noticeDot: { width: 8, height: 8, borderRadius: 4 },
  noticeMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  noticeType: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  noticeDate: { color: colors.muted, fontSize: 10 },
  noticeTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  scheduleTime: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "800",
    width: 42,
  },
  scheduleLine: { height: 28, width: 2, backgroundColor: "#BFD8F5" },
  scheduleSubject: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  scheduleRoom: { color: colors.muted, fontSize: 11, marginTop: 3 },
  bottomNav: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 9,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  navItem: { alignItems: "center", width: "12.5%", minWidth: 0 },
  navLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "600",
    marginTop: 4,
  },
  navLabelActive: { color: colors.blue, fontWeight: "800" },
  pageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
  },
  pageTitle: { color: colors.ink, fontSize: 25, fontWeight: "800" },
  detailHero: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  largeIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  heroCaption: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    maxWidth: 145,
    lineHeight: 16,
  },
  heroValue: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  barBlock: { paddingVertical: 12 },
  barLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bodyText: { color: colors.ink, fontSize: 13 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDF1F5",
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },
  month: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 14,
  },
  calendar: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  day: {
    width: "12.4%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  dayText: { color: colors.muted, fontSize: 11 },
  dayPresent: { backgroundColor: colors.paleTeal },
  dayToday: { backgroundColor: colors.blue },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#C9DDF5",
    backgroundColor: colors.paleBlue,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  taskCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#AAB7C7",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: colors.teal, borderColor: colors.teal },
  taskSubject: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  taskDue: {
    color: colors.orange,
    fontSize: 11,
    marginTop: 6,
    fontWeight: "700",
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  totalRow: { borderBottomWidth: 0 },
  totalText: { fontWeight: "900", fontSize: 15 },
  primaryButton: {
    backgroundColor: colors.blue,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  primaryButtonText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  helperText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 11,
    marginBottom: 20,
  },
  examRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  examDate: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  examDay: { color: colors.blue, fontSize: 16, fontWeight: "900" },
  examMonth: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  weekDay: {
    width: "18%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  weekDayActive: { backgroundColor: colors.blue },
  weekDayName: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  weekDayNumber: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  weekDayActiveText: { color: colors.white },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(19, 19, 127, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.white,
    padding: 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  profileModalTitle: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  profileModal: {
    backgroundColor: colors.white,
    maxHeight: "92%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  formScroll: { flexGrow: 0 },
  formContent: { paddingHorizontal: 22, paddingBottom: 22 },
  profileField: { marginBottom: 5 },
  photoUploadSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  photoUploadPreview: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  photoUploadImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoUploadFallback: {
    color: colors.blue,
    fontSize: 22,
    fontWeight: "900",
  },
  photoUploadButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  photoUploadButtonText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 14,
  },
  multilineInput: { minHeight: 82, textAlignVertical: "top" },
  loadingText: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  fieldError: { color: colors.red, fontSize: 11, marginTop: 4 },
  formError: {
    color: colors.red,
    backgroundColor: colors.paleRed,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  profileButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryButtonText: { color: colors.blue, fontWeight: "800", fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  selectInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: colors.ink, fontSize: 14 },
  placeholderText: { color: colors.muted, fontSize: 14 },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(19, 19, 127, 0.35)",
    justifyContent: "center",
    padding: 24,
  },
  dropdownCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 6,
  },
  dropdownOption: { paddingHorizontal: 18, paddingVertical: 14 },
  dropdownOptionText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inputLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
  },
  disabledInput: { backgroundColor: colors.paleBlue, color: colors.muted },
});

const dashboardStyles = StyleSheet.create({
  container: { width: "100%", maxWidth: 1120, alignSelf: "center" },
  welcomeBanner: {
    minHeight: 126,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#0878E8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  welcomeCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  welcomeEyebrow: {
    color: "#D7EAFF",
    fontSize: 8,
    fontWeight: "900",
    marginBottom: 5,
  },
  welcomeTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
  },
  welcomeSubtitle: {
    color: "#E7F2FF",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
    maxWidth: 205,
  },
  welcomeLogo: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  quickHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  quickHeadingTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionHeading: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.paleBlue,
  },
  viewAllText: { color: colors.blue, fontSize: 9, fontWeight: "800" },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
    marginBottom: 12,
  },
  quickAction: {
    width: "19%",
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 7,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  quickActionLabel: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
  },
  importantNotice: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF8E5",
    borderWidth: 1,
    borderColor: "#F4DEA1",
    borderRadius: 8,
    padding: 8,
    marginBottom: 13,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#FFEDBD",
  },
  importantNoticeCopy: { flex: 1, minWidth: 0 },
  importantNoticeTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  importantNoticeText: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  noticeAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    borderRadius: 16,
    paddingHorizontal: 7,
    backgroundColor: "#E8F2FF",
  },
  noticeActionText: { color: colors.blue, fontSize: 8, fontWeight: "900" },
  overviewHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  overviewSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  sessionPill: {
    overflow: "hidden",
    color: colors.blue,
    backgroundColor: colors.paleBlue,
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 8,
    fontWeight: "800",
  },
  moreScreen: { paddingTop: 2 },
  moreModules: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  greeting: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  school: { color: colors.muted, fontSize: 12, marginTop: 6 },
  dashboardHeaderCard: {
    backgroundColor: colors.paleBlue,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.blue,
    padding: 16,
    marginBottom: 20,
  },
  dashboardTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  dashboardSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  sessionMeta: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  dashboardOs: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 7,
  },
  accountBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  accountName: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  accountCount: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "900",
  },
  studentSelector: {
    backgroundColor: colors.navy,
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 18,
  },
  studentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2E5D91",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  studentAvatarText: { color: colors.white, fontSize: 18, fontWeight: "900" },
  studentAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  studentLabel: { color: "#B8D0EC", fontSize: 10, fontWeight: "800" },
  studentName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  studentClass: { color: "#B8D0EC", fontSize: 11, marginTop: 2 },
  studentsLabel: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  studentsHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  studentsCount: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  studentList: { gap: 6, paddingBottom: 2, marginBottom: 7 },
  studentCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    minHeight: 46,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 188,
    flexShrink: 0,
  },
  studentCardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.paleBlue,
    borderWidth: 1.5,
  },
  studentCardCopy: { flex: 1 },
  studentCardName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  studentCardClass: { color: colors.muted, fontSize: 10, marginTop: 2 },
  summaryBanner: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryBannerCopy: { flex: 1, minWidth: 0 },
  summaryBannerLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
  },
  summaryBannerMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  emptyState: {
    minHeight: 220,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 9,
  },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  retryButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
    borderRadius: 6,
    backgroundColor: colors.blue,
  },
  retryButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  state: {
    minHeight: 130,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  summaryBannerTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  editProfileButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.paleBlue,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  editProfileText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  summaryCard: {
    minHeight: 78,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    padding: 8,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  summaryValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  summaryDetail: { color: colors.muted, fontSize: 8, marginTop: 2 },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    marginBottom: 9,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatarText: {
    color: colors.blue,
    fontSize: 18,
    fontWeight: "900",
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    position: "absolute",
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  profileField: {
    width: "48.8%",
    backgroundColor: "#F1F5FB",
    borderRadius: 5,
    padding: 6,
    minHeight: 42,
  },
  profileFieldLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
    marginBottom: 2,
  },
  profileFieldValue: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    marginBottom: 9,
  },
  progressHeader: {
    marginBottom: 6,
  },
  progressTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  progressHint: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E9EEF4",
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  progressStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  progressStatItem: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "700",
  },
  notificationTag: {
    backgroundColor: colors.paleBlue,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  notificationTagText: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  notificationCopy: { flex: 1 },
  notificationTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  notificationMessage: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  notificationMeta: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  moduleCard: {
    width: "48.5%",
    minHeight: 62,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 8,
  },
  moduleIcon: {
    width: 25,
    height: 25,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  moduleTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 15,
    paddingRight: 2,
  },
  listCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 18,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  classTime: { color: colors.blue, fontSize: 11, fontWeight: "900", width: 72 },
  classSubject: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  classMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  notificationDot: { width: 8, height: 8, borderRadius: 4 },
  notificationText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  stateText: { color: colors.muted, fontSize: 12 },
  error: {
    backgroundColor: "#FDECEC",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  errorText: { color: colors.red, fontSize: 11, textAlign: "center" },
  retry: { color: colors.blue, fontSize: 12, fontWeight: "900", marginTop: 8 },
  emptyText: { color: colors.muted, fontSize: 12, paddingVertical: 16 },
});
