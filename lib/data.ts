export type Severity = "critical" | "high" | "medium" | "low";

export interface ChatMsg {
  id: string;
  from: string;
  mine: boolean;
  kind: "text" | "voice";
  text?: string;
  secs?: number;
  time: string;
}
export interface Report {
  id: string;
  title: string;
  body: string;
  type: "anomaly" | "news";
  severity: Severity;
  author: string;
  time: string;
}
export interface Alert {
  id: string;
  text: string;
  from: string;
  time: string;
}
export interface Threat {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  region: string;
  vector: string;
}
export interface Agent {
  codename: string;
  role: "OFFICER" | "SOLDIER";
  status: "active" | "standby" | "offline";
  deployment: string;
  lastSeen: string;
}
export interface Profile {
  avatar: string;
  bio: string;
}
export interface ProxyConfig {
  enabled: boolean;
  type: "http" | "https" | "socks5";
  host: string;
  port: string;
}

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ff3b3b",
  high: "#ffb020",
  medium: "#00e5ff",
  low: "#00ff41",
};

export const AVATARS = ["🦅", "🕶️", "🛰️", "🧠", "💀", "🐺", "🎯", "⚡"];

export const EMPTY_PROFILE: Profile = { avatar: "🦅", bio: "" };
export const DEFAULT_PROXY: ProxyConfig = { enabled: false, type: "socks5", host: "", port: "" };

export const SEED_CHAT: ChatMsg[] = [
  { id: "c1", from: "EAGLE-1", mine: false, kind: "text", text: "Channel secured. All units report.", time: "09:02" },
  { id: "c2", from: "RAVEN-4", mine: false, kind: "text", text: "Sector 7 clear. Standing by.", time: "09:04" },
];

export const SEED_REPORTS: Report[] = [
  { id: "r1", title: "Anomalous DNS tunnelling detected", body: "Repeated high-entropy TXT queries from an unmanaged host in the eastern subnet. Containment recommended.", type: "anomaly", severity: "critical", author: "EAGLE-1", time: "08:41" },
  { id: "r2", title: "Credential dump advertised on dark forum", body: "A seller claims 40k regional telecom accounts. Sample under verification.", type: "news", severity: "high", author: "RAVEN-4", time: "07:55" },
  { id: "r3", title: "Unusual login geography", body: "Three admin logins from a previously unseen ASN within 10 minutes.", type: "anomaly", severity: "medium", author: "VIPER-2", time: "06:30" },
];

export const SEED_ALERTS: Alert[] = [{ id: "a1", text: "Rotate all channel keys before 18:00.", from: "EAGLE-1", time: "08:00" }];

export const SEED_THREATS: Threat[] = [
  { id: "t1", lat: 40.7, lng: -74, severity: "critical", region: "New York", vector: "Ransomware C2" },
  { id: "t2", lat: 55.7, lng: 37.6, severity: "high", region: "Moscow", vector: "Botnet DDoS" },
  { id: "t3", lat: 24.7, lng: 46.7, severity: "medium", region: "Riyadh", vector: "Phishing wave" },
  { id: "t4", lat: 1.35, lng: 103.8, severity: "low", region: "Singapore", vector: "Port scanning" },
  { id: "t5", lat: 6.5, lng: 3.4, severity: "high", region: "Lagos", vector: "Credential stuffing" },
  { id: "t6", lat: 39.9, lng: 116.4, severity: "critical", region: "Beijing", vector: "APT intrusion" },
  { id: "t7", lat: -23.5, lng: -46.6, severity: "medium", region: "Sao Paulo", vector: "Data exfiltration" },
  { id: "t8", lat: 51.5, lng: -0.1, severity: "low", region: "London", vector: "Malware dropper" },
];

export interface Mission {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  owner: string;
}
export const SEED_MISSIONS: Mission[] = [
  { id: "m1", title: "Trace the DNS tunnel source in the eastern subnet", status: "doing", owner: "RAVEN-4" },
  { id: "m2", title: "Verify the leaked credential sample", status: "todo", owner: "VIPER-2" },
  { id: "m3", title: "Rotate channel keys", status: "done", owner: "EAGLE-1" },
];

export const GHOST_NODES = ["Reykjavik", "Zurich", "Tallinn", "Singapore", "Montevideo", "Oslo", "Tbilisi"];

export const AGENTS: Agent[] = [
  { codename: "EAGLE-1", role: "OFFICER", status: "active", deployment: "Command Center", lastSeen: "now" },
  { codename: "RAVEN-4", role: "SOLDIER", status: "active", deployment: "Sector 7 — Recon", lastSeen: "now" },
  { codename: "VIPER-2", role: "SOLDIER", status: "active", deployment: "SOC Watch", lastSeen: "2m" },
  { codename: "GHOST-9", role: "SOLDIER", status: "standby", deployment: "Reserve — Alpha", lastSeen: "14m" },
  { codename: "FALCON-3", role: "OFFICER", status: "standby", deployment: "Liaison Cell", lastSeen: "31m" },
  { codename: "NOMAD-6", role: "SOLDIER", status: "offline", deployment: "Field — Northern Route", lastSeen: "3h" },
];

export const nowHHMM = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const uid = () => Math.random().toString(36).slice(2, 10);
