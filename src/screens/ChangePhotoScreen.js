import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AppColors as colors } from "../constants/theme";
import { resolveApiUrl } from "../services/api";
import { parentApi } from "../services/parentApi";

const getStudentPhotoSource = (student) => {
  const candidate =
    student?.photo ||
    student?.photoUrl ||
    student?.photo_url ||
    student?.profile_photo ||
    student?.profilePhoto ||
    student?.profile_photo_url ||
    student?.profilePhotoUrl ||
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
  if (/^https?:\/\//i.test(value) || /^file:\/\//i.test(value)) {
    return { uri: value };
  }

  return { uri: resolveApiUrl(value) };
};

export default function ChangePhotoScreen({
  visible,
  onClose,
  session,
  selectedStudent,
  onSaved,
  onSuccess,
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const currentPhotoSource = getStudentPhotoSource(selectedStudent);

  const openImagePicker = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      setError("Photo library permission is required to select a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    setSelectedImage(asset);
    setError("");
  };

  const uploadPhoto = async () => {
    if (uploading) return;
    if (!selectedImage?.uri) {
      Alert.alert("Please select an image first.");
      return;
    }

    if (!selectedStudent?.id) {
      Alert.alert("Unable to update photo", "No ward is selected.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const result = await parentApi.uploadChildPhoto(
        selectedStudent.id,
        selectedImage,
        session,
      );

      const uploadedUrl =
        result?.imageUrl ||
        result?.url ||
        result?.image_url ||
        result?.imageUrl ||
        result?.photo_url ||
        result?.photoUrl ||
        "";

      if (uploadedUrl) {
        onSaved({
          ...selectedStudent,
          photoUrl: uploadedUrl,
          photo_url: uploadedUrl,
          image_url: uploadedUrl,
          profile_image: uploadedUrl,
          profile_image_url: uploadedUrl,
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
      if (Platform.OS !== "web") {
        Alert.alert("Profile photo updated successfully");
      }
    } catch (requestError) {
      const message =
        requestError?.message ||
        "Unable to update profile photo. Please try again.";
      setError(message);
      Alert.alert("Unable to update profile photo", message, [{ text: "OK" }]);
    } finally {
      setUploading(false);
    }
  };

  const previewSource = selectedImage?.uri
    ? { uri: selectedImage.uri }
    : currentPhotoSource;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Change Photo</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoContainer}>
            {previewSource ? (
              <Image source={previewSource} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>
                  {(selectedStudent?.name || "S").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={openImagePicker}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Choose Image</Text>
          </Pressable>

          {selectedImage ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Selected image</Text>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
              />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={uploadPhoto}
            disabled={uploading || !selectedImage?.uri}
            style={({ pressed }) => [
              styles.uploadButton,
              (uploading || !selectedImage?.uri) && styles.disabledButton,
              pressed && !uploading && selectedImage?.uri && styles.buttonPressed,
            ]}
          >
            {uploading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.uploadButtonText}>Uploading...</Text>
              </View>
            ) : (
              <Text style={styles.uploadButtonText}>Upload Photo</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  photoContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#DDEBFF",
    justifyContent: "center",
    alignItems: "center",
  },
  photoPlaceholderText: {
    color: colors.blue,
    fontSize: 54,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  previewCard: {
    width: "100%",
    maxWidth: 340,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 18,
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#F2F6FB",
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 340,
  },
  uploadButton: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
