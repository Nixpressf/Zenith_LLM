import "./App.scss";
import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';

function App() {
    const url_llm_query = "https://67e27de897fc65f535365432.mockapi.io/ai/LLMQuery";
    const url_user_query = "https://67e27de897fc65f535365432.mockapi.io/ai/UserQuery";
    const standby_code = "buE3J01dta5p";
    const timeoutDuration = 30000; // 30 seconds in milliseconds
    const checkInterval = 3000; // Check every 3 seconds
    const localStorageKey = 'chatMessages'; // Key to store messages in local storage
    const darkModeStorageKey = 'darkModeEnabled';

    const initialMessages = [{ sender: 'bot', text: 'Waiting for you!' }];
    const [messages, setMessages] = useState(() => {
        const storedMessages = localStorage.getItem(localStorageKey);
        return storedMessages ? JSON.parse(storedMessages) : initialMessages;
    });
    const [input, setInput] = useState('');
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        const storedDarkMode = localStorage.getItem(darkModeStorageKey);
        return storedDarkMode === 'true' || false;
    });

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem(darkModeStorageKey, darkMode);
    }, [darkMode]);

    useEffect(() => {
        if (isWaitingForResponse) return;

        const intervalId = setInterval(() => {
            void checkBackgroundMessage();
            console.log("Interval running (background check)");
        }, 5000);

        return () => clearInterval(intervalId);
    }, [isWaitingForResponse]);

    useEffect(() => {
        localStorage.setItem(localStorageKey, JSON.stringify(messages));
    }, [messages]);

    const checkBackgroundMessage = async () => {
        const message = await getMessageFromAPI();
        if (message && message !== standby_code) {
            setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: message }]);
            try {
                await replaceMessage(url_llm_query, standby_code);
            } catch (error) {
                console.error("Error replacing message with standby code (background):", error);
            }
        }
    };

    const waitForBotResponse = async () => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(async () => {
                const elapsedTime = Date.now() - startTime;
                const message = await getMessageFromAPI();
                if (message && message !== standby_code) {
                    clearInterval(interval);
                    resolve(message);
                } else if (elapsedTime >= timeoutDuration) {
                    clearInterval(interval);
                    reject("Bot response timed out after 30 seconds.");
                }
            }, checkInterval);
        });
    };

    const handleSendMessage = async () => {
        if (input.trim()) {
            setIsWaitingForResponse(true);
            const userMessage = { sender: 'user', text: input };
            setMessages([...messages, userMessage]);

            try {
                await putUserMessageToDB(url_user_query, input);
            } catch (error) {
                console.error("Error sending user message to database:", error);
                setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: "Error sending your message." }]);
                setIsWaitingForResponse(false);
                return;
            }
            setInput('');

            try {
                const botMessage = await waitForBotResponse();
                setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: botMessage }]);
                await replaceMessage(url_llm_query, standby_code);
            } catch (error) {
                console.error("Error in handleSendMessage (waiting for bot):", error);
                setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: "Bot response timed out. Please try again later." }]);
            }
            setIsWaitingForResponse(false);
        }
    };

    async function putUserMessageToDB(url, message) {
        const userData = { "Query": message, "id": "1" };
        const updateUrl = `${url}/1`;
        try {
            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (!response.ok) throw new Error(`Response status: ${response.status}`);
        } catch (error) {
            console.error("Error updating database:", error);
            throw error;
        }
    }

    async function getMessageFromAPI() {
        try {
            const response = await fetch(url_llm_query);
            if (!response.ok) throw new Error(`Response status: ${response.status}`);
            const json = await response.json();
            return json[0].Query;
        } catch (error) {
            console.error("Error fetching message:", error);
            return null;
        }
    }

    async function replaceMessage(url, standby) {
        const newData = { "Query": standby, "id": "1" };
        const updateUrl = `${url}/1`;
        try {
            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });
            if (!response.ok) throw new Error(`Response status: ${response.status}`);
        } catch (error) {
            console.error("Error replacing message with standby code:", error);
        }
    }

    const clearMessages = () => {
        setMessages(initialMessages);
    };

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    return (
        <div className="chat-container">
            <button className="clear-button" onClick={clearMessages}>
                Clear Chat
            </button>
            <button className="dark-mode-toggle" onClick={toggleDarkMode}>
                {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <h1>LLM Chat</h1>
            <h1>If it's down, then the PC is off</h1>
            <div className="chat-box">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.sender}`}>
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                ))}
            </div>

            <div className="input-area">
                <input
                    type="text"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button onClick={handleSendMessage}>Send</button>
            </div>
        </div>
    );
}

export default App;