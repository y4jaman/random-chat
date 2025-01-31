import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Moon, Sun } from 'lucide-react';

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [partnerId, setPartnerId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [autoSearch, setAutoSearch] = useState(() => localStorage.getItem('autoSearch') === 'true');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const containerRef = useRef(null);
  const websocket = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef();

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      const maxTilt = 1.5;
      
      const tiltX = ((mouseY - centerY) / (rect.height / 2)) * maxTilt;
      const tiltY = ((mouseX - centerX) / (rect.width / 2)) * maxTilt;
      
      setTiltX(tiltY);
      setTiltY(-tiltX);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleTyping = (e) => {
    setInputMessage(e.target.value);
    
    if (websocket.current?.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        type: 'typing',
        isTyping: true
      }));

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (websocket.current?.readyState === WebSocket.OPEN) {
          websocket.current.send(JSON.stringify({
            type: 'typing',
            isTyping: false
          }));
        }
      }, 1000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    websocket.current = new WebSocket('http://localhost:3001');

    websocket.current.onopen = () => {
      console.log('Connected to WebSocket');
      setStatus('searching');
    };

    websocket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
          case 'partner_found':
            setStatus('connected');
            setPartnerId(data.partnerId);
            setMessages([{
              type: 'system',
              content: 'Connected to a partner! Say hello!'
            }]);
            break;
          
          case 'message':
            setMessages(prev => [...prev, {
              type: 'received',
              content: data.content,
              timestamp: data.timestamp
            }]);
            break;
          
          case 'partner_disconnected':
            setStatus('disconnected');
            setPartnerId(null);
            setIsPartnerTyping(false);
            setMessages([{
              type: 'system',
              content: autoSearch ? 'Partner disconnected. Searching for a new partner...' : 'Partner disconnected. Click Search to find a new partner.'
            }]);
            if (autoSearch) {
              setTimeout(() => {
                if (websocket.current?.readyState === WebSocket.OPEN) {
                  const skipMessage = new TextEncoder().encode(JSON.stringify({ type: 'skip' }));
                  websocket.current.send(skipMessage);
                  setStatus('searching');
                }
              }, 2000);
            }
            break;

          case 'partner_skipped':
            setStatus('disconnected');
            setPartnerId(null);
            setIsPartnerTyping(false);
            setMessages([{
              type: 'system',
              content: autoSearch ? 'Partner skipped. Searching for a new partner...' : 'Partner skipped. Click Search to find a new partner.'
            }]);
            if (autoSearch) {
              setTimeout(() => {
                if (websocket.current?.readyState === WebSocket.OPEN) {
                  const skipMessage = new TextEncoder().encode(JSON.stringify({ type: 'skip' }));
                  websocket.current.send(skipMessage);
                  setStatus('searching');
                }
              }, 2000);
            }
            break;

          case 'typing':
            setIsPartnerTyping(data.isTyping);
            break;

          case 'searching':
            setStatus('searching');
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || status !== 'connected') return;

    const message = {
      type: 'message',
      content: inputMessage.trim()
    };

    const encodedMessage = new TextEncoder().encode(JSON.stringify(message));
    websocket.current.send(encodedMessage);
    
    setMessages(prev => [...prev, {
      type: 'sent',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    }]);
    setInputMessage('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      if (websocket.current?.readyState === WebSocket.OPEN) {
        websocket.current.send(JSON.stringify({
          type: 'typing',
          isTyping: false
        }));
      }
    }
  };

  return (
    <div className={`flex flex-col h-screen w-full bg-gradient-to-br from-purple-200 via-gray-100 to-pink-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${darkMode ? 'dark' : ''}`}>
      <div className="flex flex-col w-full max-w-6xl mx-auto p-4 h-full">
        <div className={`w-full rounded-lg shadow-lg flex-1 flex flex-col overflow-hidden transform-gpu backdrop-blur-md bg-white/20 dark:bg-gray-800/20`} 
          ref={containerRef}
          style={{ 
            transform: `perspective(1000px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`,
            transformStyle: 'preserve-3d'
          }}>
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-2xl text-gray-800 dark:text-white">
                    Random Chat
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'connected' ? 'bg-green-500' :
                    status === 'searching' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {status === 'connected' ? 'Connected' :
                     status === 'searching' ? 'Searching for partner...' :
                     'Disconnected'}
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSearch}
                    onChange={(e) => {
                      setAutoSearch(e.target.checked);
                      localStorage.setItem('autoSearch', e.target.checked);
                    }}
                    className="w-5 h-5 rounded bg-black/30 checked:bg-black/50 border-0 accent-white focus:ring-0 focus:ring-offset-0"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Auto-search
                  </span>
                </label>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-full ${darkMode ? 'text-white hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-4 space-y-4 backdrop-blur-md bg-white/20 dark:bg-gray-800/20`}>
            {messages.map((message, index) => (
              <div key={index} className={`flex ${
                message.type === 'sent' ? 'justify-end' :
                message.type === 'system' ? 'justify-center' :
                'justify-start'
              }`}>
                <div className={`max-w-[70%] rounded-lg p-3 text-lg relative group ${
                  message.type === 'sent' ? 
                    'bg-black/30 text-white' :
                  message.type === 'system' ? 
                    `${darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-200/50 text-gray-600'} text-sm` :
                    'text-gray-700 dark:text-gray-300'
                }`}>
                  {message.content}
                  {message.timestamp && (
                    <div className={`text-xs mt-1 ${
                      message.type === 'sent' ? 
                        'text-gray-300' :
                      message.type === 'system' ? 
                        'text-gray-500 dark:text-gray-400' :
                        'text-gray-700 dark:text-gray-300'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {isPartnerTyping && status === 'connected' && (
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">Partner is typing...</div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2">
              <button
                type="button"
                disabled={status === 'searching'}
                onClick={() => {
                  if (status === 'connected') {
                    const skipMessage = new TextEncoder().encode(JSON.stringify({ type: 'skip', sendDisconnect: true }));
                    websocket.current.send(skipMessage);
                    setMessages([{
                      type: 'system',
                      content: autoSearch ? 'Searching for a new partner...' : 'Click Search when ready.'
                    }]);
                    setStatus('disconnected');
                    
                    if (autoSearch) {
                      setTimeout(() => {
                        if (websocket.current?.readyState === WebSocket.OPEN) {
                          const searchMessage = new TextEncoder().encode(JSON.stringify({ type: 'skip' }));
                          websocket.current.send(searchMessage);
                          setStatus('searching');
                        }
                      }, 2000);
                    }
                  } else if (status === 'disconnected') {
                    const searchMessage = new TextEncoder().encode(JSON.stringify({ type: 'skip' }));
                    websocket.current.send(searchMessage);
                    setStatus('searching');
                  }
                }}
                className={`p-2 rounded-lg ${
                  darkMode ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600' : 
                  'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400'
                }`}
              >
                {status === 'disconnected' ? 'Search' : 'Skip'}
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={handleTyping}
                placeholder={status === 'connected' ? "Type a message..." : "Waiting for connection..."}
                disabled={status !== 'connected'}
                className={`flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 
                  bg-black/20 border-0 text-white placeholder-white/70
                  dark:bg-black/30 dark:text-white dark:placeholder-white/70`}
              />
              <button
                type="submit"
                disabled={status !== 'connected'}
                className={`p-2 rounded-lg ${
                  status === 'connected' ?
                    'bg-black/30 hover:bg-black/40' :
                    'bg-gray-300/50 cursor-not-allowed'
                }`}
              >
                {status === 'searching' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <Send className="w-6 h-6 text-white" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;