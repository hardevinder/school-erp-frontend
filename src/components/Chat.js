// src/components/ChatContainer.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";

const ChatContainer = ({ currentUserId }) => {
  // Contacts & chat states
  const [contacts, setContacts] = useState([]);
  const [viewContacts, setViewContacts] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeRecipient, setActiveRecipient] = useState(null);

  // Searching & loading state for contacts
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Message states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Current user info from localStorage
  const currentUserRole = localStorage.getItem("userRole");
  const currentUserName = localStorage.getItem("userName") || "Unknown User";

  // -----------------------------
  // 1) FETCH CONTACTS
  // -----------------------------
  useEffect(() => {
    if (!currentUserRole) {
      setError("User role not defined. Please log in again.");
      return;
    }
    setLoading(true);
    getDocs(collection(firestore, "users"))
      .then(async (snapshot) => {
        const allUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Exclude current user
        const contactsList = allUsers.filter((user) => user.id !== currentUserId);
        const contactsWithChatInfo = await Promise.all(
          contactsList.map(async (contact) => {
            const chatId = [currentUserId, contact.id].sort().join("-");
            const chatDocRef = doc(firestore, "chats", chatId);
            const chatDocSnap = await getDoc(chatDocRef);
            let lastMessageTimestamp = null;
            let unreadCount = 0;
            if (chatDocSnap.exists()) {
              const chatData = chatDocSnap.data();
              if (chatData.lastMessageTimestamp)
                lastMessageTimestamp = chatData.lastMessageTimestamp.toMillis();
              if (chatData.unreadCounts && chatData.unreadCounts[currentUserId])
                unreadCount = chatData.unreadCounts[currentUserId];
            }
            return { ...contact, chatId, lastMessageTimestamp, unreadCount };
          })
        );
        contactsWithChatInfo.sort((a, b) => {
          if (a.lastMessageTimestamp === b.lastMessageTimestamp) return 0;
          if (a.lastMessageTimestamp === null) return 1;
          if (b.lastMessageTimestamp === null) return -1;
          return b.lastMessageTimestamp - a.lastMessageTimestamp;
        });
        setContacts(contactsWithChatInfo);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching contacts:", err);
        setError("Failed to load contacts. Please try again later.");
        setLoading(false);
      });
  }, [currentUserId, currentUserRole]);

  // -----------------------------
  // 2) SELECT A CONTACT => Setup Chat
  // -----------------------------
  const handleSelectContact = async (contact) => {
    const chatId = contact.chatId || [currentUserId, contact.id].sort().join("-");
    const chatDocRef = doc(firestore, "chats", chatId);
    const chatDocSnap = await getDoc(chatDocRef);
    if (!chatDocSnap.exists()) {
      await setDoc(chatDocRef, {
        participants: [currentUserId, contact.id],
        createdAt: new Date(),
        unreadCounts: {
          [currentUserId]: 0,
          [contact.id]: 0,
        },
      });
    }
    setActiveChatId(chatId);
    setActiveRecipient(contact);
    setViewContacts(false);
  };

  // -----------------------------
  // 3) SUBSCRIBE TO MESSAGES
  // -----------------------------
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

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -----------------------------
  // 4) SEND MESSAGE
  // -----------------------------
  const handleSendMessage = async () => {
    if (!activeChatId || newMessage.trim() === "") return;
    try {
      const messagesRef = collection(firestore, "chats", activeChatId, "messages");
      await addDoc(messagesRef, {
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        text: newMessage,
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // -----------------------------
  // 5) HELPER FUNCTIONS
  // -----------------------------
  const getDisplayName = (msg) =>
    String(msg.senderId) === String(currentUserId) ? "You" : msg.senderName || "Anonymous";

  const messageStyle = (msg) => ({
    backgroundColor: String(msg.senderId) === String(currentUserId) ? "#DCF8C6" : "#FFFFFF",
    alignSelf: String(msg.senderId) === String(currentUserId) ? "flex-end" : "flex-start",
    padding: "10px",
    borderRadius: "10px",
    marginBottom: "8px",
    maxWidth: "80%",
  });

  // Filter contacts by search term
  const filteredContacts = contacts.filter((contact) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(lowerSearch) ||
      contact.username?.toLowerCase().includes(lowerSearch)
    );
  });

  // -----------------------------
  // RENDER: Single Outer Container
  // -----------------------------
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ccc",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Single Header */}
      <div
        style={{
          backgroundColor: "#6a11cb",
          color: "#fff",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {!viewContacts && (
          <button
            onClick={() => {
              setViewContacts(true);
              setActiveChatId(null);
              setActiveRecipient(null);
              setMessages([]);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "1.2rem",
              cursor: "pointer",
              marginRight: "8px",
            }}
          >
            <FaArrowLeft />
          </button>
        )}
        <h3 style={{ margin: 0 }}>
          {viewContacts
            ? "Chat"
            : `Chat with ${activeRecipient ? activeRecipient.name : "Unknown"}`}
        </h3>
      </div>

      {/* Content */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        {viewContacts ? (
          // Contacts View (with search and list)
          <div style={{ flexGrow: 1, padding: "8px", overflowY: "auto", backgroundColor: "#f9f9f9" }}>
            <div style={{ marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "20px",
                  border: "1px solid #ccc",
                  outline: "none",
                }}
              />
            </div>
            {loading ? (
              <p>Loading contacts...</p>
            ) : error ? (
              <p style={{ color: "red" }}>{error}</p>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    backgroundColor: activeRecipient && activeRecipient.id === contact.id ? "#f0f0f0" : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #ddd",
                    borderRadius: "4px",
                    marginBottom: "4px",
                  }}
                >
                  <span>
                    {contact.name} ({contact.username})
                  </span>
                  {contact.unreadCount > 0 && (
                    <span
                      style={{
                        backgroundColor: "red",
                        color: "white",
                        borderRadius: "50%",
                        padding: "4px 8px",
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
          </div>
        ) : (
          // Conversation View
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", backgroundColor: "#f9f9f9" }}>
            <div style={{ flexGrow: 1, padding: "8px", overflowY: "auto" }}>
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div key={msg.id} style={messageStyle(msg)}>
                    <strong>{getDisplayName(msg)}</strong>
                    <div>{msg.text}</div>
                    {String(msg.senderId) !== String(currentUserId) && msg.senderRole && (
                      <div style={{ fontSize: "0.8em", color: "#888" }}>{msg.senderRole}</div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", marginTop: "20px" }}>No messages yet.</p>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div
              style={{
                padding: "8px",
                borderTop: "1px solid #ccc",
                display: "flex",
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                style={{
                  flexGrow: 1,
                  padding: "10px",
                  borderRadius: "20px",
                  border: "1px solid #ccc",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSendMessage}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  marginLeft: "8px",
                  color: "#6a11cb",
                }}
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatContainer;
