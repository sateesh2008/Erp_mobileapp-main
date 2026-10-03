import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { homeworkApi } from "../../../services/homeworkApi";

export default function SharedHomeworkRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await homeworkApi.fetchPublicHomework(String(id || ""));
      if (!active) return;
      if (result.success) {
        router.replace(
          `/homework-details?assignment=${encodeURIComponent(JSON.stringify(result.data))}`,
        );
      } else {
        setError(result.error || "Public homework is unavailable.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {error ? (
          <>
            <Text style={styles.title}>{error}</Text>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Go back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color="#1E32CC" />
            <Text style={styles.message}>Loading homework...</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FF" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#17175F",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  message: { color: "#596080", fontSize: 12, marginTop: 10 },
  button: {
    backgroundColor: "#1E32CC",
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
});
