import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { AppColors as colors } from "../constants/theme";
import { isApiConfigured } from "../services/api";
import { login } from "../services/authApi";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage("Enter your email address and password.");
      return;
    }

    if (!isApiConfigured) {
      setMessage("The login service is not configured.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const payload = await login(trimmedEmail, password);
      const result = payload?.data || payload;
      const user = result?.user || result?.profile || {};
      const academicYear =
        result?.academic_year_name ||
        result?.academicYear ||
        result?.academic_year ||
        user?.academic_year_name ||
        user?.academicYear ||
        user?.academic_year ||
        user?.tenant?.current_academic_year_name ||
        user?.tenant?.currentAcademicYearName ||
        "";
      const token =
        result?.token ||
        result?.access_token ||
        result?.accessToken ||
        payload?.token ||
        payload?.access_token ||
        payload?.accessToken;
      const teacherId =
        user?.id ||
        user?.teacher_id ||
        user?.teacherId ||
        user?.staff_id ||
        user?.staffId ||
        user?.employee_id ||
        user?.employeeId ||
        result?.id ||
        result?.teacher_id ||
        result?.staff_id;
      const roleValue =
        result?.role || user.role || user.user_type || user.userType;
      const role = String(roleValue || "").toLowerCase();
      const normalizedRole = role.includes("teacher")
        ? "Teacher"
        : role.includes("parent")
          ? "Parent"
          : role.includes("admin")
            ? "School Admin"
            : "";

      if (!normalizedRole) {
        setMessage("The login response did not include a valid user role.");
        return;
      }

      if (normalizedRole === "School Admin") {
        setMessage("Admin portal is not included in this demo.");
        return;
      }

      if (!token) {
        setMessage(
          "Login succeeded, but the server did not return an access token.",
        );
        return;
      }

      onLogin({
        role: normalizedRole,
        email: result?.email || user.email || trimmedEmail,
        token,
        id: teacherId,
        name: user.name || user.full_name || user.fullName,
        schoolName: user.tenant?.name || user.school?.name || user.school_name,
        academicYear: academicYear,
        academicYearId:
          result?.academic_year_id ||
          result?.academicYearId ||
          user?.academic_year_id ||
          user?.academicYearId ||
          user?.tenant?.current_academic_year_id,
      });
    } catch (error) {
      setMessage(error?.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF3FC" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.loginWrap}>
            <View style={styles.brandHeader}>
              <View style={styles.brandMark}>
                <Image
                  source={require("../../assets/Dpslogo.jpeg")}
                  resizeMode="contain"
                  style={styles.logo}
                  accessibilityLabel="DPS logo"
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>IDPS Madanapalle ERP</Text>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.brandSubtitle}>
                  Your school, all in one place.
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>Sign in</Text>
                <Text style={styles.formSubtitle}>
                  Use your parent or teacher account
                </Text>
              </View>

              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.blue} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email address"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  accessibilityLabel="Email address"
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.blue}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={colors.muted}
                  />
                </Pressable>
              </View>

              {message ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Ionicons
                    name="alert-circle-outline"
                    size={17}
                    color={colors.red}
                  />
                  <Text style={styles.error}>{message}</Text>
                </View>
              ) : null}
              <Pressable
                style={styles.forgotButton}
                onPress={() =>
                  setMessage("Password recovery is not included in this demo.")
                }
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || loading) && styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign in</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={colors.white}
                    />
                  </>
                )}
              </Pressable>
              <View style={styles.secureNote}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.green} />
                <Text style={styles.secureText}>Secure access to your school portal</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EDF3FC" },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 20 },
  loginWrap: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    gap: 12,
  },
  brandHeader: {
    minHeight: 132,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.navy,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logo: { width: 58, height: 58 },
  brandCopy: { flex: 1, minWidth: 0 },
  brandEyebrow: {
    color: "#85E0D1",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  title: { color: colors.white, fontSize: 24, fontWeight: "900", marginTop: 5 },
  brandSubtitle: { color: "#D8E6F8", fontSize: 11, marginTop: 3 },
  form: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopWidth: 3,
    borderTopColor: colors.teal,
    padding: 17,
  },
  formHeading: { marginBottom: 13 },
  formTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  formSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  label: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 5,
    marginTop: 5,
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFE",
    marginBottom: 8,
  },
  input: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 13, paddingVertical: 10 },
  button: {
    backgroundColor: colors.blue,
    minHeight: 48,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  forgotButton: { alignSelf: "flex-end", minHeight: 34, justifyContent: "center", marginTop: -1, marginBottom: 6 },
  forgotText: { color: colors.blue, fontSize: 10, fontWeight: "800" },
  pressed: { opacity: 0.75 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.paleRed,
    borderRadius: 6,
    padding: 9,
    marginTop: 2,
  },
  error: {
    flex: 1,
    color: colors.red,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
  },
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 11,
  },
  secureText: { color: colors.muted, fontSize: 9, fontWeight: "600" },
});
