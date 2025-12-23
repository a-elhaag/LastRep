import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Link href="/" dismissTo style={styles.link}>
        <Text style={styles.linkText}>Go to home screen</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: "700",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    color: Colors.dark.tint,
    fontSize: 16,
    fontWeight: "600",
  },
});
