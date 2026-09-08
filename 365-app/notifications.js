// notifications.js
// Maneja permisos, el token de push de Expo, los canales de Android
// (que sí permiten patrón de vibración custom por notificación) y el
// envío de un "toque" al celular de la otra persona sin backend propio.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { GESTURES } from "./prompts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android soporta un patrón de vibración propio por canal de notificación.
// iOS no tiene esta API para push remotos (limitación de Apple): ahí el
// sistema usa la vibración estándar y el patrón fino solo se siente
// cuando la app está abierta (ver App.js, listener en primer plano).
export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "365 — general",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  for (const g of GESTURES) {
    await Notifications.setNotificationChannelAsync(`toque-${g.id}`, {
      name: `365 — ${g.label}`,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: g.pattern,
    });
  }
}

export async function registerForPushToken() {
  if (!Device.isDevice) {
    console.log("Los push notifications solo funcionan en un celular físico, no en el simulador.");
    return null;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("Permiso de notificaciones no concedido.");
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResponse.data; // ej: "ExponentPushToken[xxxxxxx]"
}

// Manda el push directo al servicio de Expo — no hace falta servidor propio.
export async function sendTouchPush({ toPushToken, fromName, gestureId, phrase }) {
  if (!toPushToken) return { ok: false, reason: "sin token del otro celular" };
  const gesture = GESTURES.find((g) => g.id === gestureId);
  const body = phrase ? phrase : `te mandó ${gesture?.label?.toLowerCase() || "un toque"}`;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: toPushToken,
        title: `${fromName} 💗`,
        body,
        sound: "default",
        priority: "high",
        channelId: `toque-${gestureId}`,
        data: { type: "touch", gestureId, pattern: gesture?.pattern || [0, 200], phrase: phrase || "" },
      }),
    });
    const json = await res.json();
    return { ok: true, result: json };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
