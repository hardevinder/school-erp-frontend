// src/socket.js
import { io } from "socket.io-client";

/** Always read fresh values from storage (in case they change after login/renewal) */
function getToken() {
  return localStorage.getItem("token");
}
function getAdmissionNumber() {
  return localStorage.getItem("admissionNumber");
}

/** Base URL for your API/Socket.IO server */
const BASE_URL = process.env.REACT_APP_API_URL;

/** Create the socket */
const socket = io(BASE_URL, {
  transports: ["websocket"],           // prefer websocket
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  auth: { token: getToken() },         // send JWT in auth payload
  // If your backend expects token in query, you can keep this as well:
  // query: { token: getToken() },
});

/** ------- Connection lifecycle & auth refresh ------- */
socket.on("connect", () => {
  const admissionNumber = getAdmissionNumber();
  if (admissionNumber) {
    // Your existing registration step
    socket.emit("register", admissionNumber);
    console.log("[socket] Registered with admission number:", admissionNumber);
  } else {
    console.warn("[socket] No admission number found.");
  }
  console.debug("[socket] connected:", socket.id);
});

socket.on("reconnect_attempt", (attempt) => {
  // Refresh token before each reconnect attempt
  socket.auth = { token: getToken() };
  // socket.io v4: if you use query token instead, also refresh:
  // socket.io.opts.query = { token: getToken() };
  console.debug("[socket] reconnect_attempt:", attempt);
});

socket.on("connect_error", (err) => {
  console.warn("[socket] connect_error:", err?.message || err);
});

socket.on("disconnect", (reason) => {
  console.debug("[socket] disconnected:", reason);
});

/** ------- Existing fee-notification listener (unchanged) ------- */
socket.on("fee-notification", (data) => {
  console.log("[socket] fee-notification:", data);
  alert(`${data.title}\n${data.message}`);
});

/** ==============================================================
 *                          CHAT HELPERS
 *  These are lightweight wrappers so React components can
 *  subscribe/unsubscribe cleanly without leaking listeners.
 *  Adjust event names if your backend uses different ones.
 *===============================================================*/

/** Subscribe to a new chat message */
export function onChatNew(handler) {
  socket.on("chat:new", handler);
  return () => socket.off("chat:new", handler);
}

/** Subscribe to delivery acks for optimistic sends */
export function onChatDelivered(handler) {
  socket.on("chat:delivered", handler);
  return () => socket.off("chat:delivered", handler);
}

/** Subscribe to contacts list pushes from server (optional) */
export function onContactsUpdate(handler) {
  socket.on("contacts:update", handler);
  return () => socket.off("contacts:update", handler);
}

/** Typing indicators (optional) */
export function onTyping(handler) {
  socket.on("chat:typing", handler);
  return () => socket.off("chat:typing", handler);
}
export function emitTyping({ to, isTyping }) {
  socket.emit("chat:typing", { to, isTyping });
}

/** Join a user-specific chat room if your backend expects it (optional) */
export function joinChatRoom(userId) {
  if (!userId) return;
  socket.emit("chat:join", { userId: String(userId) });
}

/** Optional read-receipt emit (only if your backend supports it) */
export function emitReadReceipt({ contactId, messageId }) {
  socket.emit("chat:seen", { contactId: String(contactId), messageId });
}

/** Optional: expose a safe teardown (avoid if socket is shared app-wide) */
export function teardownSocket() {
  socket.removeAllListeners();
  socket.disconnect();
}

/** Keep global for debugging (remove in production) */
if (typeof window !== "undefined") {
  window.socket = socket;
}

export default socket;
