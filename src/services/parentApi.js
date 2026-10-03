import {
  ApiError,
  apiRequest,
  isApiConfigured,
  resolveApiUrl,
} from "./api.js";
import { normalizeParentChildren } from "./parentNormalization.js";

const imageUrlFromResponse = (payload) => {
  const data = payload?.data || payload;
  const value =
    data?.url ||
    data?.image_url ||
    data?.imageUrl ||
    data?.photo_url ||
    data?.photoUrl ||
    data?.path ||
    data?.file_url ||
    data?.fileUrl ||
    data?.location ||
    payload?.url ||
    payload?.image_url ||
    payload?.imageUrl ||
    payload?.photo_url ||
    payload?.photoUrl ||
    "";

  if (!value) return "";
  if (/^https?:\/\//i.test(value) || /^file:\/\//i.test(value)) {
    return value;
  }
  return resolveApiUrl(value);
};

export const parentApi = {
  async getChildren(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/parents/children", {
      token: session?.token,
    });
    const children = normalizeParentChildren(payload);
    if (__DEV__) {
      console.info(
        "[Parent] child ID mapping",
        children.map((child) => ({
          selectedId: child.id,
          parentChildId: child.parentChildId,
          student_id: child.student_id,
          studentId: child.studentId,
          child_id: child.child_id,
          childId: child.childId,
          nestedStudentId:
            child.student?.student_id ??
            child.student?.studentId ??
            child.student?.id,
          nestedChildId:
            child.child?.student_id ??
            child.child?.studentId ??
            child.child?.id,
        })),
      );
    }
    return children;
  },

  async getChildProfile(studentId, session) {
    if (!isApiConfigured || !studentId) return null;
    const payload = await apiRequest(`/parents/child/${studentId}/profile`, {
      token: session?.token,
      suppressResponseBodyLog: true,
    });
    return payload?.data || payload?.profile || payload;
  },

  async updateChildProfile(studentId, profile, session) {
    if (!isApiConfigured || !studentId) {
      throw new Error("A ward must be selected before updating the profile.");
    }
    const payload = await apiRequest(`/parents/child/${studentId}/profile`, {
      method: "PUT",
      token: session?.token,
      body: profile,
    });
    return payload?.data || payload?.profile || payload;
  },

  async uploadChildPhoto(studentId, imageAsset, session) {
    const imageUri =
      typeof imageAsset === "string" ? imageAsset : imageAsset?.uri;
    const imageFile =
      typeof imageAsset === "object" ? imageAsset?.file : undefined;
    if (!isApiConfigured || !studentId || !imageUri) {
      throw new Error("A valid photo must be selected before uploading.");
    }
    if (!imageFile && !/^(file|content|data):/i.test(imageUri)) {
      throw new Error("The selected image does not have a supported local file URI.");
    }

    const uriFileName = imageUri
      .split(/[?#]/, 1)[0]
      .split(/[\\/]/)
      .pop();
    const imageExtension = uriFileName?.match(/\.([a-z\d]+)$/i)?.[1]?.toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
    };
    const mimeType =
      (typeof imageAsset === "object" && imageAsset?.mimeType) ||
      imageFile?.type ||
      mimeTypes[imageExtension] ||
      "image/jpeg";
    const fallbackExtension =
      Object.entries(mimeTypes).find(([, value]) => value === mimeType)?.[0] ||
      "jpg";
    const fileName =
      (typeof imageAsset === "object" && imageAsset?.fileName) ||
      imageFile?.name ||
      (imageExtension ? uriFileName : `profile-${Date.now()}.${fallbackExtension}`);
    if (!/^image\/[a-z\d.+-]+$/i.test(mimeType)) {
      throw new Error("The selected file is not a supported image.");
    }

    if (__DEV__) {
      console.info("[Upload] Starting image upload", {
        method: "POST",
        fieldName: "image",
        uriScheme: imageUri.match(/^([a-z][a-z\d+.-]*):/i)?.[1] || "unknown",
        fileName,
        mimeType,
      });
    }

    const formData = new FormData();
    formData.append(
      "image",
      imageFile || {
        uri: imageUri,
        name: fileName,
        type: mimeType,
      },
    );

    const payload = await apiRequest("/upload/image", {
      method: "POST",
      token: session?.token,
      body: formData,
      isMultipart: true,
    });

    if (payload?.success === false || payload?.data?.success === false) {
      const errorPayload = payload?.data?.success === false ? payload.data : payload;
      throw new ApiError(
        errorPayload?.message || "Unable to upload the profile photo.",
        200,
        payload,
        "api",
      );
    }

    const imageUrl = imageUrlFromResponse(payload);
    return {
      ...(payload && typeof payload === "object" ? payload : {}),
      imageUrl,
    };
  },
};
