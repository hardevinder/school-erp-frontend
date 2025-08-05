import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";
import {
  FaArrowLeft,
  FaPaperPlane,
  FaEdit,
  FaTrash,
  FaPaperclip,
  FaThumbsUp,
  FaRegSmile,
  FaReply,
} from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const REACTIONS = [
  { id: "like", icon: <FaThumbsUp /> },
  { id: "love", icon: <span role="img" aria-label="love">❤️</span> },
  { id: "laugh", icon: <span role="img" aria-label="laugh">😂</span> },
  { id: "surprised", icon: <span role="img" aria-label="surprised">😮</span> },
  { id: "sad", icon: <span role="img" aria-label="sad">😢</span> },
  { id: "angry", icon: <span role="img" aria-label="angry">😡</span> },
];

const styles = {
  container: (hideHeader) => ({
    display: "flex",
    height: hideHeader ? "100%" : "100vh",
    width: "100%",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  }),
  sidebar: {
    width: "30%",
    borderRight: "1px solid #ddd",
    padding: "20px",
    overflowY: "auto",
    backgroundColor: "#f8f9fa",
    maxHeight: "100vh",
  },
  sidebarItem: (active, hasUnread) => ({
    padding: "12px",
    cursor: "pointer",
    backgroundColor: active ? "#e9ecef" : hasUnread ? "#ffcccc" : "transparent",
    borderBottom: "1px solid #eee",
    borderRadius: "6px",
    marginBottom: "8px",
    fontWeight: hasUnread ? "bold" : "normal",
    borderLeft: hasUnread ? "5px solid red" : "none",
  }),
  chatArea: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    maxHeight: "100vh",
  },
  header: {
    position: "sticky",
    top: 0,
    padding: "16px",
    background: "#2575fc",
    color: "#fff",
    zIndex: 2,
  },
  backButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#fff",
    fontSize: "1rem",
    marginRight: "0.5rem",
  },
  classHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#2575fc",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "4px",
    marginTop: "16px",
    marginBottom: "8px",
    fontWeight: "bold",
  },
  broadcastButton: {
    padding: "4px 8px",
    fontSize: "0.8rem",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#fff",
    color: "#2575fc",
    cursor: "pointer",
  },
  searchInput: {
    width: "100%",
    padding: "12px",
    borderRadius: "30px",
    border: "1px solid #ccc",
    outline: "none",
    marginBottom: "20px",
  },
  // Increased paddingBottom to 150px to ensure extra space
  messagesContainer: {
    flexGrow: 1,
    overflowY: "auto",
    backgroundColor: "#f1f3f5",
    padding: "20px",
    paddingBottom: "150px",
    maxHeight: "100vh",
  },
  messageBubble: (isCurrentUser, extraStyle = {}) => ({
    backgroundColor: isCurrentUser ? "#DCF8C6" : "#FFFFFF",
    alignSelf: isCurrentUser ? "flex-end" : "flex-start",
    padding: "10px",
    borderRadius: "10px",
    marginBottom: "8px",
    maxWidth: "80%",
    marginLeft: isCurrentUser ? "20px" : "0",
    marginRight: isCurrentUser ? "0" : "20px",
    position: "relative",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    ...extraStyle,
  }),
  iconContainer: {
    display: "flex",
    gap: "10px",
    position: "absolute",
    top: "5px",
    right: "5px",
  },
  editInput: {
    padding: "6px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    marginRight: "5px",
    width: "60%",
  },
  editButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#3085d6",
    color: "#fff",
    cursor: "pointer",
    marginRight: "5px",
  },
  cancelButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#d33",
    color: "#fff",
    cursor: "pointer",
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    backgroundColor: "#f8f9fa",
    borderTop: "1px solid #ddd",
    position: "sticky",
    bottom: 0,
    zIndex: 1,
  },
  messageInput: {
    flexGrow: 1,
    padding: "8px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
    marginRight: "8px",
    maxWidth: "calc(100% - 100px)",
  },
  sendButton: {
    marginLeft: "10px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "20px",
    backgroundColor: "#6a11cb",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  attachmentButton: {
    marginLeft: "10px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "20px",
    backgroundColor: "#6a11cb",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  lastMessage: {
    fontSize: "0.8rem",
    color: "#999",
    marginTop: "4px",
  },
  timestamp: {
    fontSize: "0.7rem",
    color: "#999",
    marginTop: "4px",
  },
  reactionOptions: {
    display: "flex",
    gap: "5px",
    position: "absolute",
    bottom: "120%",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    padding: "5px",
    border: "1px solid #ccc",
    borderRadius: "5px",
    zIndex: 10,
  },
  reactionSummary: {
    display: "flex",
    gap: "5px",
    marginTop: "4px",
    fontSize: "0.8rem",
    color: "#666",
  },
};

const ChatContainer = ({ currentUserId, hideHeader = false, onSelectContactName }) => {
  const [contacts, setContacts] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeRecipient, setActiveRecipient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  // New ref for the messages container
  const messagesContainerRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeChatUnreadCount, setActiveChatUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  const [visibleReactions, setVisibleReactions] = useState({});
  const fileInputRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && activeChatId && activeRecipient) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isMobile, activeChatId, activeRecipient]);

  const currentUserRole = localStorage.getItem("userRole");
  const currentUserName = localStorage.getItem("userName") || "Chat Message";
  const [studentClass, setStudentClass] = useState("");
  const [groupedContacts, setGroupedContacts] = useState({});

  useEffect(() => {
    if (currentUserRole === "student") {
      fetch(`${API_URL}/students/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.student && data.student.Class) {
            setStudentClass(data.student.Class.class_name);
          }
        })
        .catch((err) => console.error("Error fetching student info:", err));
    }
  }, [currentUserRole]);

  useEffect(() => {
    async function autoOpenGroup() {
      if (currentUserRole === "student" && studentClass && !activeChatId) {
        await openGroupChat(studentClass);
      }
    }
    autoOpenGroup();
  }, [currentUserRole, studentClass, activeChatId]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    if (timestamp.toDate) return timestamp.toDate().toLocaleString();
    return new Date(timestamp).toLocaleString();
  };

  const markChatAsRead = async (chatId) => {
    const chatDocRef = doc(firestore, "chats", chatId);
    const chatDocSnap = await getDoc(chatDocRef);
    if (chatDocSnap.exists()) {
      await updateDoc(chatDocRef, {
        [`unreadCounts.${currentUserId}`]: 0,
        [`lastRead.${currentUserId}`]: serverTimestamp(),
      });
      setLastReadTimestamp(Date.now());
    }
  };

  const updateChatDocument = async (chatDocRef, messageContent) => {
    const chatDocSnap = await getDoc(chatDocRef);
    if (!chatDocSnap.exists()) {
      const participants = [String(currentUserId), String(activeRecipient?.id)].filter(Boolean);
      const unreadCounts = {};
      participants.forEach((p) => {
        if (p !== String(currentUserId)) unreadCounts[p] = 1;
      });
      await setDoc(chatDocRef, {
        participants,
        lastMessageTimestamp: serverTimestamp(),
        lastMessage: messageContent,
        unreadCounts,
      });
    } else {
      const chatData = chatDocSnap.data();
      const participants = chatData.participants || [String(currentUserId), String(activeRecipient?.id)].filter(Boolean);
      const unreadUpdate = {};
      participants.forEach((p) => {
        if (p !== String(currentUserId)) {
          unreadUpdate[`unreadCounts.${p}`] = chatData.unreadCounts && chatData.unreadCounts[p]
            ? increment(1)
            : 1;
        }
      });
      await updateDoc(chatDocRef, {
        lastMessageTimestamp: serverTimestamp(),
        lastMessage: messageContent,
        ...unreadUpdate,
      });
    }
  };

  const replicateGroupMessage = async (messagePayload) => {
    const groupChatId = activeChatId;
    const groupChatRef = doc(firestore, "chats", groupChatId);
    const groupDocSnap = await getDoc(groupChatRef);
    if (groupDocSnap.exists()) {
      const groupData = groupDocSnap.data();
      const participants = groupData.participants || [];
      await Promise.all(
        participants.map(async (participantId) => {
          if (participantId === String(currentUserId)) return;
          const personalChatId = [String(currentUserId), participantId].sort().join("-");
          const personalChatDocRef = doc(firestore, "chats", personalChatId);
          const updateContent = messagePayload.text || messagePayload.fileName || "";
          await updateChatDocument(personalChatDocRef, updateContent);
          const personalMessagesRef = collection(firestore, "chats", personalChatId, "messages");
          await addDoc(personalMessagesRef, {
            ...messagePayload,
            groupForward: false,
            originalGroupId: groupChatId,
          });
        })
      );
    }
  };

  useEffect(() => {
    if (!currentUserRole) {
      setError("User role not defined. Please log in again.");
      return;
    }
    setLoading(true);
    if (currentUserRole === "teacher") {
      fetch(`https://erp.sirhindpublicschool.com:3000/teacher-students/students`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((res) => res.json())
        .then(async (data) => {
          const apiStudents = data?.students?.map((student) => ({
            id: student.id,
            ...student,
          })) || [];
          const snapshot = await getDocs(collection(firestore, "users"));
          const firebaseUsers = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          const mappedStudents = apiStudents
            .filter(student => student.User && student.User.id)
            .map((student) => {
              const matchingUser = firebaseUsers.find(
                (user) => String(user.id) === String(student.User.id)
              );
              return matchingUser
                ? { ...student, id: matchingUser.id }
                : { ...student, id: String(student.User.id) };
            });
          
          const studentsWithChat = await Promise.all(
            mappedStudents.map(async (student) => {
              const chatId = [String(currentUserId), String(student.id)].sort().join("-");
              const chatDocSnap = await getDoc(doc(firestore, "chats", chatId));
              if (chatDocSnap.exists()) {
                const chatData = chatDocSnap.data();
                return {
                  ...student,
                  lastMessage: chatData.lastMessage || "",
                  lastMessageTimestamp: chatData.lastMessageTimestamp ? chatData.lastMessageTimestamp.toMillis() : null,
                  unreadCount: chatData.unreadCounts ? chatData.unreadCounts[String(currentUserId)] || 0 : 0,
                };
              }
              return { ...student, lastMessage: "", lastMessageTimestamp: null, unreadCount: 0 };
            })
          );
          const groups = studentsWithChat.reduce((acc, student) => {
            const className = student.Class?.class_name || "Unknown";
            if (!acc[className]) acc[className] = [];
            acc[className].push(student);
            return acc;
          }, {});
          Object.keys(groups).forEach((className) => {
            groups[className].sort((a, b) => {
              if (a.lastMessageTimestamp === b.lastMessageTimestamp) return 0;
              if (a.lastMessageTimestamp === null) return 1;
              if (b.lastMessageTimestamp === null) return -1;
              return b.lastMessageTimestamp - a.lastMessageTimestamp;
            });
          });
          setGroupedContacts(groups);
          setContacts(studentsWithChat);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching students:", err);
          setError("Failed to load students. Please try again later.");
          setLoading(false);
        });
    } else {
      getDocs(collection(firestore, "users"))
        .then(async (snapshot) => {
          const allUsers = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          let contactsList = allUsers.filter((user) => user.id !== currentUserId);
          contactsList = contactsList.filter((user) => user.role !== "student");
          const contactsWithChatInfo = await Promise.all(
            contactsList.map(async (contact) => {
              const chatId = [String(currentUserId), String(contact.id)].sort().join("-");
              const chatDocRef = doc(firestore, "chats", chatId);
              const chatDocSnap = await getDoc(chatDocRef);
              let lastMessageTimestamp = null;
              let lastMessage = "";
              let unreadCount = 0;
              if (chatDocSnap.exists()) {
                const chatData = chatDocSnap.data();
                lastMessageTimestamp = chatData.lastMessageTimestamp ? chatData.lastMessageTimestamp.toMillis() : null;
                lastMessage = chatData.lastMessage || "";
                unreadCount = chatData.unreadCounts ? chatData.unreadCounts[String(currentUserId)] || 0 : 0;
              }
              return { ...contact, chatId, lastMessageTimestamp, lastMessage, unreadCount };
            })
          );
          setContacts(contactsWithChatInfo);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching contacts:", err);
          setError("Failed to load contacts. Please try again later.");
          setLoading(false);
        });
    }
  }, [currentUserId, currentUserRole, studentClass]);

  useEffect(() => {
    const q = query(
      collection(firestore, "chats"),
      where("participants", "array-contains", String(currentUserId))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatDataMap = {};
      snapshot.forEach((doc) => {
        chatDataMap[doc.id] = doc.data();
      });
      setContacts((prevContacts) =>
        prevContacts.map((contact) => {
          const chatId = String(contact.id).startsWith("group-")
            ? String(contact.id)
            : [String(currentUserId), String(contact.id)].sort().join("-");
          if (chatDataMap[chatId]) {
            const chatData = chatDataMap[chatId];
            return {
              ...contact,
              lastMessage: chatData.lastMessage || "",
              lastMessageTimestamp: chatData.lastMessageTimestamp ? chatData.lastMessageTimestamp.toMillis() : null,
              unreadCount: chatData.unreadCounts ? chatData.unreadCounts[String(currentUserId)] || 0 : 0,
            };
          }
          return contact;
        })
      );
    });
    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserRole === "student" && studentClass) {
      const groupChatId = `group-${studentClass}`;
      const groupChatRef = doc(firestore, "chats", groupChatId);
      getDoc(groupChatRef).then((docSnap) => {
        if (!docSnap.exists()) {
          setDoc(groupChatRef, {
            participants: [String(currentUserId)],
            className: studentClass,
            createdAt: serverTimestamp(),
          });
        }
      });
      const unsubscribe = onSnapshot(groupChatRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const groupContact = {
            id: groupChatId,
            name: `Group - ${studentClass}`,
            lastMessage: data.lastMessage || "",
            lastMessageTimestamp: data.lastMessageTimestamp ? data.lastMessageTimestamp.toMillis() : null,
            unreadCount: data.unreadCounts ? data.unreadCounts[String(currentUserId)] || 0 : 0,
          };
          setContacts((prevContacts) => {
            const exists = prevContacts.find((c) => c.id === groupChatId);
            if (exists) {
              return prevContacts.map((c) => (c.id === groupChatId ? groupContact : c));
            } else {
              return [...prevContacts, groupContact];
            }
          });
        }
      });
      return () => unsubscribe();
    }
    if (currentUserRole === "teacher" && groupedContacts && Object.keys(groupedContacts).length > 0) {
      const unsubscribes = [];
      Object.keys(groupedContacts).forEach((className) => {
        const groupChatId = `group-${className}`;
        const groupChatRef = doc(firestore, "chats", groupChatId);
        getDoc(groupChatRef).then((docSnap) => {
          if (!docSnap.exists()) {
            setDoc(groupChatRef, {
              participants: groupedContacts[className].map((contact) => String(contact.id)).concat(String(currentUserId)),
              className,
              createdAt: serverTimestamp(),
            });
          }
        });
        const unsubscribe = onSnapshot(groupChatRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const groupContact = {
              id: groupChatId,
              name: `Group - ${className}`,
              lastMessage: data.lastMessage || "",
              lastMessageTimestamp: data.lastMessageTimestamp ? data.lastMessageTimestamp.toMillis() : null,
              unreadCount: data.unreadCounts ? data.unreadCounts[String(currentUserId)] || 0 : 0,
            };
            setContacts((prevContacts) => {
              const exists = prevContacts.find((c) => c.id === groupChatId);
              if (exists) {
                return prevContacts.map((c) => (c.id === groupChatId ? groupContact : c));
              } else {
                return [...prevContacts, groupContact];
              }
            });
          }
        });
        unsubscribes.push(unsubscribe);
      });
      return () => unsubscribes.forEach((unsub) => unsub());
    }
  }, [currentUserRole, studentClass, groupedContacts, currentUserId]);

  useEffect(() => {
    if (!activeChatId) {
      setLastReadTimestamp(null);
      return;
    }
    const chatDocRef = doc(firestore, "chats", activeChatId);
    const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lastRead && data.lastRead[currentUserId]) {
          setLastReadTimestamp(data.lastRead[currentUserId].toMillis());
        }
      }
    });
    return () => unsubscribe();
  }, [activeChatId, currentUserId]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const messagesRef = collection(firestore, "chats", activeChatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeChatId]);

  // Scroll the messages container with an extra offset every time messages update
  useEffect(() => {
    if (messagesContainerRef.current) {
      const extraOffset = 50; // Extra pixels to scroll beyond the bottom
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight + extraOffset,
        behavior: "smooth",
      });
    }
  }, [messages]);


  const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file || !activeChatId) return;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post(`${API_URL}/chat/upload`, formData);
    const fileUrl = response.data.url;

    const fileType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
      ? "audio"
      : "file"; 

    const messagesRef = collection(firestore, "chats", activeChatId, "messages");

    const messagePayload = {
      senderId: String(currentUserId),
      senderName: currentUserName,
      senderRole: currentUserRole,
      fileUrl,
      fileType,
      timestamp: serverTimestamp(),
      reactions: {},
      groupForward: activeChatId.startsWith("group-"),
    };

    await addDoc(messagesRef, messagePayload);

    // Optional: send FCM notification for file too
    if (!activeChatId.startsWith("group-")) {
      const parts = activeChatId.split("-");
      const receiverId = parts.find((id) => id !== String(currentUserId));

      const receiverDoc = await getDoc(doc(firestore, "users", receiverId));
      const fcmToken = receiverDoc.exists() ? receiverDoc.data().fcmToken : null;

      if (fcmToken) {
        await fetch(`${API_URL}/fcm/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fcmToken,
            title: currentUserName || "New File",
            body: "📎 Sent a file",
          }),
        });
      }
    }

  } catch (error) {
    console.error("❌ Error uploading file:", error);
  }
};


  const handleSendMessage = async () => {
  if (currentUserRole === "student" && activeChatId.startsWith("group-")) {
    return;
  }

  if (newMessage.trim() === "" || !activeChatId) return;

  try {
    const chatDocRef = doc(firestore, "chats", activeChatId);

    const replyToData = replyingTo
      ? {
          messageId: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId,
          senderName: replyingTo.senderName,
        }
      : null;

    await updateChatDocument(chatDocRef, newMessage);
    console.log("✅ Chat document updated");

    const messagesRef = collection(firestore, "chats", activeChatId, "messages");

    const messagePayload = {
      senderId: String(currentUserId),
      senderName: currentUserName,
      senderRole: currentUserRole,
      text: newMessage,
      timestamp: serverTimestamp(),
      reactions: {},
      replyTo: replyToData,
      groupForward: activeChatId.startsWith("group-"),
    };

    await addDoc(messagesRef, messagePayload);
    console.log("✅ Message added to Firestore");

    // 🔔 Only send notification for personal chat
    if (!activeChatId.startsWith("group-")) {
      const parts = activeChatId.split("-");
      const receiverId = parts.find((id) => id !== String(currentUserId));
      console.log("📨 Receiver ID:", receiverId);

      const receiverDoc = await getDoc(doc(firestore, "users", receiverId));
      const fcmToken = receiverDoc.exists() ? receiverDoc.data().fcmToken : null;
      console.log("📡 FCM Token:", fcmToken);

      if (fcmToken) {
        const response = await fetch(`${API_URL}/fcm/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fcmToken,
            title: currentUserName || "New Message",
            body: newMessage,
          }),
        });

        const result = await response.json();
        console.log("📬 Push Notification sent:", result);
      } else {
        console.warn("⚠️ No FCM token found for receiver:", receiverId);
      }
    }

    setNewMessage("");
    setReplyingTo(null);
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
};


  const handleSelectReaction = async (messageId, reaction) => {
    const messageDocRef = doc(firestore, "chats", activeChatId, "messages", messageId);
    const messageDocSnap = await getDoc(messageDocRef);
    if (messageDocSnap.exists()) {
      let reactions = messageDocSnap.data().reactions || {};
      if (reactions[String(currentUserId)] === reaction) {
        delete reactions[String(currentUserId)];
      } else {
        reactions[String(currentUserId)] = reaction;
      }
      await updateDoc(messageDocRef, { reactions });
    }
    setVisibleReactions((prev) => ({ ...prev, [messageId]: false }));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingMessageId) {
        handleUpdateMessage();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleUpdateMessage = async () => {
    if (!editingMessageText.trim() || !editingMessageId) return;
    try {
      const messageDocRef = doc(firestore, "chats", activeChatId, "messages", editingMessageId);
      await updateDoc(messageDocRef, {
        text: editingMessageText,
        timestamp: serverTimestamp(),
      });
      setEditingMessageId(null);
      setEditingMessageText("");
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      const messageDocRef = doc(firestore, "chats", activeChatId, "messages", messageId);
      await deleteDoc(messageDocRef);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("There was an issue deleting your message.");
    }
  };

  const openGroupChat = async (className) => {
    const groupChatId = `group-${className}`;
    const chatDocRef = doc(firestore, "chats", groupChatId);
    if (currentUserRole === "teacher") {
      const participants = groupedContacts[className]
        ? groupedContacts[className].map((contact) => String(contact.id)).concat(String(currentUserId))
        : [String(currentUserId)];
      await setDoc(
        chatDocRef,
        {
          participants,
          teacherId: String(currentUserId),
          className,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await updateDoc(chatDocRef, {
        participants: arrayUnion(String(currentUserId)),
        className,
      });
    }
    setActiveChatId(groupChatId);
    setActiveRecipient({ name: `Group - ${className}`, id: groupChatId });
    if (onSelectContactName) onSelectContactName(`Group - ${className}`);
    markChatAsRead(groupChatId);
  };

  const handleSelectChat = (chatId, contact) => {
    setActiveChatId(chatId);
    setActiveRecipient(contact);
    if (onSelectContactName) onSelectContactName(contact.name || "Unknown");
    markChatAsRead(chatId);
  };

  const filteredContacts = Array.isArray(contacts)
    ? contacts.filter((contact) => {
        const lowerSearch = searchTerm.toLowerCase();
        return (
          contact.name?.toLowerCase().includes(lowerSearch) ||
          contact.username?.toLowerCase().includes(lowerSearch)
        );
      })
    : [];

  // Render the contacts list (sidebar). On mobile, full width.
  const renderSidebar = () => {
    const sidebarStyle = isMobile ? { ...styles.sidebar, width: "100%" } : styles.sidebar;
    return (
      <div style={sidebarStyle}>
        <h3>Chats</h3>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        {loading ? (
          <p>Loading contacts...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : currentUserRole === "teacher" ? (
          Object.keys(groupedContacts)
            .sort()
            .map((className) => {
              const filteredGroup = groupedContacts[className].filter((contact) => {
                const lowerSearch = searchTerm.toLowerCase();
                return (
                  contact.name?.toLowerCase().includes(lowerSearch) ||
                  contact.username?.toLowerCase().includes(lowerSearch)
                );
              });
              if (filteredGroup.length === 0) return null;
              return (
                <div key={className}>
                  <div style={styles.classHeader}>
                    <span>Class - {className}</span>
                    <button
                      style={styles.broadcastButton}
                      onClick={() => openGroupChat(className)}
                    >
                      Group
                    </button>
                  </div>
                  {filteredGroup.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => {
                        const chatId = [String(currentUserId), String(contact.id)].sort().join("-");
                        handleSelectChat(chatId, contact);
                      }}
                      style={styles.sidebarItem(
                        activeRecipient && activeRecipient.id === contact.id,
                        (contact.unreadCount || 0) > 0
                      )}
                    >
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "1rem" }}>
                          {contact.name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>
                          Class: {contact.Class?.class_name}
                        </div>
                        {contact.lastMessage && (
                          <div style={styles.lastMessage}>{contact.lastMessage}</div>
                        )}
                      </div>
                      {(contact.unreadCount || 0) > 0 && (
                        <span
                          style={{
                            backgroundColor: "red",
                            color: "#fff",
                            borderRadius: "50%",
                            padding: "4px 10px",
                            fontSize: "12px",
                          }}
                        >
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
        ) : (
          <>
            {studentClass && (
              <div style={styles.classHeader}>
                <span>Group</span>
                <button
                  style={styles.broadcastButton}
                  onClick={() => openGroupChat(studentClass)}
                >
                  Open Group
                </button>
              </div>
            )}
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => {
                    const chatId = [String(currentUserId), String(contact.id)].sort().join("-");
                    handleSelectChat(chatId, contact);
                  }}
                  style={styles.sidebarItem(
                    activeRecipient && activeRecipient.id === contact.id,
                    (contact.unreadCount || 0) > 0
                  )}
                >
                  <div>
                    <span>
                      {contact.name} {contact.username && `(${contact.username})`}
                    </span>
                    {contact.lastMessage && (
                      <div style={styles.lastMessage}>{contact.lastMessage}</div>
                    )}
                  </div>
                  {(contact.unreadCount || 0) > 0 && (
                    <span
                      style={{
                        backgroundColor: "red",
                        color: "#fff",
                        borderRadius: "50%",
                        padding: "4px 10px",
                        fontSize: "12px",
                      }}
                    >
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p>No contacts found.</p>
            )}
          </>
        )}
      </div>
    );
  };

  // Render chat area with header and messages
  const renderChatArea = () => (
    <div style={styles.chatArea}>
      <div style={styles.header}>
        <h2
          style={{
            margin: 0,
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
          }}
        >
          {isMobile && activeRecipient && (
            <button
              onClick={() => {
                setActiveChatId(null);
                setActiveRecipient(null);
              }}
              style={styles.backButton}
            >
              <FaArrowLeft />
            </button>
          )}
          {activeRecipient ? "back" : "Live Chat"}
        </h2>
      </div>
      {activeChatUnreadCount > 0 && (
        <div
          style={{
            backgroundColor: "#ffeb3b",
            padding: "8px",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          You have {activeChatUnreadCount} new message
          {activeChatUnreadCount > 1 ? "s" : ""}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Messages container with extra padding */}
        <div ref={messagesContainerRef} style={styles.messagesContainer}>
          {activeChatId && activeRecipient ? (
            <>
              {messages.length > 0 ? (
                messages.map((msg) => {
                  let extraStyle = {};
                  if (
                    msg.senderId !== String(currentUserId) &&
                    lastReadTimestamp &&
                    msg.timestamp &&
                    msg.timestamp.toMillis() > lastReadTimestamp
                  ) {
                    extraStyle = { border: "2px solid #ffeb3b" };
                  }
                  return (
                    <div
                      key={msg.id}
                      style={styles.messageBubble(
                        String(msg.senderId) === String(currentUserId),
                        extraStyle
                      )}
                    >
                      <strong>
                        {String(msg.senderId) === String(currentUserId)
                          ? "You"
                          : msg.senderName}
                      </strong>
                      {msg.replyTo && (
                        <div
                          style={{
                            borderLeft: "3px solid #2575fc",
                            paddingLeft: "5px",
                            marginBottom: "5px",
                            fontStyle: "italic",
                            color: "#555",
                          }}
                        >
                          Replying to {msg.replyTo.senderName}: {msg.replyTo.text}
                        </div>
                      )}
                      {editingMessageId === msg.id ? (
                        <div style={{ marginTop: "5px" }}>
                          <input
                            type="text"
                            value={editingMessageText}
                            onChange={(e) => setEditingMessageText(e.target.value)}
                            style={styles.editInput}
                          />
                          <button onClick={handleUpdateMessage} style={styles.editButton}>
                            Update
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingMessageText("");
                            }}
                            style={styles.cancelButton}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {msg.fileUrl ? (
                            <div>
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                {msg.fileName || "View File"}
                              </a>
                            </div>
                          ) : (
                            <div>{msg.text}</div>
                          )}
                          <div style={styles.timestamp}>
                            {msg.timestamp && msg.timestamp.toDate().toLocaleString()}
                          </div>
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={styles.reactionSummary}>
                              {Object.entries(msg.reactions).map(([reaction, count]) => (
                                <div key={reaction}>
                                  {REACTIONS.find((r) => r.id === reaction)?.icon || reaction} {count}
                                </div>
                              ))}
                            </div>
                          )}
                          {String(msg.senderId) !== String(currentUserId) ? (
                            <div style={{ position: "relative", marginTop: "4px", display: "flex", gap: "5px" }}>
                              <button
                                onClick={() => setReplyingTo(msg)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#2575fc" }}
                              >
                                <FaReply />
                              </button>
                              <button
                                onClick={() =>
                                  setVisibleReactions((prev) => ({
                                    ...prev,
                                    [msg.id]: !prev[msg.id],
                                  }))
                                }
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#2575fc" }}
                              >
                                <FaRegSmile />
                              </button>
                              {visibleReactions[msg.id] && (
                                <div style={styles.reactionOptions}>
                                  {REACTIONS.map((r) => (
                                    <button
                                      key={r.id}
                                      onClick={() => handleSelectReaction(msg.id, r.id)}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }}
                                    >
                                      {r.icon}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={styles.iconContainer}>
                              <button
                                onClick={() => setReplyingTo(msg)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#2575fc" }}
                              >
                                <FaReply size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingMessageText(msg.text);
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#2575fc" }}
                              >
                                <FaEdit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                style={{ border: "none", background: "none", cursor: "pointer", color: "red" }}
                              >
                                <FaTrash size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ textAlign: "center", marginTop: "20px" }}>
                  No messages yet. Start the conversation!
                </p>
              )}
              <div ref={messagesEndRef} />
              {/* Dummy element to add extra space at the bottom */}
              <div style={{ height: "150px" }} />
            </>
          ) : (
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              Select a contact to start chatting.
            </p>
          )}
        </div>
        {activeChatId && activeRecipient && (
          <>
            {replyingTo && (
              <div
                style={{
                  padding: "10px",
                  backgroundColor: "#e9ecef",
                  borderRadius: "8px",
                  margin: "0 20px 10px",
                  position: "relative",
                }}
              >
                <strong>Replying to {replyingTo.senderName}</strong>
                <p style={{ margin: "5px 0" }}>{replyingTo.text}</p>
                <button
                  onClick={() => setReplyingTo(null)}
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    color: "#999",
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {currentUserRole === "student" && activeChatId.startsWith("group-") ? (
              <div style={{ padding: "10px", textAlign: "center", color: "#666" }}>
                Broadcast is read-only for students.
              </div>
            ) : (
              // Inside the renderChatArea function, find the inputContainer section and update it:
              <div style={styles.inputContainer}>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onInput={(e) => {
                    e.target.style.height = 'inherit';
                    e.target.style.height = `${e.target.scrollHeight}px`; // Set height based on scroll height
                  }}
                  placeholder="Type your message..."
                  style={{
                    ...styles.messageInput,
                    height: '40px', // Initial height; adjust based on your design needs
                    overflowY: 'hidden' // Prevents scrollbar appearance
                  }}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  style={styles.attachmentButton}
                >
                  <FaPaperclip style={{ fontSize: "1.2rem" }} />
                </button>
                <button onClick={handleSendMessage} style={styles.sendButton}>
                  <FaPaperPlane style={{ fontSize: "1.2rem" }} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
            </div>

            )}
          </>
        )}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div style={{ width: "100%", marginTop: "10px" }}>
            <progress value={uploadProgress} max="100">
              {uploadProgress}%
            </progress>
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return activeChatId && activeRecipient ? renderChatArea() : renderSidebar();
  } else {
    return (
      <div style={styles.container(hideHeader)}>
        {renderSidebar()}
        {renderChatArea()}
      </div>
    );
  }
};

export default ChatContainer;
