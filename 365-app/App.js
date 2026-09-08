import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Vibration,
  StatusBar,
  Platform,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  Heart, Camera, Music, HelpCircle, Feather, Star, Clock, Send,
  Archive, CalendarDays, Sparkles, Check, ArrowLeft, Hand, Flame,
} from "lucide-react-native";

import { PROMPTS, GESTURES, dayOfYear, dateKey } from "./prompts";
import { getCouple, createCouple, updateCouple, listenCouple } from "./firebase";
import { setupAndroidChannels, registerForPushToken, sendTouchPush } from "./notifications";

const CAT_ICONS = {
  recuerdo: Clock, aspiracion: Star, foto: Camera, sonido: Music,
  pregunta: HelpCircle, poema: Feather, expresion: Heart,
};

const C = {
  ink: "#241B2F", panel: "#2E2340", panel2: "#3A2C4E", parchment: "#F3E9DE",
  rose: "#E0637A", roseDim: "#7A4453", gold: "#D9A94E", text: "#F3E9DE",
  textDim: "#B9A9C9", border: "#45355C",
};

export default function App() {
  const [identity, setIdentity] = useState(undefined);
  const [couple, setCouple] = useState({ members: {}, days: {}, touches: [] });
  const [tab, setTab] = useState("hoy");
  const [banner, setBanner] = useState(null);
  const unsubRef = useRef(null);

  const today = new Date();
  const todayDay = dayOfYear(today);
  const todayPrompt = PROMPTS[todayDay - 1];

  // cargar identidad local
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("identity");
      setIdentity(raw ? JSON.parse(raw) : null);
    })();
  }, []);

  // suscripción en tiempo real a los datos de la pareja + push
  useEffect(() => {
    if (!identity) return;
    setupAndroidChannels();
    unsubRef.current = listenCouple(identity.code, setCouple);

    (async () => {
      const token = await registerForPushToken();
      if (token) {
        await updateCouple(identity.code, { [`members.${identity.role}.pushToken`]: token });
      }
    })();

    const sub = Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data;
      if (data?.type === "touch" && Array.isArray(data.pattern)) {
        Vibration.vibrate(data.pattern);
        setBanner({ title: notif.request.content.title, body: notif.request.content.body });
        setTimeout(() => setBanner(null), 4000);
      }
    });

    return () => {
      unsubRef.current && unsubRef.current();
      sub.remove();
    };
  }, [identity]);

  if (identity === undefined) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.loading}>Abriendo 365…</Text>
      </SafeAreaView>
    );
  }
  if (!identity) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <Onboarding onDone={setIdentity} />
      </SafeAreaView>
    );
  }

  const role = identity.role;
  const otherRole = role === "A" ? "B" : "A";
  const members = couple.members || {};
  const myName = members[role]?.name || identity.name;
  const otherName = members[otherRole]?.name;
  const days = couple.days || {};
  const touches = couple.touches || [];

  async function submitToday(text) {
    await updateCouple(identity.code, {
      [`days.${todayDay}.promptId`]: todayDay,
      [`days.${todayDay}.responses.${role}`]: { text, ts: Date.now() },
    });
  }

  async function sendTouch({ pattern, gestureId, phrase }) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: role, gestureId, pattern, phrase: phrase || "", ts: Date.now(),
    };
    const nextTouches = [...touches, entry].slice(-200);
    Vibration.vibrate(pattern.map((p) => Math.min(p, 60)));
    await updateCouple(identity.code, { touches: nextTouches });
    const toToken = members[otherRole]?.pushToken;
    if (toToken) {
      await sendTouchPush({ toPushToken: toToken, fromName: myName, gestureId, phrase });
    }
  }

  const todayEntry = days[todayDay];
  const both = !!(todayEntry?.responses?.A && todayEntry?.responses?.B);
  const myResponse = todayEntry?.responses?.[role];
  const partnerResponded = !!todayEntry?.responses?.[otherRole];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topbar}>
        <Text style={styles.brand}>365</Text>
        <View>
          <Text style={styles.topbarMeta}>{myName}{otherName ? ` · ${otherName}` : ""}</Text>
          <Text style={styles.topbarDim}>día {todayDay} de 365</Text>
        </View>
      </View>

      {banner && (
        <View style={styles.banner}>
          <Heart size={16} color="#1B1220" />
          <View>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerBody}>{banner.body}</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === "hoy" && (
          <HoyTab
            prompt={todayPrompt} myResponse={myResponse} partnerResponded={partnerResponded}
            both={both} entry={todayEntry} otherName={otherName} myName={myName} role={role}
            onSubmit={submitToday} onSendTouch={sendTouch} goToToques={() => setTab("toques")}
          />
        )}
        {tab === "toques" && (
          <ToquesTab onSend={sendTouch} otherName={otherName} touches={touches} role={role} members={members} />
        )}
        {tab === "boveda" && <BovedaTab days={days} members={members} todayDay={todayDay} />}
        {tab === "calendario" && (
          <CalendarioTab days={days} touches={touches} today={today} members={members} role={role} />
        )}
      </ScrollView>

      <View style={styles.tabbar}>
        {[
          { id: "hoy", label: "Hoy", Icon: Sparkles },
          { id: "toques", label: "Toques", Icon: Hand },
          { id: "boveda", label: "Bóveda", Icon: Archive },
          { id: "calendario", label: "Calendario", Icon: CalendarDays },
        ].map(({ id, label, Icon }) => (
          <TouchableOpacity key={id} style={styles.tab} onPress={() => setTab(id)}>
            <Icon size={19} color={tab === id ? C.rose : C.textDim} />
            <Text style={[styles.tabLabel, tab === id && { color: C.rose }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

/* ---------------- Onboarding ---------------- */
function Onboarding({ onDone }) {
  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [members, setMembers] = useState(null);
  const [name, setName] = useState("");
  const [pendingRole, setPendingRole] = useState(null);
  const [error, setError] = useState("");

  async function lookUp() {
    const clean = code.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) { setError("Escribí un código para su espacio."); return; }
    setError("");
    const existing = await getCouple(clean);
    setCode(clean);
    const m = existing?.members || { A: null, B: null };
    setMembers(m);
    if (!m.A && !m.B) { setPendingRole("A"); setStep("name"); }
    else setStep("choose");
  }

  async function chooseExisting(role) {
    const identity = { code, role, name: members[role].name };
    await AsyncStorage.setItem("identity", JSON.stringify(identity));
    onDone(identity);
  }

  function chooseNew() {
    const role = members.A && members.B ? null : (members.A ? "B" : "A");
    if (!role) { setError("Este código ya tiene dos personas."); return; }
    setPendingRole(role);
    setStep("name");
  }

  async function confirmName() {
    if (!name.trim()) { setError("Decinos cómo te llamamos."); return; }
    const role = pendingRole;
    const existing = await getCouple(code);
    if (existing) {
      await updateCouple(code, { [`members.${role}`]: { name: name.trim() } });
    } else {
      await createCouple(code, { members: { [role]: { name: name.trim() } }, days: {}, touches: [] });
    }
    const identity = { code, role, name: name.trim() };
    await AsyncStorage.setItem("identity", JSON.stringify(identity));
    onDone(identity);
  }

  return (
    <ScrollView contentContainerStyle={styles.onboarding}>
      <Text style={styles.onbMark}>365</Text>
      <Text style={styles.onbTag}>un espacio de a dos, un día a la vez</Text>

      {step === "code" && (
        <View style={styles.onbCard}>
          <Text style={styles.onbLabel}>Código de su espacio</Text>
          <Text style={styles.onbHint}>
            Inventen una palabra o frase corta que solo ustedes dos usen. La primera vez la crea, la segunda vez se une.
          </Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode}
            placeholder="ej: girasoles-2024" placeholderTextColor={C.textDim} autoCapitalize="none" />
          {!!error && <Text style={styles.onbError}>{error}</Text>}
          <TouchableOpacity style={styles.btnPrimary} onPress={lookUp}>
            <Text style={styles.btnPrimaryText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "choose" && members && (
        <View style={styles.onbCard}>
          <Text style={styles.onbLabel}>¿Quién sos?</Text>
          <Text style={styles.onbHint}>
            En este espacio ya hay {members.A && members.B ? "dos personas" : "alguien"}.
          </Text>
          {members.A && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => chooseExisting("A")}>
              <Text style={styles.btnSecondaryText}>Soy {members.A.name}</Text>
            </TouchableOpacity>
          )}
          {members.B && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => chooseExisting("B")}>
              <Text style={styles.btnSecondaryText}>Soy {members.B.name}</Text>
            </TouchableOpacity>
          )}
          {!(members.A && members.B) && (
            <TouchableOpacity style={styles.btnGhost} onPress={chooseNew}>
              <Text style={styles.btnGhostText}>Soy la otra persona</Text>
            </TouchableOpacity>
          )}
          {!!error && <Text style={styles.onbError}>{error}</Text>}
          <TouchableOpacity style={styles.backLink} onPress={() => setStep("code")}>
            <ArrowLeft size={14} color={C.textDim} />
            <Text style={styles.backLinkText}> volver</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "name" && (
        <View style={styles.onbCard}>
          <Text style={styles.onbLabel}>¿Cómo te llamamos?</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="tu nombre" placeholderTextColor={C.textDim} autoFocus />
          {!!error && <Text style={styles.onbError}>{error}</Text>}
          <TouchableOpacity style={styles.btnPrimary} onPress={confirmName}>
            <Text style={styles.btnPrimaryText}>Entrar a 365</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

/* ---------------- Hoy ---------------- */
function HoyTab({ prompt, myResponse, partnerResponded, both, entry, otherName, myName, role, onSubmit, onSendTouch, goToToques }) {
  const [text, setText] = useState(myResponse?.text || "");
  const [saved, setSaved] = useState(!!myResponse);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPhrase, setQuickPhrase] = useState("");
  const [quickSent, setQuickSent] = useState(null);
  const Icon = CAT_ICONS[prompt.category];
  const isMedia = prompt.category === "foto" || prompt.category === "sonido";
  const otherLabel = otherName || "tu pareja";

  async function handleSubmit() {
    if (!text.trim()) return;
    await onSubmit(text.trim());
    setSaved(true);
  }
  function quickFire(g) {
    onSendTouch({ pattern: g.pattern, gestureId: g.id, phrase: quickPhrase.trim() });
    setQuickSent(g.label);
    setQuickPhrase("");
    setTimeout(() => { setQuickSent(null); setQuickOpen(false); }, 1200);
  }

  return (
    <View>
      <TouchableOpacity style={styles.quickTouchBtn} onPress={() => setQuickOpen((v) => !v)}>
        <Heart size={16} color="#1B1220" />
        <Text style={styles.quickTouchText}>Enviar un toque con mensaje</Text>
      </TouchableOpacity>

      {quickOpen && (
        <View style={styles.quickPanel}>
          <TextInput style={styles.phraseInput} value={quickPhrase} onChangeText={setQuickPhrase}
            placeholder="mensaje o emoji (opcional)" placeholderTextColor={C.textDim} maxLength={60} />
          <View style={styles.gestureRow}>
            {GESTURES.map((g) => (
              <TouchableOpacity key={g.id} style={styles.gestureBtn} onPress={() => quickFire(g)}>
                <Text style={styles.gestureBtnText}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {quickSent && (
            <View style={styles.sentFlash}>
              <Send size={13} color={C.gold} />
              <Text style={styles.sentFlashText}> enviado: {quickSent}</Text>
            </View>
          )}
          <TouchableOpacity onPress={goToToques}>
            <Text style={styles.linkText}>ver todos los gestos y el historial →</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.promptCard}>
        <View style={styles.promptTop}>
          <Icon size={17} color="#6B5A3E" />
          <Text style={styles.promptTopText}>{prompt.label}</Text>
          <Text style={styles.promptDay}>día {prompt.day}</Text>
        </View>
        <Text style={styles.promptText}>{prompt.text}</Text>
        {isMedia && (
          <Text style={styles.promptNote}>
            Este campo no sube fotos/audios reales — describí con palabras lo que elegirías.
          </Text>
        )}
      </View>

      {!saved ? (
        <View style={{ marginBottom: 16 }}>
          <TextInput style={styles.textarea} value={text} onChangeText={setText}
            placeholder="Escribí tu respuesta…" placeholderTextColor={C.textDim} multiline numberOfLines={5} />
          <TouchableOpacity style={[styles.btnPrimary, !text.trim() && styles.btnDisabled]}
            disabled={!text.trim()} onPress={handleSubmit}>
            <Text style={styles.btnPrimaryText}>Guardar respuesta de hoy</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.responseSaved}>
          <Check size={16} color={C.gold} />
          <Text style={styles.responseSavedText}>
            {" "}Ya respondiste hoy{partnerResponded ? "" : `, falta ${otherLabel}`}.
          </Text>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <View style={styles.answerPanel}>
          <Text style={styles.revealName}>{myName}</Text>
          {saved
            ? <Text style={styles.answerText}>{entry.responses[role].text}</Text>
            : <Text style={styles.emptyHint}>Todavía no respondiste hoy.</Text>}
        </View>
        <View style={[styles.answerPanel, !both && styles.answerPanelLocked]}>
          <Text style={styles.revealName}>{otherLabel}</Text>
          {both
            ? <Text style={styles.answerText}>{entry.responses[role === "A" ? "B" : "A"].text}</Text>
            : <Text style={styles.emptyHint}>
                🔒 {partnerResponded ? "Ya respondió, se revela cuando vos también respondas." : "Se revela cuando las dos respondan."}
              </Text>}
        </View>
      </View>
    </View>
  );
}

/* ---------------- Toques ---------------- */
function ToquesTab({ onSend, otherName, touches, role, members }) {
  const [phrase, setPhrase] = useState("");
  const [holding, setHolding] = useState(false);
  const [sentFlash, setSentFlash] = useState(null);
  const holdStart = useRef(null);

  function startHold() { holdStart.current = Date.now(); setHolding(true); }
  function endHold() {
    if (!holdStart.current) return;
    const dur = Math.min(2400, Date.now() - holdStart.current);
    holdStart.current = null;
    setHolding(false);
    if (dur < 150) fire({ id: "toque", pattern: GESTURES[0].pattern, label: "Toque suave" });
    else fire({ id: "custom", pattern: [0, dur], label: `Caricia de ${(dur / 1000).toFixed(1)}s` });
  }
  function fire(g) {
    onSend({ pattern: g.pattern, gestureId: g.id, phrase: phrase.trim() });
    setSentFlash(g.label);
    setPhrase("");
    setTimeout(() => setSentFlash(null), 1800);
  }

  const recent = [...touches].slice(-8).reverse();

  return (
    <View>
      <Text style={styles.sectionLead}>Mandale a {otherName || "tu pareja"} algo que se sienta, no que se lea.</Text>

      <TouchableOpacity
        style={[styles.pad, holding && styles.padHolding]}
        onPressIn={startHold} onPressOut={endHold} activeOpacity={0.9}
      >
        <Hand size={28} color={C.text} />
        <Text style={styles.padText}>{holding ? "sosteniendo…" : "tocá o mantené presionado"}</Text>
      </TouchableOpacity>

      <View style={styles.gestureRow}>
        {GESTURES.slice(1).map((g) => (
          <TouchableOpacity key={g.id} style={styles.gestureBtn} onPress={() => fire(g)}>
            <Text style={styles.gestureBtnText}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput style={styles.phraseInput} value={phrase} onChangeText={setPhrase}
        placeholder="una palabra o un emoji para acompañarlo (opcional)" placeholderTextColor={C.textDim} maxLength={60} />

      {sentFlash && (
        <View style={styles.sentFlash}>
          <Send size={14} color={C.gold} />
          <Text style={styles.sentFlashText}> enviado: {sentFlash}</Text>
        </View>
      )}

      <Text style={styles.vibrateNote}>
        Con la app abierta, ambas sienten el patrón exacto. Con la app cerrada: Android respeta el patrón, iOS usa la vibración estándar del sistema (así lo permite Apple).
      </Text>

      <Text style={styles.touchLogTitle}>Últimos toques</Text>
      {recent.length === 0 && <Text style={[styles.dim, styles.small]}>Todavía no se mandaron nada.</Text>}
      {recent.map((t) => (
        <View key={t.id} style={styles.touchRow}>
          <Heart size={13} color={C.rose} />
          <Text style={styles.touchRowText}>
            {" "}{members[t.from]?.name || (t.from === role ? "vos" : "tu pareja")}
            {t.phrase ? `  "${t.phrase}"` : ""}
            {"  "}
            <Text style={styles.dim}>{new Date(t.ts).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------- Bóveda ---------------- */
function BovedaTab({ days, members, todayDay }) {
  const entries = Object.values(days || {})
    .filter((e) => e.responses?.A && e.responses?.B && e.promptId <= todayDay)
    .sort((a, b) => b.promptId - a.promptId);

  return (
    <View>
      <Text style={styles.sectionLead}>
        {entries.length === 0
          ? "Acá se van a ir guardando los días en que las dos respondieron."
          : `${entries.length} día${entries.length === 1 ? "" : "s"} guardado${entries.length === 1 ? "" : "s"} en la bóveda.`}
      </Text>
      {entries.map((e) => {
        const prompt = PROMPTS[e.promptId - 1];
        const Icon = CAT_ICONS[prompt.category];
        return (
          <View key={e.promptId} style={styles.capsuleItem}>
            <View style={styles.capsuleItemHead}>
              <Icon size={14} color={C.gold} />
              <Text style={styles.capsuleItemHeadText}>{prompt.label}</Text>
              <Text style={[styles.dim, styles.small]}>día {e.promptId}</Text>
            </View>
            <Text style={styles.capsuleItemPrompt}>{prompt.text}</Text>
            <View style={{ gap: 8 }}>
              <View style={styles.capsulePairItem}>
                <Text style={styles.revealName}>{members.A?.name || "A"}</Text>
                <Text style={styles.answerText}>{e.responses.A.text}</Text>
              </View>
              <View style={styles.capsulePairItem}>
                <Text style={styles.revealName}>{members.B?.name || "B"}</Text>
                <Text style={styles.answerText}>{e.responses.B.text}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------------- Calendario ---------------- */
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const WEEKDAYS = ["L","M","M","J","V","S","D"];
const CELL = (Dimensions.get("window").width - 40 - 24) / 7;

function intensityBucket(n) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  return 4;
}
const HEAT_COLORS = [C.panel, "#5C3550", "#8A3F5C", "#C24F6A", C.rose];

function CalendarioTab({ days, touches, today, members, role }) {
  const year = today.getFullYear();
  const [view, setView] = useState("consignas");

  const statusForDoy = (doy) => {
    const e = days[doy];
    if (e?.responses?.A && e?.responses?.B) return "both";
    if (e?.responses?.A || e?.responses?.B) return "one";
    return "none";
  };

  let bothCount = 0;
  Object.keys(days || {}).forEach((k) => { if (statusForDoy(Number(k)) === "both") bothCount++; });
  let streak = 0;
  const todayDoy = dayOfYear(today);
  for (let d = todayDoy; d >= 1; d--) { if (statusForDoy(d) === "both") streak++; else break; }

  const touchCountByDate = {};
  (touches || []).forEach((t) => {
    const k = dateKey(new Date(t.ts));
    touchCountByDate[k] = touchCountByDate[k] || { total: 0, A: 0, B: 0 };
    touchCountByDate[k].total++;
    touchCountByDate[k][t.from]++;
  });

  const touchesThisMonth = (touches || []).filter((t) => {
    const d = new Date(t.ts);
    return d.getFullYear() === year && d.getMonth() === today.getMonth();
  });
  const sentByMe = touchesThisMonth.filter((t) => t.from === role).length;
  const sentByHer = touchesThisMonth.length - sentByMe;

  let busiestDay = null, busiestCount = 0;
  Object.entries(touchCountByDate).forEach(([k, v]) => { if (v.total > busiestCount) { busiestCount = v.total; busiestDay = k; } });

  return (
    <View>
      <View style={styles.viewToggle}>
        <TouchableOpacity style={[styles.viewToggleBtn, view === "consignas" && styles.viewToggleBtnActive]} onPress={() => setView("consignas")}>
          <Text style={[styles.viewToggleText, view === "consignas" && styles.viewToggleTextActive]}>Consignas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewToggleBtn, view === "toques" && styles.viewToggleBtnActive]} onPress={() => setView("toques")}>
          <Text style={[styles.viewToggleText, view === "toques" && styles.viewToggleTextActive]}>Toques</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsRow}>
        {view === "consignas" ? (
          <>
            <Metric icon={<Flame size={16} color={C.rose} />} value={streak} label="racha actual" />
            <Metric icon={<Check size={16} color={C.rose} />} value={bothCount} label="días completos" />
            <Metric icon={<Hand size={16} color={C.rose} />} value={touchesThisMonth.length} label="toques este mes" />
          </>
        ) : (
          <>
            <Metric icon={<Hand size={16} color={C.rose} />} value={touchesThisMonth.length} label="toques este mes" />
            <Metric icon={<Heart size={16} color={C.rose} />} value={`${sentByMe}/${sentByHer}`} label="vos / ella" />
            <Metric icon={<Sparkles size={16} color={C.rose} />} value={busiestCount} label="máx. en un día" />
          </>
        )}
      </View>

      {MONTH_NAMES.map((mName, mIdx) => {
        const firstOfMonth = new Date(year, mIdx, 1);
        if (firstOfMonth > today) return null;
        const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
        const startWeekday = (firstOfMonth.getDay() + 6) % 7;
        const cells = [];
        for (let i = 0; i < startWeekday; i++) cells.push(null);
        for (let dNum = 1; dNum <= daysInMonth; dNum++) {
          const d = new Date(year, mIdx, dNum);
          if (d > today) { cells.push({ future: true }); continue; }
          const doy = dayOfYear(d);
          const tc = touchCountByDate[dateKey(d)];
          cells.push({
            doy, status: statusForDoy(doy), touchCount: tc?.total || 0,
            isToday: dateKey(d) === dateKey(today),
          });
        }
        return (
          <View key={mName} style={{ marginBottom: 20 }}>
            <Text style={styles.monthName}>{mName}</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekdayText}>{w}</Text>)}
            </View>
            <View style={styles.monthGrid}>
              {cells.map((c, i) => {
                if (!c) return <View key={i} style={[styles.dayCell, { backgroundColor: "transparent", borderWidth: 0 }]} />;
                if (c.future) return <View key={i} style={[styles.dayCell, styles.dayCellFuture]} />;
                const bg = view === "consignas"
                  ? (c.status === "both" ? C.gold : c.status === "one" ? C.roseDim : C.panel)
                  : HEAT_COLORS[intensityBucket(c.touchCount)];
                return (
                  <View key={i} style={[styles.dayCell, { backgroundColor: bg }, c.isToday && styles.dayCellToday]}>
                    {view === "consignas" && c.touchCount > 0 && <View style={styles.touchDot} />}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.legend}>
        {view === "consignas" ? (
          <>
            <LegendItem color={C.gold} label="las dos respondieron" />
            <LegendItem color={C.roseDim} label="respondió una" />
          </>
        ) : (
          <>
            <LegendItem color={HEAT_COLORS[0]} label="0" />
            <LegendItem color={HEAT_COLORS[1]} label="1–2" />
            <LegendItem color={HEAT_COLORS[2]} label="3–4" />
            <LegendItem color={HEAT_COLORS[3]} label="5–7" />
            <LegendItem color={HEAT_COLORS[4]} label="8+" />
          </>
        )}
      </View>
    </View>
  );
}

function Metric({ icon, value, label }) {
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/* ---------------- estilos ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },
  loading: { color: C.textDim, textAlign: "center", marginTop: 60, fontSize: 16 },

  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  brand: { fontSize: 22, fontWeight: "700", color: C.gold },
  topbarMeta: { fontSize: 12, color: C.textDim },
  topbarDim: { fontSize: 11, color: "#8A7A9C" },

  banner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.rose, marginHorizontal: 16, borderRadius: 14, padding: 12 },
  bannerTitle: { fontWeight: "700", fontSize: 13, color: "#1B1220" },
  bannerBody: { fontSize: 12, color: "#1B1220" },

  content: { flex: 1, paddingHorizontal: 20 },

  onboarding: { padding: 24, alignItems: "center", flexGrow: 1, justifyContent: "center" },
  onbMark: { fontSize: 52, fontWeight: "700", color: C.gold },
  onbTag: { color: C.textDim, marginBottom: 28, fontSize: 14 },
  onbCard: { width: "100%", backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 22 },
  onbLabel: { fontSize: 18, color: C.text, fontWeight: "600", marginBottom: 6 },
  onbHint: { color: C.textDim, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  onbError: { color: C.rose, fontSize: 13, marginBottom: 10 },
  backLink: { flexDirection: "row", alignItems: "center", marginTop: 8, alignSelf: "flex-start" },
  backLinkText: { color: C.textDim, fontSize: 13 },

  input: { backgroundColor: C.ink, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, fontSize: 15, marginBottom: 12 },

  btnPrimary: { backgroundColor: C.rose, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  btnPrimaryText: { color: "#1B1220", fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  btnSecondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  btnSecondaryText: { color: C.text, fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 10, padding: 12 },
  btnGhostText: { color: C.textDim, fontSize: 14 },

  sectionLead: { color: C.textDim, fontSize: 13, marginBottom: 16 },

  quickTouchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.rose, borderRadius: 14, paddingVertical: 13, marginBottom: 10 },
  quickTouchText: { color: "#1B1220", fontWeight: "700", fontSize: 14 },
  quickPanel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 16 },
  linkText: { color: C.textDim, fontSize: 11, marginTop: 6 },

  promptCard: { backgroundColor: C.parchment, borderRadius: 20, padding: 22, marginBottom: 16 },
  promptTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  promptTopText: { fontSize: 12, fontWeight: "700", color: "#6B5A3E" },
  promptDay: { marginLeft: "auto", color: "#9C8B6E", fontSize: 12 },
  promptText: { fontSize: 20, lineHeight: 27, marginTop: 12, fontStyle: "italic", color: "#241B2F" },
  promptNote: { fontSize: 12, color: "#8A7355", marginTop: 12 },

  textarea: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, color: C.text, fontSize: 14, minHeight: 100, marginBottom: 10, textAlignVertical: "top" },
  responseSaved: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(217,169,78,0.1)", borderRadius: 12, padding: 12, marginBottom: 16 },
  responseSavedText: { color: C.gold, fontSize: 13 },

  answerPanel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.gold, borderRadius: 14, padding: 12 },
  answerPanelLocked: { borderColor: C.border, opacity: 0.8 },
  revealName: { fontSize: 11, color: C.rose, fontWeight: "700" },
  answerText: { fontSize: 14, color: C.text, marginTop: 4, lineHeight: 20 },
  emptyHint: { fontSize: 12, color: C.textDim, fontStyle: "italic", marginTop: 4 },

  pad: { width: "100%", aspectRatio: 1.7, borderRadius: 22, backgroundColor: C.roseDim, alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  padHolding: { backgroundColor: C.rose },
  padText: { color: C.textDim, fontSize: 12 },
  gestureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  gestureBtn: { flexGrow: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  gestureBtnText: { color: C.text, fontSize: 12 },
  phraseInput: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 13, marginBottom: 10 },
  sentFlash: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sentFlashText: { color: C.gold, fontSize: 12 },
  vibrateNote: { color: "#8A7A9C", fontSize: 11, lineHeight: 16, marginBottom: 18 },
  touchLogTitle: { fontSize: 12, color: C.textDim, marginBottom: 8, fontWeight: "700" },
  touchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  touchRowText: { color: C.text, fontSize: 12 },

  capsuleItem: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  capsuleItemHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  capsuleItemHeadText: { color: C.gold, fontSize: 12 },
  capsuleItemPrompt: { fontStyle: "italic", fontSize: 13, color: C.textDim, marginBottom: 10 },
  capsulePairItem: { backgroundColor: C.ink, borderRadius: 10, padding: 10 },

  viewToggle: { flexDirection: "row", backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3, marginBottom: 14 },
  viewToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  viewToggleBtnActive: { backgroundColor: C.rose },
  viewToggleText: { color: C.textDim, fontSize: 12 },
  viewToggleTextActive: { color: "#1B1220", fontWeight: "700" },

  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  metric: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 4 },
  metricValue: { fontSize: 20, color: C.text, fontWeight: "700" },
  metricLabel: { fontSize: 10, color: C.textDim, textAlign: "center" },

  monthName: { fontSize: 13, color: C.gold, marginBottom: 6, textTransform: "capitalize" },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayText: { width: CELL, fontSize: 9, color: "#8A7A9C", textAlign: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: CELL, height: CELL, margin: 2, borderRadius: 6, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, alignItems: "flex-end", justifyContent: "flex-end" },
  dayCellFuture: { backgroundColor: "transparent", borderStyle: "dashed", opacity: 0.4 },
  dayCellToday: { borderColor: C.text, borderWidth: 2 },
  touchDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.text, marginBottom: 2, marginRight: 2 },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6, paddingBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11, color: C.textDim },

  tabbar: { flexDirection: "row", backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 8, paddingBottom: Platform.OS === "ios" ? 20 : 8 },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 10, color: C.textDim },

  dim: { color: C.textDim },
  small: { fontSize: 11 },
});
