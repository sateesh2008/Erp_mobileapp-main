import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  canvas: "#F7F8FF",
  white: "#FFFFFF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
};
const reasons = [
  "Medical / Sickness",
  "Emergency",
  "Family Function",
  "Personal Work",
  "Other",
];
const passTypes = ["One-Way (Day Departure)", "Returnable"];
const pad = (value) => String(value).padStart(2, "0");
const dateKey = (value) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const displayDateTime = (value) =>
  `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
const timeKey = (value) =>
  `${pad(value.getHours())}:${pad(value.getMinutes())}`;

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function SelectField({
  label,
  required,
  value,
  placeholder,
  options,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.options} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option}
                style={styles.option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    option === value && styles.activeOption,
                  ]}
                >
                  {option}
                </Text>
                {option === value ? (
                  <Icon name="checkmark" size={18} color={colors.blue} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionButton({ title, onPress, secondary, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
    >
      <Text
        style={[styles.buttonText, secondary && styles.secondaryButtonText]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function TeacherGatePassForm({
  visible,
  students,
  classes,
  loading,
  onClose,
  onSubmit,
}) {
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState("");
  const [reason, setReason] = useState("Medical / Sickness");
  const [exitDateTime, setExitDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [escortName, setEscortName] = useState("");
  const [escortContact, setEscortContact] = useState("");
  const [passType, setPassType] = useState("One-Way (Day Departure)");
  const [returnRequired, setReturnRequired] = useState(true);
  const [remarks, setRemarks] = useState("");
  const selectedStudent = students.find(
    (student) => String(student.id) === String(studentId),
  );
  const studentOptions = students.filter(
    (student) => !className || String(student.className) === String(className),
  );
  const isFormValid = Boolean(
    className &&
    selectedStudent &&
    reason &&
    exitDateTime instanceof Date &&
    !Number.isNaN(exitDateTime.getTime()) &&
    escortName.trim() &&
    /^\d{10}$/.test(escortContact.trim()),
  );

  const reset = () => {
    setStudentId("");
    setClassName("");
    setReason("Medical / Sickness");
    setExitDateTime(new Date());
    setEscortName("");
    setEscortContact("");
    setPassType("One-Way (Day Departure)");
    setReturnRequired(true);
    setRemarks("");
  };
  const close = () => {
    reset();
    onClose();
  };
  const submit = () => {
    if (loading) return;
    if (!isFormValid) {
      Alert.alert(
        "Complete required fields",
        "Target class, student, reason, escort details, and a valid 10-digit mobile number are required.",
      );
      return;
    }
    onSubmit({
      studentId,
      className,
      section: selectedStudent?.section || "",
      reason,
      escortName: escortName.trim(),
      escortContact: escortContact.trim(),
      passType:
        passType === "One-Way (Day Departure)" ? "ONE_WAY" : "RETURNABLE",
      returnRequired,
      expectedReturnTime: returnRequired ? "17:00" : null,
      notes: remarks.trim(),
      date: dateKey(exitDateTime),
      issueTime: timeKey(exitDateTime),
      exitDateTime: displayDateTime(exitDateTime),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Issue Student Exit Gate Pass</Text>
            <Text style={styles.subtitle}>
              Authorize and record a student&apos;s campus departure.
            </Text>
          </View>
          <Pressable onPress={close}>
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <SelectField
          label="Target Class"
          required
          value={className}
          placeholder="Select an option"
          options={classes}
          onChange={(value) => {
            setClassName(value);
            setStudentId("");
          }}
        />
        <SelectField
          label="Select Student"
          required
          value={selectedStudent?.name}
          placeholder="Select an option"
          options={studentOptions.map((student) => student.name)}
          onChange={(value) =>
            setStudentId(
              studentOptions.find((student) => student.name === value)?.id ||
                "",
            )
          }
        />
        <SelectField
          label="Reason for Exit"
          required
          value={reason}
          placeholder="Select an option"
          options={reasons}
          onChange={setReason}
        />
        <View style={styles.field}>
          <Text style={styles.label}>
            Exit Date & Time<Text style={styles.required}> *</Text>
          </Text>
          <Pressable
            style={styles.select}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.selectText}>
              {displayDateTime(exitDateTime)}
            </Text>
            <Icon name="calendar-outline" size={17} color={colors.blue} />
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={exitDateTime}
              mode="datetime"
              onChange={(_, value) => {
                setShowDatePicker(false);
                if (value) setExitDateTime(value);
              }}
            />
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>
            Accompanied By (Escort Name & Relation)
            <Text style={styles.required}> *</Text>
          </Text>
          <TextInput
            value={escortName}
            onChangeText={setEscortName}
            placeholder="e.g. Father: Ramesh Kumar"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>
            Escort Contact Mobile Number<Text style={styles.required}> *</Text>
          </Text>
          <TextInput
            value={escortContact}
            onChangeText={(value) =>
              setEscortContact(value.replace(/\D/g, "").slice(0, 10))
            }
            keyboardType="phone-pad"
            placeholder="e.g. 9876543210"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <SelectField
          label="Pass Type & Return Requirement"
          value={passType}
          placeholder="Select pass type"
          options={passTypes}
          onChange={setPassType}
        />
        <Pressable
          style={styles.checkRow}
          onPress={() => setReturnRequired((value) => !value)}
        >
          <Icon
            name={returnRequired ? "checkbox" : "square-outline"}
            size={21}
            color={colors.blue}
          />
          <Text style={styles.checkText}>Returning Today</Text>
        </Pressable>
        <View style={styles.field}>
          <Text style={styles.label}>
            Specific Reason / Instructions / Doctor Remarks
          </Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            multiline
            placeholder="e.g. Student reported high fever at 11:30 AM. Prescribed rest at home by school infirmary."
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.remarks]}
          />
        </View>
        <View style={styles.actions}>
          <ActionButton title="Cancel" secondary onPress={close} />
          <ActionButton
            title="Issue Gate Pass"
            disabled={loading || !isFormValid}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900", maxWidth: 300 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  field: { marginBottom: 15 },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
  },
  required: { color: "#C65353" },
  select: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  selectText: { color: colors.ink, fontSize: 13, flex: 1 },
  placeholder: { color: colors.muted },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 13,
    backgroundColor: colors.white,
  },
  remarks: { minHeight: 105, paddingTop: 12, textAlignVertical: "top" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -3,
    marginBottom: 17,
  },
  checkText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryButtonText: { color: colors.blue },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 31, 0.35)",
    justifyContent: "flex-end",
  },
  options: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 17,
    maxHeight: "75%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 14,
  },
  optionText: { color: colors.ink, fontSize: 13 },
  activeOption: { color: colors.blue, fontWeight: "900" },
});
