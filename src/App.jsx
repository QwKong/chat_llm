import { useState, useEffect, useRef } from 'react';
import { openDB } from 'idb';
import { debounce } from 'lodash';
import ChatMessage from './ChatMessage';
import Sidebar from './Sidebar';

function InputArea({ onSubmit, isLoading, selectedModel, setSelectedModel }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const adjustTextareaHeight = () => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    });
  };

  useEffect(() => {
    if (input.includes('\n') || input.length > 100) {
      adjustTextareaHeight();
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      setInput((prev) => prev + '\n');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(input);
      setInput('');
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(input); setInput(''); }} className="flex space-x-2 w-full">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800 w-48"
        >
          {[
            'deepseek-v3',
            'deepseek-r1',
            'gpt-4.1-mini',
            'gpt-4.1-nano',
            'gemini-2.5-pro-exp-03-25',
            'grok-3',
            'grok-3-mini',
            'claude-3-7-sonnet-20250219',
          ].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={adjustTextareaHeight}
          placeholder="输入你的消息...（Shift+Enter 换行，Enter 发送）"
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800 min-h-[2.5rem] resize-none"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 w-24"
        >
          发送
        </button>
      </form>
    </div>
  );
}

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [controller, setController] = useState(null);
  const [selectedModel, setSelectedModel] = useState('deepseek-v3');
  const chatContainerRef = useRef(null);

  useEffect(() => {
    async function initDB() {
      const db = await openDB('grok-chat', 2, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore('messages', { autoIncrement: true });
          }
          if (oldVersion < 2) {
            db.createObjectStore('conversations', { keyPath: 'id' });
          }
        },
      });

      const storedConversations = await db.getAll('conversations');
      setConversations(storedConversations);

      if (storedConversations.length === 0) {
        const newConversation = {
          id: Date.now(),
          title: '新对话',
          messages: [],
          createdAt: new Date().toISOString(),
        };
        await db.add('conversations', newConversation);
        setConversations([newConversation]);
        setCurrentConversationId(newConversation.id);
        setMessages([]);
      } else {
        const latestConversation = storedConversations.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )[0];
        setCurrentConversationId(latestConversation.id);
        setMessages(latestConversation.messages);
      }
    }
    initDB();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      async function loadMessages() {
        const db = await openDB('grok-chat', 2);
        const conversation = await db.get('conversations', currentConversationId);
        setMessages(conversation.messages || []);
      }
      loadMessages();
    }
  }, [currentConversationId]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const saveMessage = async (message) => {
    const db = await openDB('grok-chat', 2);
    const conversation = await db.get('conversations', currentConversationId);
    conversation.messages = [...(conversation.messages || []), message];

    if (message.role === 'user' && conversation.messages.length === 1) {
      conversation.title = message.content.slice(0, 30) || '新对话';
    }

    await db.put('conversations', conversation);
    setConversations((prev) =>
      prev.map((conv) => (conv.id === currentConversationId ? conversation : conv))
    );
    setMessages(conversation.messages);
  };

  const handleSubmit = async (input) => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      model: selectedModel,
    };
    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(userMessage);
    setIsLoading(true);

    try {
      const abortController = new AbortController();
      setController(abortController);

      const myHeaders = new Headers();
      const api_key = process.env.REACT_APP_API_KEY;
      myHeaders.append('Authorization', `Bearer ${api_key}`);
      myHeaders.append('Content-Type', 'application/json');

      const raw = JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: `${input}`,
          },
        ],
        stream: true,
      });

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
        signal: abortController.signal,
      };

      const response = await fetch(
        'https://api.deerapi.com/v1/chat/completions',
        requestOptions
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const assistantMessage = {
        id: Date.now(),
        role: 'assistant',
        content: '',
        model: selectedModel,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await saveMessage(assistantMessage);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const contentRef = { current: '' };
      let lastUpdate = Date.now();

      const debouncedSave = debounce(async (content) => {
        const db = await openDB('grok-chat', 2);
        const conversation = await db.get('conversations', currentConversationId);
        conversation.messages = conversation.messages.map((msg) =>
          msg.id === assistantMessage.id ? { ...msg, content } : msg
        );
        await db.put('conversations', conversation);
      }, 500);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const codeBlockRegex = /^```markdown\n([\s\S]*?)\n```$/;
          const match = contentRef.current.match(codeBlockRegex);
          if (match) {
            contentRef.current = match[1].trim();
            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage.role === 'assistant' && lastMessage.id) {
                lastMessage.content = contentRef.current;
              }
              return updated;
            });
            debouncedSave(contentRef.current);
          }
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0].delta.content;
              if (delta) {
                contentRef.current += delta;
                const now = Date.now();
                if (now - lastUpdate > 100) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage.role === 'assistant' && lastMessage.id) {
                      lastMessage.content = contentRef.current;
                    }
                    return updated;
                  });
                  lastUpdate = now;
                }
                debouncedSave(contentRef.current);
              }
            } catch (error) {
              console.error('Error parsing chunk:', error);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        const stopMessage = {
          id: Date.now(),
          role: 'assistant',
          content: '已停止输出',
          model: selectedModel,
        };
        setMessages((prev) => [...prev, stopMessage]);
        await saveMessage(stopMessage);
      } else {
        console.error('Error:', error);
        const errorMessage = {
          id: Date.now(),
          role: 'assistant',
          content: '抱歉，出现了错误！',
          model: selectedModel,
        };
        setMessages((prev) => [...prev, errorMessage]);
        await saveMessage(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setController(null);
    }
  };

  const handleStop = () => {
    if (controller) {
      controller.abort();
      setIsLoading(false);
      setController(null);
    }
  };

  const handleNewConversation = async () => {
    const newConversation = {
      id: Date.now(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    const db = await openDB('grok-chat', 2);
    await db.add('conversations', newConversation);
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setMessages([]);
  };

  const handleDeleteConversation = async (id) => {
    const db = await openDB('grok-chat', 2);
    await db.delete('conversations', id);
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (currentConversationId === id) {
      if (conversations.length > 1) {
        const latest = conversations.filter((conv) => conv.id !== id)[0];
        setCurrentConversationId(latest.id);
        setMessages(latest.messages);
      } else {
        const newConversation = {
          id: Date.now(),
          title: '新对话',
          messages: [],
          createdAt: new Date().toISOString(),
        };
        await db.add('conversations', newConversation);
        setConversations([newConversation]);
        setCurrentConversationId(newConversation.id);
        setMessages([]);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <div className="flex flex-col flex-1">
        <div
          ref={chatContainerRef}
          className="chat-container flex-1 p-6 overflow-y-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          {messages.slice(-50).map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLastAssistant={msg.id === messages[messages.length - 1]?.id && msg.role === 'assistant' && isLoading}
              onStop={handleStop}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div key="loading" className="flex justify-start mb-4 max-w-3xl mx-auto">
              <div className="p-3 bg-gray-100 rounded-lg text-gray-800">正在输入...</div>
            </div>
          )}
        </div>
        <InputArea
          onSubmit={handleSubmit}
          isLoading={isLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
        />
      </div>
    </div>
  );
}

export default App;