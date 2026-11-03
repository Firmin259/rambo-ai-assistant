import React, { useState, useRef, useEffect } from 'react';

import {
  Send,
  Bot,
  User,
  Loader2,
  LogOut,
  Plus,
  MessageSquare,
  Menu
} from 'lucide-react';

import { auth, db, signOut } from './firebase';

import { onAuthStateChanged } from 'firebase/auth';

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

import Login from './Login';

// ==========================================
// 1. BACKEND CONFIGURATION
// ==========================================

const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  'https://rambo-ai-backend.onrender.com'
).trim().replace(/\/+$/, '');

// ==========================================
// 2. INITIAL MESSAGE
// ==========================================

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Hello! I am your Rambo AI assistant. How can I help you today?'
};

export default function App() {

  // ==========================================
  // 3. STATES
  // ==========================================

  const [user, setUser] = useState(null);

  const [authChecking, setAuthChecking] = useState(true);

  const [chats, setChats] = useState([]);

  const [currentChatId, setCurrentChatId] = useState(null);

  const [messages, setMessages] = useState([
    { ...WELCOME_MESSAGE }
  ]);

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [isImageMode, setIsImageMode] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState(null);

  const [mediaType, setMediaType] = useState(null);

  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);

  // ==========================================
  // 4. FIREBASE AUTHENTICATION
  // ==========================================

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {

        setUser(currentUser);

        if (currentUser) {
          await fetchUserChats(currentUser.uid);
        } else {
          setChats([]);
          setCurrentChatId(null);
          setMessages([{ ...WELCOME_MESSAGE }]);
        }

        setAuthChecking(false);

      }
    );

    return () => unsubscribe();

  }, []);

  // ==========================================
  // 5. FETCH USER CHATS
  // ==========================================

  const fetchUserChats = async (userId) => {

    try {

      const q = query(
        collection(db, 'chats'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);

      const userChats = querySnapshot.docs.map(
        chatDoc => ({
          id: chatDoc.id,
          ...chatDoc.data()
        })
      );

      setChats(userChats);

    } catch (err) {

      console.error(
        'Error fetching chats:',
        err
      );

    }

  };

  // ==========================================
  // 6. SAVE CHAT TO FIRESTORE
  // ==========================================

  const saveChat = async (finalMessages, prompt) => {

    try {

      const cleanMessages = finalMessages.map(msg => ({
        ...msg
      }));

      if (!currentChatId) {

        const title =
          (prompt || 'Media Upload').slice(0, 30) + '...';

        const docRef = await addDoc(
          collection(db, 'chats'),
          {
            userId: user.uid,
            title,
            messages: cleanMessages,
            createdAt: serverTimestamp()
          }
        );

        setCurrentChatId(docRef.id);

        await fetchUserChats(user.uid);

      } else {

        const chatRef = doc(
          db,
          'chats',
          currentChatId
        );

        await updateDoc(chatRef, {
          messages: cleanMessages
        });

      }

    } catch (err) {

      console.error(
        'Error saving chat:',
        err
      );

      throw new Error(
        'Response received, but saving chat failed. Check Firestore storage limits and permissions.'
      );

    }

  };

  // ==========================================
  // 7. START NEW CHAT
  // ==========================================

  const startNewChat = () => {

    if (loading) return;

    setCurrentChatId(null);

    setSelectedMedia(null);

    setMediaType(null);

    setInput('');

    setMessages([
      { ...WELCOME_MESSAGE }
    ]);

  };

  // ==========================================
  // 8. SELECT EXISTING CHAT
  // ==========================================

  const selectChat = async (chatId) => {

    if (loading) return;

    setCurrentChatId(chatId);

    setSelectedMedia(null);

    setMediaType(null);

    try {

      const chatDocRef = doc(
        db,
        'chats',
        chatId
      );

      const chatSnap = await getDoc(chatDocRef);

      if (chatSnap.exists()) {

        const chatData = chatSnap.data();

        setMessages(
          chatData.messages || [
            { ...WELCOME_MESSAGE }
          ]
        );

      }

    } catch (err) {

      console.error(
        'Error loading chat:',
        err
      );

      alert('Unable to load this conversation.');

    }

  };

  // ==========================================
  // 9. FILE UPLOAD
  // ==========================================

  const handleFileSelect = (e) => {

    const file = e.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith('image/') &&
      !file.type.startsWith('video/')
    ) {

      alert(
        'Please select an image or video file.'
      );

      e.target.value = '';

      return;

    }

    // 15 MB upload limit
    if (file.size > 15 * 1024 * 1024) {

      alert(
        'File size must be less than 15 MB.'
      );

      e.target.value = '';

      return;

    }

    const isVideo = file.type.startsWith('video/');

    setMediaType(
      isVideo ? 'video' : 'image'
    );

    const reader = new FileReader();

    reader.onloadend = () => {

      if (typeof reader.result === 'string') {
        setSelectedMedia(reader.result);
      }

    };

    reader.onerror = () => {

      alert(
        'Unable to read the selected file.'
      );

    };

    reader.readAsDataURL(file);

    e.target.value = '';

  };

  // ==========================================
  // 10. SCROLL TO BOTTOM
  // ==========================================

  const scrollToBottom = () => {

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });

  };

  useEffect(() => {

    scrollToBottom();

  }, [messages, loading]);

  // ==========================================
  // 11. AUTHENTICATION LOADING
  // ==========================================

  if (authChecking) {

    return (

      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">

        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />

      </div>

    );

  }

  // ==========================================
  // 12. LOGIN SCREEN
  // ==========================================

  if (!user) {

    return <Login />;

  }

  // ==========================================
  // 13. CHAT SUBMISSION
  // ==========================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (
      (!input.trim() && !selectedMedia) ||
      loading
    ) {
      return;
    }

    const userPrompt = input.trim();

    const attachedMedia = selectedMedia;

    const attachedMediaType = mediaType;

    // Create user message
    const userMessage = {

      role: 'user',

      content: userPrompt,

      ...(attachedMedia && {
        mediaUrl: attachedMedia,
        mediaType: attachedMediaType
      })

    };

    const updatedMessages = [
      ...messages,
      userMessage
    ];

    // Update interface
    setMessages(updatedMessages);

    setInput('');

    setSelectedMedia(null);

    setMediaType(null);

    setLoading(true);

    // Loading message
    const loadingText =
      attachedMediaType === 'video'
        ? '🎞️ Analyzing video frames and processing tokens... Please hold on.'
        : isImageMode
          ? '🎨 Generating your custom image...'
          : '...';

    setMessages([
      ...updatedMessages,
      {
        role: 'assistant',
        content: loadingText
      }
    ]);

    try {

      // ======================================
      // GET FIREBASE TOKEN
      // ======================================

      const token = await user.getIdToken();

      // Exclude initial welcome message from Gemini history
      const apiMessages = updatedMessages.filter(
        (msg, index) => !(
          index === 0 &&
          msg.role === 'assistant'
        )
      );

      // ======================================
      // IMAGE GENERATION MODE
      // ======================================

      if (isImageMode) {

        if (!userPrompt) {

          throw new Error(
            'Please enter an image description.'
          );

        }

        const response = await fetch(
          `${BACKEND_URL}/api/generate-image`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },

            body: JSON.stringify({
              prompt: userPrompt
            })

          }
        );

        const data = await response.json().catch(
          () => ({})
        );

        if (!response.ok) {

          throw new Error(
            data.error ||
            `Image generation failed: HTTP ${response.status}`
          );

        }

        if (!data.imageUrl) {

          throw new Error(
            'The server did not return an image.'
          );

        }

        const finalMessages = [
          ...updatedMessages,
          {
            role: 'assistant',
            content:
              `Here is your requested character/image based on: "${userPrompt}"`,
            imageUrl: data.imageUrl
          }
        ];

        setMessages(finalMessages);

        await saveChat(
          finalMessages,
          userPrompt
        );

      }

      // ======================================
      // NORMAL GEMINI CHAT MODE
      // ======================================

      else {

        const response = await fetch(
          `${BACKEND_URL}/api/chat`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },

            body: JSON.stringify({
              messages: apiMessages
            })

          }
        );

        // Read server errors
        if (!response.ok) {

          const errorData = await response.json().catch(
            () => ({})
          );

          throw new Error(
            errorData.error ||
            `Server returned HTTP ${response.status}`
          );

        }

        if (!response.body) {

          throw new Error(
            'Server returned an empty response stream.'
          );

        }

        // ==================================
        // STREAMING RESPONSE
        // ==================================

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let accumulatedText = '';

        let buffer = '';

        let streamFinished = false;

        while (!streamFinished) {

          const {
            value,
            done
          } = await reader.read();

          if (done) break;

          buffer += decoder.decode(
            value,
            { stream: true }
          );

          const lines = buffer.split('\n\n');

          buffer = lines.pop() || '';

          for (const line of lines) {

            if (!line.startsWith('data: ')) {
              continue;
            }

            const dataStr = line.slice(6).trim();

            if (dataStr === '[DONE]') {

              streamFinished = true;

              break;

            }

            let data;

            try {

              data = JSON.parse(dataStr);

            } catch (parseError) {

              console.error(
                'Invalid streaming response:',
                dataStr
              );

              continue;

            }

            if (data.error) {

              throw new Error(data.error);

            }

            if (data.text) {

              accumulatedText += data.text;

              setMessages(prev => {

                const newHistory = [
                  ...prev
                ];

                const lastIndex =
                  newHistory.length - 1;

                newHistory[lastIndex] = {

                  ...newHistory[lastIndex],

                  content: accumulatedText

                };

                return newHistory;

              });

            }

          }

        }

        // Flush decoder
        buffer += decoder.decode();

        if (!accumulatedText) {

          throw new Error(
            'Gemini returned an empty response.'
          );

        }

        // ==================================
        // SAVE FINAL CHAT
        // ==================================

        const finalMessages = [
          ...updatedMessages,
          {
            role: 'assistant',
            content: accumulatedText
          }
        ];

        setMessages(finalMessages);

        await saveChat(
          finalMessages,
          userPrompt
        );

      }

    } catch (error) {

      console.error(
        'Request processing error:',
        error
      );

      setMessages(prev => {

        const newHistory = [
          ...prev
        ];

        const lastIndex =
          newHistory.length - 1;

        newHistory[lastIndex] = {

          ...newHistory[lastIndex],

          content:
            `⚠️ Could not process request: ${error.message}`

        };

        return newHistory;

      });

    } finally {

      setLoading(false);

    }

  };

  // ==========================================
  // 14. MAIN USER INTERFACE
  // ==========================================

  return (

    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* SIDEBAR */}

      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden shrink-0`}
      >

        {/* New Chat */}

        <div className="p-4 border-b border-slate-800 flex items-center justify-between">

          <button
            onClick={startNewChat}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-md"
          >

            <Plus className="w-4 h-4" />

            New Chat

          </button>

        </div>

        {/* Recent Chats */}

        <div className="flex-1 overflow-y-auto p-3 space-y-1">

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase mb-2">

            Recent Chats

          </p>

          {chats.map(chat => (

            <button
              key={chat.id}
              onClick={() => selectChat(chat.id)}
              disabled={loading}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors truncate ${
                currentChatId === chat.id
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >

              <MessageSquare className="w-4 h-4 shrink-0 text-slate-500" />

              <span className="truncate">
                {chat.title}
              </span>

            </button>

          ))}

        </div>

        {/* User Account */}

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">

          <div className="truncate text-xs text-slate-400">

            <p className="font-medium text-slate-200 truncate">

              {user.email}

            </p>

          </div>

          <button
            onClick={() => signOut(auth)}
            title="Sign Out"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
          >

            <LogOut className="w-4 h-4" />

          </button>

        </div>

      </aside>

      {/* MAIN CONTAINER */}

      <div className="flex-1 flex flex-col bg-slate-900 min-w-0">

        {/* HEADER */}

        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">

          <div className="flex items-center gap-3">

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
            >

              <Menu className="w-5 h-5" />

            </button>

            <div className="flex items-center gap-3">

              <div className="p-2 bg-indigo-600 rounded-xl">

                <Bot className="w-5 h-5 text-white" />

              </div>

              <h1 className="font-bold text-base text-slate-100">

                Rambo AI Assistant

              </h1>

            </div>

          </div>

        </header>

        {/* MESSAGE FEED */}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {messages.map((msg, idx) => (

            <div
              key={idx}
              className={`flex items-start gap-4 ${
                msg.role === 'user'
                  ? 'flex-row-reverse'
                  : 'flex-row'
              }`}
            >

              {/* Avatar */}

              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}
              >

                {msg.role === 'user'
                  ? <User className="w-5 h-5" />
                  : <Bot className="w-5 h-5" />
                }

              </div>

              {/* Message */}

              <div
                className={`max-w-[75%] min-w-0 rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 border border-emerald-500/30 text-slate-100 rounded-tr-none'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-none'
                }`}
              >

                {/* Uploaded Media */}

                {msg.mediaUrl && (

                  msg.mediaType === 'video' ||
                  msg.mediaUrl.startsWith('data:video')

                    ? (

                      <video
                        controls
                        className="rounded-xl mb-3 max-w-full h-auto border border-slate-700 shadow-md max-h-64"
                      >

                        <source src={msg.mediaUrl} />

                        Your browser does not support the video tag.

                      </video>

                    )

                    : (

                      <img
                        src={msg.mediaUrl}
                        alt="Uploaded content"
                        className="rounded-xl mb-3 max-w-full h-auto border border-slate-700 shadow-md max-h-64 object-cover"
                      />

                    )

                )}

                {/* Generated Image */}

                {msg.imageUrl && (

                  <img
                    src={msg.imageUrl}
                    alt="Generated Asset"
                    className="rounded-xl mb-3 max-w-full h-auto border border-slate-700 shadow-md max-h-64 object-cover"
                  />

                )}

                {/* Text */}

                <p className="whitespace-pre-wrap break-words">

                  {msg.content || ''}

                </p>

              </div>

            </div>

          ))}

          <div ref={messagesEndRef} />

        </div>

        {/* BOTTOM INPUT AREA */}

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-col gap-2">

          {/* Selected Media Preview */}

          {selectedMedia && (

            <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl w-fit border border-slate-700">

              {mediaType === 'video' ? (

                <video
                  src={selectedMedia}
                  className="w-10 h-10 object-cover rounded-lg"
                />

              ) : (

                <img
                  src={selectedMedia}
                  alt="Preview"
                  className="w-10 h-10 object-cover rounded-lg"
                />

              )}

              <span className="text-xs text-slate-300">

                {mediaType === 'video'
                  ? 'Video attached'
                  : 'Image attached'
                }

              </span>

              <button
                type="button"
                onClick={() => {
                  setSelectedMedia(null);
                  setMediaType(null);
                }}
                className="text-slate-400 hover:text-red-400 text-xs px-2"
              >

                ✕ Remove

              </button>

            </div>

          )}

          {/* INPUT FORM */}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors"
          >

            {/* Image Mode */}

            <button
              type="button"
              onClick={() => setIsImageMode(!isImageMode)}
              title={
                isImageMode
                  ? 'Switch to Text Chat Mode'
                  : 'Switch to Image Generation Mode'
              }
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1 shrink-0 ${
                isImageMode
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >

              🎨

              {isImageMode
                ? 'Image Mode'
                : 'Chat Mode'
              }

            </button>

            {/* File Input */}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*"
              className="hidden"
            />

            {/* Upload Button */}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Image or Video"
              disabled={loading}
              className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-xl transition-all shrink-0"
            >

              📎

            </button>

            {/* Text Input */}

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isImageMode
                  ? "Describe your character or image..."
                  : "Type your prompt or ask about your image/video..."
              }
              disabled={loading}
              className="flex-1 min-w-0 bg-transparent px-4 py-2 text-slate-100 placeholder-slate-400 focus:outline-none text-sm"
            />

            {/* Submit */}

            <button
              type="submit"
              disabled={
                loading ||
                (!input.trim() && !selectedMedia)
              }
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white rounded-xl transition-all shadow-md shrink-0"
            >

              {loading

                ? (

                  <Loader2 className="w-5 h-5 animate-spin" />

                )

                : (

                  <Send className="w-5 h-5" />

                )

              }

            </button>

          </form>

        </div>

      </div>

    </div>

  );

}
