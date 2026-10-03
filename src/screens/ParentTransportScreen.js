import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { transportApi } from "../services/transportApi";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  red: "#C65353",
  paleRed: "#FDECEC",
};

export default function ParentTransportScreen({
  session,
  selectedStudentId,
  onSessionExpired,
}) {
  const [data, setData] = useState({
    buses: [],
    routes: [],
    mappings: [],
    stops: [],
    fares: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransport = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await transportApi.getOverview(session, selectedStudentId));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load transport details.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransport();
  }, [session, selectedStudentId]);

  const mapping = data.mappings[0];
  const route = data.routes.find(
    (item) => String(item.id) === String(mapping?.route_id || mapping?.routeId),
  );
  const bus = data.buses.find(
    (item) => String(item.id) === String(mapping?.bus_id || mapping?.busId),
  );
  const routeStops = data.stops.filter(
    (stop) => String(stop.route_id) === String(route?.id),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Ionicons name="bus-outline" size={28} color={colors.blue} />
        <View>
          <Text style={styles.title}>Transport</Text>
          <Text style={styles.subtitle}>Student route and bus details</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.stateText}>Loading transport details...</Text>
        </View>
      ) : error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadTransport}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : !mapping ? (
        <View style={styles.empty}>
          <Ionicons name="bus-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyTitle}>No transport assignment</Text>
          <Text style={styles.emptyText}>
            A bus or route assigned to this student will appear here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Assigned route</Text>
            <Text style={styles.heroTitle}>
              {route?.name ||
                route?.route_name ||
                mapping.route_name ||
                "Route assigned"}
            </Text>
            <Text style={styles.heroMeta}>
              {bus?.bus_number ||
                bus?.registration_number ||
                mapping.bus_number ||
                "Bus details unavailable"}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assignment details</Text>
            <Info
              label="Pickup point"
              value={
                mapping.pickup_point || mapping.pickup_stop || "Not specified"
              }
            />
            <Info
              label="Drop point"
              value={mapping.drop_point || mapping.drop_stop || "Not specified"}
            />
            <Info
              label="Driver"
              value={bus?.driver_name || mapping.driver_name || "Not specified"}
            />
            <Info
              label="Fare"
              value={
                mapping.fare ||
                data.fares.find(
                  (fare) => String(fare.route_id) === String(route?.id),
                )?.amount ||
                "Not specified"
              }
            />
          </View>
          <Text style={styles.sectionTitle}>Route stops</Text>
          {routeStops.length ? (
            routeStops.map((stop, index) => (
              <View style={styles.stop} key={stop.id || index}>
                <View style={styles.stopNumber}>
                  <Text style={styles.stopNumberText}>{index + 1}</Text>
                </View>
                <View>
                  <Text style={styles.stopName}>
                    {stop.name || stop.stop_name || "Stop"}
                  </Text>
                  <Text style={styles.stopMeta}>
                    {stop.arrival_time || stop.time || "Time not specified"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No route stops available.</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas },
  content: { paddingBottom: 25 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  backText: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  hero: {
    backgroundColor: colors.blue,
    borderRadius: 13,
    padding: 16,
    marginBottom: 12,
  },
  heroLabel: {
    color: "#BDE8E2",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },
  heroMeta: { color: "#D5F4F0", fontSize: 12, marginTop: 5 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 14,
    marginBottom: 18,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 5,
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 10,
  },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoValue: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 9,
  },
  stop: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  stopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  stopNumberText: { color: colors.blue, fontWeight: "900", fontSize: 11 },
  stopName: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  stopMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  state: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { color: colors.muted, fontSize: 11 },
  error: {
    backgroundColor: colors.paleRed,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  errorText: { color: colors.red, fontSize: 11, textAlign: "center" },
  retry: { color: colors.blue, fontSize: 12, fontWeight: "900", marginTop: 7 },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 22,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
  },
});
