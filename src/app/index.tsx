import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

// Glassmorphic Flakes Component - Creates frosted glass effect
interface Flake {
  id: string;
  left: number;
  top: number;
  size: number;
  opacity: number;
  delay: number;
}

const generateFlakes = (count: number = 6): Flake[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `flake-${i}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 30 + 10,
    opacity: Math.random() * 0.2 + 0.1,
    delay: i * 100,
  }));
};

const GlassmorphicFlakes = ({
  flakes,
  isVisible,
}: {
  flakes: Flake[];
  isVisible: boolean;
}) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes.map((flake) => (
        <AnimatedView
          key={flake.id}
          style={[
            styles.flake,
            {
              left: `${flake.left}%`,
              top: `${flake.top}%`,
              width: flake.size,
              height: flake.size,
              opacity: isVisible ? flake.opacity : 0,
            },
          ]}
        />
      ))}
    </View>
  );
};

const CalculatorButton = ({
  btn,
  onPress,
}: {
  btn: CalcButton;
  onPress: (btn: CalcButton) => void;
}) => {
  const scale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    // High-stiffness spring for immediate tactile feedback
    scale.value = withSpring(0.9, { damping: 15, stiffness: 648 });
  };

  const handlePressOut = () => {
    // Bouncy return to normal state
    scale.value = withSpring(1, { damping: 12, stiffness: 324 });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(btn)}
      style={[
        styles.button,
        btn.type === "operation" || btn.type === "equals"
          ? styles.opButton
          : btn.type === "function"
            ? styles.funcButton
            : styles.numButton,
        animatedButtonStyle,
        btn.label === "0" && { flex: 2.2, aspectRatio: undefined },
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
    </AnimatedPressable>
  );
};

export default function Index() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [display, setDisplay] = useState("0");
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const swipeValue = useSharedValue(0);
  const sideSwipeValue = useSharedValue(width);
  const isOverlayOpen = useRef(false);
  const isSideOverlayOpen = useRef(false);

  // Accessibility & Glassmorphism
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [mainFlakes] = useState(() => generateFlakes(6));
  const [sideFlakes] = useState(() => generateFlakes(5));
  const [bluetoothFlakes] = useState(() => generateFlakes(4));

  useEffect(() => {
    // Check if user has reduce transparency enabled for accessibility (native only)
    if (Platform.OS === "ios" || Platform.OS === "android") {
      try {
        AccessibilityInfo.isReduceTransparencyEnabled?.()
          .then((enabled) => setReduceTransparency(enabled))
          .catch(() => setReduceTransparency(false));
      } catch {
        setReduceTransparency(false);
      }
    }
  }, []);

  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [saveHistoryEnabled, setSaveHistoryEnabled] = useState(true);

  // Connection States
  const [isBTModalVisible, setIsBTModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [btDevices, setBtDevices] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const bluetoothScale = useSharedValue(1);

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

  const animatedSideModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sideSwipeValue.value }],
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

  // Parse expression into individual items with quantities
  const parseCalculationBreakdown = () => {
    try {
      // Replace symbols with standard operators for splitting
      const normalized = display
        .replace(/×/g, "*")
        .replace(/−/g, "+")
        .replace(/÷/g, "/");

      // Split by + but preserve the terms
      const terms = normalized.split("+").filter((term) => term.trim());

      return terms.map((term) => {
        const trimmedTerm = term.trim();
        if (trimmedTerm.includes("*")) {
          // Has explicit quantity
          const [item, quantity] = trimmedTerm.split("*");
          return {
            display: `${item}*${quantity}`,
            quantity: parseInt(quantity) || 1,
          };
        } else if (trimmedTerm.includes("/")) {
          // Division should be shown as is
          return {
            display: trimmedTerm,
            quantity: 1,
          };
        } else {
          // Just a number, treat as quantity 1
          return {
            display: trimmedTerm,
            quantity: 1,
          };
        }
      });
    } catch {
      return [];
    }
  };

  const gestureType = useRef<"vertical" | "side" | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        // Detect if swiping from the right edge (within 50px of width)
        if (gestureState.x0 > width - 50) {
          gestureType.current = "side";
        } else {
          gestureType.current = "vertical";
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureType.current === "side") {
          const startPos = isSideOverlayOpen.current ? 0 : width;
          const nextValue = Math.max(
            0,
            Math.min(width, startPos + gestureState.dx),
          );
          sideSwipeValue.value = nextValue;
        } else {
          // Vertical logic for Advanced Options
          const startPos = isOverlayOpen.current ? -height : 0;
          const nextValue = startPos + gestureState.dy;
          if (nextValue <= 0 && nextValue >= -height) {
            swipeValue.value = nextValue;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureType.current === "side") {
          const threshold = isSideOverlayOpen.current
            ? width * 0.06
            : width - width * 0.06;

          if (sideSwipeValue.value < threshold) {
            // Snap to Open (Left)
            sideSwipeValue.value = withTiming(0, { duration: 300 });
            isSideOverlayOpen.current = true;
          } else {
            // Snap to Closed (Right)
            sideSwipeValue.value = withTiming(width, { duration: 300 });
            isSideOverlayOpen.current = false;
          }
        } else {
          const threshold = isOverlayOpen.current
            ? -height + height * 0.06
            : -height * 0.06;

          if (swipeValue.value < threshold) {
            swipeValue.value = withTiming(-height, { duration: 300 });
            isOverlayOpen.current = true;
          } else {
            swipeValue.value = withTiming(0, { duration: 300 });
            isOverlayOpen.current = false;
          }
        }
        gestureType.current = null;
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

  // Mock Scanning Logic (Requires native libraries for real use)
  const startBTScan = async () => {
    setIsBTModalVisible(true);
    setIsScanning(true);
    // Placeholder: Integration with react-native-ble-plx would go here
    setTimeout(() => {
      setBtDevices([
        { id: "A1", name: "Thermal Printer 58mm" },
        { id: "B2", name: "HP Laser Jet" },
        { id: "C3", name: "Bluetooth Printer" },
      ]);
      setIsScanning(false);
    }, 1500);
  };

  const handleConnectBT = (id: string, name: string) => {
    setConnectedDevice(name);
    setIsBTModalVisible(false);
    alert(`Connected to ${name}`);
  };

  const printResult = () => {
    if (!connectedDevice) {
      alert("Please connect a Bluetooth printer first.");
      startBTScan();
      return;
    }

    // ESC/POS Command structure (Conceptual)
    // [0x1B, 0x40] -> Initialize
    // [0x1B, 0x61, 0x01] -> Center align
    const escPosCommand = `
      INITIALIZE
      CENTER_ALIGN
      TEXT: "iCalc Receipt"
      FEED_2_LINES
      TEXT: "Result: ${display}"
      FEED_4_LINES
      PAPER_CUT
    `;
    console.log("Sending ESC/POS to printer:", escPosCommand);
    alert("Printing...");
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
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
              onPress={() => {
                handleIconBounce(bluetoothScale);
                startBTScan();
              }}
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
            <Pressable onPress={printResult} style={styles.actionBtn}>
              <MaterialCommunityIcons name="printer" size={15} color="#bbb" />
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
                  <CalculatorButton
                    key={btn.label}
                    btn={btn}
                    onPress={handlePress}
                  />
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

      {/* Advanced Options panel implemented as a fluid overlay with glassmorphism */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlayContainer,
          animatedModalStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View
            style={[
              styles.modalView,
              reduceTransparency && { backgroundColor: "#2a2a2a" },
            ]}
          >
            <GlassmorphicFlakes
              flakes={mainFlakes}
              isVisible={isOverlayOpen.current}
            />
            {!reduceTransparency && (
              <BlurView
                intensity={80}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
            <View
              {...panResponder.panHandlers}
              style={styles.modalHandleContainer}
            >
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Image
                source={require("../../assets/images/icalc-logo.png")}
                style={styles.modalLogo}
              />
              <TextInput
                style={[
                  styles.modalTitle,
                  { flex: 1, marginLeft: 12, marginBottom: 0 },
                ]}
                placeholder="name here"
                placeholderTextColor="#aaa"
              />
            </View>
            <View style={styles.modalBody}>
              {parseCalculationBreakdown().length > 0 ? (
                <ScrollView style={styles.breakdownList}>
                  <Text style={styles.breakdownLabel}>Grocery List:</Text>
                  {parseCalculationBreakdown().map((item, index) => (
                    <View key={index} style={styles.breakdownItem}>
                      <Text style={styles.breakdownItemText}>
                        /{item.display}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.modalDescription}>
                  Enter a calculation to see the grocery list here. Use * to
                  specify quantities (e.g., 34*3+67)
                </Text>
              )}
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

      {/* Side Settings/History panel triggered by right-edge swipe with glassmorphism */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.sideOverlayContainer,
          animatedSideModalStyle,
        ]}
        pointerEvents="box-none"
      >
        {!reduceTransparency && (
          <BlurView
            intensity={90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            styles.sideModalView,
            reduceTransparency && { backgroundColor: "#1a1a1a" },
          ]}
        >
          <GlassmorphicFlakes
            flakes={sideFlakes}
            isVisible={isSideOverlayOpen.current}
          />
          <View style={styles.sideModalHeader}>
            <View style={styles.headerLeft}>
              <Image
                source={require("../../assets/images/icalc-logo.png")}
                style={styles.sideModalLogo}
              />
              <Text style={styles.sideModalTitle}>iCalc Settings</Text>
            </View>
            <Pressable
              onPress={() => {
                sideSwipeValue.value = withTiming(width, { duration: 300 });
                isSideOverlayOpen.current = false;
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sideModalContent}>
            <Pressable
              style={styles.settingItem}
              onPress={() => setHapticEnabled(!hapticEnabled)}
            >
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons
                  name="vibrate"
                  size={20}
                  color="#208AEF"
                />
                <Text style={styles.settingText}>Haptic Feedback</Text>
              </View>
              <MaterialCommunityIcons
                name={hapticEnabled ? "toggle-switch" : "toggle-switch-off"}
                size={32}
                color={hapticEnabled ? "#208AEF" : "#666"}
              />
            </Pressable>

            <Pressable
              style={styles.settingItem}
              onPress={() => setSoundEnabled(!soundEnabled)}
            >
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons
                  name="volume-high"
                  size={20}
                  color="#208AEF"
                />
                <Text style={styles.settingText}>Sound Effects</Text>
              </View>
              <MaterialCommunityIcons
                name={soundEnabled ? "toggle-switch" : "toggle-switch-off"}
                size={32}
                color={soundEnabled ? "#208AEF" : "#666"}
              />
            </Pressable>

            <Pressable
              style={styles.settingItem}
              onPress={() => setDarkModeEnabled(!darkModeEnabled)}
            >
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons
                  name="theme-light-dark"
                  size={20}
                  color="#208AEF"
                />
                <Text style={styles.settingText}>Dark Mode</Text>
              </View>
              <MaterialCommunityIcons
                name={darkModeEnabled ? "toggle-switch" : "toggle-switch-off"}
                size={32}
                color={darkModeEnabled ? "#208AEF" : "#666"}
              />
            </Pressable>

            <Pressable
              style={styles.settingItem}
              onPress={() => setSaveHistoryEnabled(!saveHistoryEnabled)}
            >
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons
                  name="history"
                  size={20}
                  color="#208AEF"
                />
                <Text style={styles.settingText}>Save History</Text>
              </View>
              <MaterialCommunityIcons
                name={
                  saveHistoryEnabled ? "toggle-switch" : "toggle-switch-off"
                }
                size={32}
                color={saveHistoryEnabled ? "#208AEF" : "#666"}
              />
            </Pressable>

            <Pressable
              style={styles.dangerButton}
              onPress={() => {
                setPast([]);
                setFuture([]);
                setDisplay("0");
              }}
            >
              <Text style={styles.dangerButtonText}>Clear All Data</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Bluetooth Discovery Modal with Glassmorphism */}
      <Modal visible={isBTModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalView,
              { height: "50%" },
              reduceTransparency && { backgroundColor: "#2a2a2a" },
            ]}
          >
            <GlassmorphicFlakes
              flakes={bluetoothFlakes}
              isVisible={isBTModalVisible}
            />
            {!reduceTransparency && (
              <BlurView
                intensity={85}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
            <View style={styles.modalHeader}>
              <Image
                source={require("../../assets/images/icalc-logo.png")}
                style={styles.modalLogo}
              />
              <Text
                style={[styles.modalTitle, { marginLeft: 12, marginBottom: 0 }]}
              >
                Bluetooth Printers
              </Text>
            </View>
            {isScanning ? (
              <ActivityIndicator size="large" color="#208AEF" />
            ) : (
              <FlatList
                data={btDevices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.connectionItem}
                    onPress={() => handleConnectBT(item.id, item.name)}
                  >
                    <MaterialCommunityIcons
                      name="printer"
                      size={20}
                      color="black"
                    />
                    <Text style={styles.connectionText}>{item.name}</Text>
                    {connectedDevice === item.name && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color="green"
                      />
                    )}
                  </Pressable>
                )}
                style={{ width: "100%" }}
              />
            )}
            <Pressable
              style={[styles.closeButton, { marginTop: 20 }]}
              onPress={() => setIsBTModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "rgba(255, 255, 255, 0.81)",
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
    fontSize: 40,
    color: "#141414",
    fontWeight: "bold",
    fontFamily: "Glacial Indifference",
    marginBottom: 19,
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
    backgroundColor: Platform.select({
      ios: "rgba(50, 50, 50, 0.3)",
      android: "rgba(50, 50, 50, 0.7)",
      default: "rgba(50, 50, 50, 0.3)",
    }),
    borderRadius: 18,
    padding: 24,
    marginBottom: 3,
    alignItems: "center",
    height: "80%",
    borderWidth: Platform.select({ android: 1, default: 0 }),
    borderColor: Platform.select({
      android: "rgba(255, 255, 255, 0.2)",
      default: "transparent",
    }),
    overflow: "hidden",
    boxShadow: [
      {
        offsetX: 0,
        offsetY: -4,
        blurRadius: 16,
        color: "rgba(0, 0, 0, 0.1)",
      },
    ],
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
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
    color: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  modalLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 6,
        color: "rgba(0, 0, 0, 0.15)",
      },
    ],
  },
  modalBody: {
    flex: 1,
    fontFamily: "Glacial Indifference",
    justifyContent: "center",
  },
  modalDescription: {
    color: "#f0f0f0",
    textAlign: "center",
    fontFamily: "Glacial Indifference",
  },
  breakdownList: {
    width: "100%",
    maxHeight: 300,
  },
  breakdownLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Glacial Indifference",
    marginBottom: 12,
    textAlign: "left",
  },
  breakdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderLeftWidth: 4,
    borderLeftColor: "#e7359d",
    borderRadius: 4,
  },
  breakdownItemText: {
    fontSize: 16,
    color: "#f0f0f0",
    fontFamily: "Glacial Indifference",
    fontWeight: "500",
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
    backgroundColor: "#ffffff",
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
  sideOverlayContainer: {
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sideModalView: {
    width: "80%",
    height: "100%",
    backgroundColor: Platform.select({
      ios: "rgba(25, 25, 25, 0.4)",
      android: "rgba(25, 25, 25, 0.85)",
      default: "rgba(25, 25, 25, 0.4)",
    }),
    padding: 20,
    paddingTop: 60,
    borderLeftWidth: Platform.select({ android: 1, default: 0 }),
    borderLeftColor: Platform.select({
      android: "rgba(255, 255, 255, 0.15)",
      default: "transparent",
    }),
    overflow: "hidden",
    ...Platform.select({
      android: { elevation: 12 },
      default: {},
    }),
  },
  sideModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sideModalLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 6,
        color: "rgba(0, 0, 0, 0.3)",
      },
    ],
  },
  sideModalTitle: {
    color: "white",
    fontSize: 22,
    fontFamily: "Glacial Indifference",
    fontWeight: "bold",
  },
  sideModalContent: {
    gap: 15,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingText: {
    color: "#eee",
    fontSize: 16,
    fontFamily: "Glacial Indifference",
  },
  dangerButton: {
    marginTop: 30,
    padding: 15,
    borderRadius: 12,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Glacial Indifference",
  },
  connectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
  },
  connectionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: "Glacial Indifference",
  },
  flake: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
});
