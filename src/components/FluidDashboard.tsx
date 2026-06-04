import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
} from "react-native-reanimated";

interface FluidDashboardProps {
  translateX: SharedValue<number>;
  width: number;
  onClose: () => void;
}

export default function FluidDashboard({
  translateX,
  width,
  onClose,
}: FluidDashboardProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-width, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.dashboardContent}>
        <Text style={styles.title}>Dashboard</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculator Stats</Text>
          <Text style={styles.statsText}>Calculations performed: 0</Text>
          <Text style={styles.statsText}>Last result: —</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <Text style={styles.linkText}>• History</Text>
          <Text style={styles.linkText}>• Settings</Text>
          <Text style={styles.linkText}>• About</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "75%",
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    zIndex: 5,
  },
  dashboardContent: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    fontFamily: "Glacial Indifference",
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#208AEF",
    fontFamily: "Glacial Indifference",
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: "#ccc",
    fontFamily: "Glacial Indifference",
    marginVertical: 4,
  },
  linkText: {
    fontSize: 14,
    color: "#ddd",
    fontFamily: "Glacial Indifference",
    marginVertical: 6,
  },
});
