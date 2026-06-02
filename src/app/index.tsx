import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface CalcButton {
  label: string;
  type: "number" | "operation" | "function" | "equals";
}

export default function Index() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [display, setDisplay] = useState("0");
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const swipeValue = useSharedValue(0);
  const isOverlayOpen = useRef(false);

  const wifiScale = useSharedValue(1);
  const bluetoothScale = useSharedValue(1);

  const animatedWifiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wifiScale.value }],
  }));

  const animatedBluetoothStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bluetoothScale.value }],
  }));

  const handleIconBounce = (scale: any) => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 60 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
  };

  // Main animation mapping: tied to the raw drag value
  const animatedSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeValue.value }],
  }));

  const animatedBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      swipeValue.value,
      [0, -height],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          swipeValue.value,
          [0, -height],
          [height, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Safe live result calculation, now using the display state directly
  const getLiveResult = () => {
    try {
      if (
        !display ||
        display === "0" ||
        ["+", "−", "×", "÷", "."].includes(display.slice(-1))
      ) {
        return "";
      }
      const sanitized = display
        .replace(/×/g, "*")
        .replace(/−/g, "-")
        .replace(/÷/g, "/");
      return String(new Function(`return ${sanitized}`)());
    } catch {
      return "";
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        // Calculate new position based on whether we are already open
        const startPos = isOverlayOpen.current ? -height : 0;
        const nextValue = startPos + gestureState.dy;

        // Clamp: can't pull down past closed, or up past open
        if (nextValue <= 0 && nextValue >= -height) {
          swipeValue.value = nextValue;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = isOverlayOpen.current
          ? -height + height * 0.06
          : -height * 0.06;

        if (swipeValue.value < threshold) {
          // Snap to Open
          swipeValue.value = withTiming(-height, { duration: 300 });
          isOverlayOpen.current = true;
        } else {
          // Snap to Closed
          swipeValue.value = withTiming(0, { duration: 300 });
          isOverlayOpen.current = false;
        }
      },
    }),
  ).current;

  const pushToHistory = useCallback(
    (nextValue: string) => {
      if (nextValue === display) return;
      setPast((prev) => [...prev, display]);
      setFuture([]);
      setDisplay(nextValue);
    },
    [display],
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((prev) => [display, ...prev]);
    setPast((prev) => prev.slice(0, -1));
    setDisplay(previous);
  }, [past, display]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast((prev) => [...prev, display]);
    setFuture((prev) => prev.slice(1));
    setDisplay(next);
  }, [future, display]);

  const handleBackspace = useCallback(() => {
    if (display === "0" || display === "Error") {
      setDisplay("0");
      return;
    }
    const nextVal = display.length > 1 ? display.slice(0, -1) : "0";
    pushToHistory(nextVal);
  }, [display, pushToHistory]);

  const portraitButtonGrid: CalcButton[][] = [
    [
      { label: "AC", type: "function" },
      { label: "±", type: "function" },
      { label: "%", type: "function" },
      { label: "÷", type: "operation" },
    ],
    [
      { label: "7", type: "number" },
      { label: "8", type: "number" },
      { label: "9", type: "number" },
      { label: "×", type: "operation" },
    ],
    [
      { label: "4", type: "number" },
      { label: "5", type: "number" },
      { label: "6", type: "number" },
      { label: "−", type: "operation" },
    ],
    [
      { label: "1", type: "number" },
      { label: "2", type: "number" },
      { label: "3", type: "number" },
      { label: "+", type: "operation" },
    ],
    [
      { label: "0", type: "number" },
      { label: ".", type: "number" },
      { label: "=", type: "equals" },
    ],
  ];

  const landscapeOperatorsRow: CalcButton[] = [
    { label: "÷", type: "operation" },
    { label: "×", type: "operation" },
    { label: "−", type: "operation" },
    { label: "+", type: "operation" },
  ];

  const landscapeNumbersAndFunctionsGrid: CalcButton[][] = [
    [
      { label: "AC", type: "function" },
      { label: "±", type: "function" },
      { label: "%", type: "function" },
    ],
    [
      { label: "7", type: "number" },
      { label: "8", type: "number" },
      { label: "9", type: "number" },
    ],
    [
      { label: "4", type: "number" },
      { label: "5", type: "number" },
      { label: "6", type: "number" },
    ],
    [
      { label: "1", type: "number" },
      { label: "2", type: "number" },
      { label: "3", type: "number" },
    ],
    [
      { label: "0", type: "number" },
      { label: ".", type: "number" },
      { label: "=", type: "equals" },
    ],
  ];

  const handlePress = useCallback(
    (btn: CalcButton) => {
      if (btn.type === "number") {
        let nextVal;
        if (waitingForNewValue) {
          setWaitingForNewValue(false);
          nextVal = btn.label;
        } else {
          nextVal =
            display === "0" && btn.label !== "."
              ? btn.label
              : display + btn.label;
        }
        pushToHistory(nextVal);
      } else if (btn.type === "operation") {
        setWaitingForNewValue(false);
        const lastChar = display.slice(-1);
        const nextVal = ["+", "−", "×", "÷"].includes(lastChar)
          ? display.slice(0, -1) + btn.label
          : display + btn.label;
        pushToHistory(nextVal);
      } else if (btn.type === "equals") {
        try {
          const sanitized = display
            .replace(/×/g, "*")
            .replace(/−/g, "-")
            .replace(/÷/g, "/");
          const result = new Function(`return ${sanitized}`)();
          pushToHistory(String(result));
          setWaitingForNewValue(true);
        } catch (e) {
          pushToHistory("Error");
          setWaitingForNewValue(true);
        }
      } else if (btn.label === "AC") {
        pushToHistory("0");
        setWaitingForNewValue(false);
      } else if (btn.label === "±") {
        if (display === "0") return;
        pushToHistory(
          display.startsWith("-") ? display.slice(1) : "-" + display,
        );
      } else if (btn.label === "%") {
        try {
          const sanitized = display
            .replace(/×/g, "*")
            .replace(/−/g, "-")
            .replace(/÷/g, "/");
          const val = new Function(`return ${sanitized}`)();
          pushToHistory(String(val / 100));
          setWaitingForNewValue(true);
        } catch (e) {
          pushToHistory("Error");
          setWaitingForNewValue(true);
        }
      }
    },
    [display, waitingForNewValue, pushToHistory],
  );
  return (
    <View style={styles.container}>
      <View
        style={[styles.mainWrapper, isLandscape && styles.landscapeWrapper]}
      >
        {isLandscape && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: 0.8,
                pointerEvents: "none",
              },
            ]}
          >
            <BlurView
              intensity={70}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
        <View
          style={[
            styles.card,
            { aspectRatio: 9 / 18.2 },
            isLandscape && styles.landscapePortraitCard,
          ]}
        >
          <View style={styles.topQuickActions}>
            <Pressable onPress={() => handleIconBounce(wifiScale)}>
              <Animated.Image
                source={require("../../assets/on-icons/wifi-on.png")}
                style={[
                  { width: 22, height: 22, resizeMode: "contain" },
                  animatedWifiStyle,
                ]}
              />
            </Pressable>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color="#999"
                style={styles.searchIcon}
              />
              <Text style={styles.searchPlaceholder}>search</Text>
            </View>
            <Pressable
              style={styles.bluetoothButton}
              onPress={() => handleIconBounce(bluetoothScale)}
            >
              <Animated.Image
                source={require("../../assets/on-icons/buetooth-on.png")}
                style={[
                  { width: 24, height: 24, resizeMode: "contain" },
                  animatedBluetoothStyle,
                ]}
              />
            </Pressable>
          </View>
          <View style={styles.resultContainer}>
            <Text
              style={styles.liveResultText}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {getLiveResult()}
            </Text>
          </View>
          <View style={styles.calculationArea}>
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
              contentContainerStyle={styles.calculationScrollContent}
            >
              <Text
                style={styles.calculationText}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {display}
              </Text>
            </ScrollView>
          </View>
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => {
                swipeValue.value = withTiming(-height, { duration: 300 });
                isOverlayOpen.current = true;
              }}
              style={styles.actionBtn}
            >
              <MaterialCommunityIcons name="history" size={15} color="#bbb" />
            </Pressable>
            <Pressable onPress={handleUndo} style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="undo"
                size={15}
                color="#bbb"
                style={past.length === 0 && styles.disabledText}
              />
            </Pressable>
            <Pressable onPress={handleRedo} style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="redo"
                size={15}
                color="#bbb"
                style={future.length === 0 && styles.disabledText}
              />
            </Pressable>
            <Pressable onPress={handleBackspace} style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="backspace-outline"
                size={15}
                color="#bbb"
              />
            </Pressable>
          </View>
          <View
            style={[
              styles.portraitGrid,
              isLandscape && styles.portraitGridLandscape,
            ]}
          >
            {portraitButtonGrid.map((row: CalcButton[], i: number) => (
              <View
                key={i}
                style={[styles.row, isLandscape && styles.rowLandscape]}
              >
                {row.map((btn: CalcButton) => (
                  <Pressable
                    key={btn.label}
                    onPress={() => handlePress(btn)}
                    style={({ pressed }) => [
                      styles.button,
                      btn.type === "operation" || btn.type === "equals"
                        ? styles.opButton
                        : btn.type === "function"
                          ? styles.funcButton
                          : styles.numButton,
                      pressed && styles.buttonPressed,
                      btn.label === "0" && {
                        flex: 2.2,
                        aspectRatio: undefined,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        btn.type === "number" && styles.numberText,
                        (btn.type === "operation" || btn.type === "equals") &&
                          styles.whiteText,
                      ]}
                    >
                      {btn.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
          {/* The swipe indicator now moves tandem with the modal pull */}
          <Animated.View style={animatedSwipeStyle}>
            <View
              {...panResponder.panHandlers}
              style={styles.swipeTouchZone}
              hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }}
            >
              <MaterialCommunityIcons
                name="chevron-up"
                size={18}
                color="black"
                style={{ alignSelf: "center", marginBottom: -4 }}
              />
              <Text style={styles.swipeText}>Swipe up to open</Text>
            </View>
            <View style={styles.separator} />
          </Animated.View>
        </View>
      </View>

      {/* Dynamic background blur that responds to the swipe gesture */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          animatedBlurStyle,
          { pointerEvents: "none" },
        ]}
      >
        {/* Background color added to increase contrast during depth blur */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.3)" },
          ]}
        />
        <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Advanced Options panel implemented as a fluid overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlayContainer,
          animatedModalStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={styles.modalView}>
            <View
              {...panResponder.panHandlers}
              style={styles.modalHandleContainer}
            >
              <View style={styles.modalHandle} />
            </View>
            <Text style={styles.modalTitle}>Advanced Options</Text>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Calculator history and configuration settings would appear here.
              </Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                swipeValue.value = withTiming(0, { duration: 300 });
                isOverlayOpen.current = false;
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  mainWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  landscapeWrapper: {
    flexDirection: "column",
    paddingHorizontal: 0,
    gap: 0,
  },
  landscapePortraitCard: {
    maxWidth: 400,
    maxHeight: "95%",
  },
  portraitGridLandscape: {
    height: "40%",
    marginTop: 0,
  },
  rowLandscape: {
    flex: 1,
  },
  card: {
    backgroundColor: "white",
    width: "100%",
    maxWidth: "92%",
    maxHeight: "95%",
    borderRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 6,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 3.84,
        color: "rgba(0, 0, 0, 0.25)",
      },
    ],
    justifyContent: "flex-end",
  },

  resultContainer: {
    width: "100%",
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  liveResultText: {
    fontSize: 32,
    color: "#141414",
    fontWeight: "bold",
    fontFamily: "Glacial Indifference",
  },
  calculationArea: {
    flex: 1,
    maxHeight: 180, // Roughly 4 lines of text
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  overlayContainer: {
    zIndex: 10,
  },
  calculationText: {
    fontSize: 42, // Base size allows roughly 10 figures per line before shrinking
    lineHeight: 40,
    color: "black",
    textAlign: "right",
    fontWeight: "300",
    fontFamily: "Glacial Indifference",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    backgroundColor: "#fdf6e3",
    borderRadius: 18,
    padding: 24,
    marginBottom: 3,
    alignItems: "center",
    height: "80%",
    boxShadow: [
      {
        offsetX: 0,
        offsetY: -4,
        blurRadius: 10,
        color: "rgba(0, 0, 0, 0.1)",
      },
    ],
  },
  modalHandle: {
    width: 80,
    height: 4,
    backgroundColor: "#0f0f0f",
    borderRadius: 2,
  },
  modalHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 10,
    marginTop: -20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Glacial Indifference",
    marginBottom: 16,
  },
  modalBody: {
    flex: 1,
    fontFamily: "Glacial Indifference",
    justifyContent: "center",
  },
  modalDescription: {
    color: "#181313",
    textAlign: "center",
    fontFamily: "Glacial Indifference",
  },
  closeButton: {
    backgroundColor: "black",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 999,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Glacial Indifference",
    fontWeight: "600",
  },
  separator: {
    height: 4,
    width: "35%",
    alignSelf: "center",
    backgroundColor: "black",
    borderRadius: 2,
    marginTop: 1,
  },
  swipeText: {
    textAlign: "center",
    fontSize: 10.5,
    fontFamily: "Glacial Indifference",
    color: "black",
    marginBottom: -6,
  },
  swipeTouchZone: {
    paddingTop: 5,
    paddingBottom: 6,
    width: "100%",
  },
  topQuickActions: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#eee8d5",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingTop: 1,
    gap: -5,
    width: "98%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    ...Platform.select({ android: { elevation: 5 } }),
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 8,
        color: "rgba(0, 0, 0, 0.15)",
      },
    ],
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fdf6e3",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 10,
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 6,
  },
  searchPlaceholder: {
    color: "#e7359d",
    fontSize: 14,
    fontFamily: "Glacial Indifference",
  },
  bluetoothButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActions: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#333",
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 15,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 10,
        color: "rgba(14, 13, 13, 0.2)",
      },
    ],
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  disabledText: {
    opacity: 0.3,
  },
  calculationScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  portraitGrid: {
    gap: 5, // Shrink keypads by 4%
    marginTop: "4%",
  },
  landscapeOperatorsRowContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
    gap: 5,
  },
  landscapeNumbersAndFunctionsGrid: {
    gap: 5,
  },
  row: {
    flexDirection: "row",
    gap: 5, // Shrink keypads by 4%
    paddingBottom: -1,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    ...Platform.select({ android: { elevation: 5 } }),
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 6,
        blurRadius: 12,
        color: "rgba(0, 0, 0, 0.5)",
      },
    ],
    marginBottom: 1,
    marginTop: 1,
  },

  numButton: {
    backgroundColor: "#ffffff",
  },
  opButton: {
    backgroundColor: "black",
  },
  funcButton: {
    backgroundColor: "#ffffff",
  },
  buttonText: {
    fontFamily: "Glacial Indifference", // Added fontFamily
    fontSize: 28,
    fontWeight: "800",
    color: "#241d1d",
  },
  numberText: {
    fontFamily: "Glacial Indifference", // Added fontFamily
    fontSize: 28,
    fontWeight: "bold",
  },
  whiteText: {
    color: "#fff",
    fontFamily: "Glacial Indifference", // Added fontFamily
  },
  darkText: {
    color: "#000",
    fontFamily: "Glacial Indifference", // Added fontFamily
  },
  historyPlaceholderLandscape: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.4,
  },
  historyTextLandscape: {
    fontFamily: "Glacial Indifference",
  },
});
