import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { homeworkApi } from "../services/homeworkApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  orange: "#A76E00",
};

const parseAssignment = (value: string | string[] | undefined) => {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(String(value)));
  } catch {
    return null;
  }
};

export default function HomeworkSubmissionRoute() {
  const router = useRouter();
  const { assignment } = useLocalSearchParams<{ assignment?: string }>();
  const item = parseAssignment(assignment);
  const [comments, setComments] = useState(() =>
    String(
      item?.submission_text ||
        item?.submissionText ||
        item?.content ||
        item?.notes ||
        "",
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Homework not found</Text>
          <Pressable style={styles.cancel} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const submitAssignment = async () => {
    if (!item.id) {
      setError(
        "Unable to submit homework. The selected homework is missing an ID.",
      );
      return;
    }
    if (!comments.trim()) {
      setError(
        "Please enter your notes, solution summary, or remarks before submitting.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await homeworkApi.submitHomework(item.id, {
        student_id:
          item.target_student_id ?? item.student_id ?? item.studentId ?? null,
        submission_text: comments.trim(),
        attachment_url: item.attachment_url || null,
      });
      if (!result?.success) {
        setError(
          result?.error || "Unable to submit homework. Please try again.",
        );
        return;
      }
      Alert.alert(
        "Homework submitted successfully",
        "Your assignment was submitted.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      setError("Unable to submit homework. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={colors.blue} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Submit Homework</Text>
          <Text style={styles.subtitle}>Prepare an assignment submission</Text>
          <View style={styles.card}>
            <Text style={styles.subject}>{item.subject}</Text>
            <Text style={styles.topic}>{item.topic}</Text>
            <Text style={styles.label}>Submission Notes & Answers</Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              placeholder="Type your notes, solution summary, or remarks..."
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              style={styles.input}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.cancel}
                disabled={submitting}
                onPress={() => router.back()}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submit, submitting && styles.disabled]}
                disabled={submitting}
                onPress={submitAssignment}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator color={colors.white} />
                    <Text style={styles.submitText}>Submitting...</Text>
                  </>
                ) : (
                  <Text style={styles.submitText}>Submit Assignment</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 20 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 22,
  },
  backText: { color: colors.blue, fontSize: 13, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
  },
  subject: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  topic: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 8,
  },
  input: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    padding: 12,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: { color: "#B94E4E", fontSize: 11, lineHeight: 16, marginTop: 10 },
  buttonRow: { flexDirection: "row", gap: 9, marginTop: 18 },
  cancel: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  submit: {
    flex: 1.5,
    minHeight: 46,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.blue,
  },
  disabled: { opacity: 0.65 },
  submitText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  notFound: { flex: 1, padding: 20, justifyContent: "center" },
  notFoundTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
});
