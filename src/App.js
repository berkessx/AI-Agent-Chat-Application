
import React, { useEffect, useState, useRef } from "react";
import { db, functionUrl } from "./firebaseConfig";
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";
import "./App.css";

function App() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, "messages"), orderBy("timestamp"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map((doc) => doc.data());
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (msg) => {
        if (!msg.trim()) return;
        setLoading(true);

        await addDoc(collection(db, "messages"), {
            role: "user",
            content: msg,
            timestamp: serverTimestamp(),
            type: "text",
        });

        try {
            const contextMessages = [
                { role: "system", content: "Sen çok iyi bir asistansın." },
                ...messages.slice(-10).map(({ role, content }) => ({ role, content })),
                { role: "user", content: msg }
            ];

            const response = await fetch(functionUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: contextMessages }),
            });

            const data = await response.json();
            
            const botReply = {
                role: "assistant",
                content: data.reply || "Sunucuda bir hata oluştu.",
                type: data.type || "text",
                data: data.data || null,
            };

            await addDoc(collection(db, "messages"), {
                ...botReply,
                timestamp: serverTimestamp(),
            });
        } catch (error) {
            console.error("Hata:", error);
            await addDoc(collection(db, "messages"), {
                role: "assistant",
                content: "Sunucuda bir hata oluştu.",
                timestamp: serverTimestamp(),
                type: "text",
            });
        } finally {
            setInput("");
            setLoading(false);
        }
    };

    // (show details, make payment)
    const handleAction = (action, billData) => {
        if (action === "details") {
            sendMessage(`Show me the detailed bill for subscriber ${billData.subscriber_no}, ${billData.year}-${billData.month}`);
        } else if (action === "pay") {
            sendMessage(`Pay the bill for subscriber ${billData.subscriber_no}, ${billData.year}-${billData.month}`);
        }
    };

    
    const renderMessage = (msg, index) => {
        if (msg.type === "summary" && msg.data) {
            const bill = msg.data;
            return (
                <div key={index} className="message bot">
                    <div className="bubble">
                        <b>Bill Summary:</b><br />
                        Subscriber: {bill.subscriber_no}<br />
                        Month: {bill.year}-{bill.month}<br />
                        Amount Due: ${bill.amount_due}<br />
                        Due Date: {bill.due_date}<br />
                        <div style={{ marginTop: 8 }}>
                            <button onClick={() => handleAction("details", bill)}>Show Details</button>
                            <button onClick={() => handleAction("pay", bill)} style={{ marginLeft: 8 }}>Pay</button>
                        </div>
                    </div>
                </div>
            );
        }
        if (msg.type === "detail" && msg.data) {
            const bill = msg.data;
            return (
                <div key={index} className="message bot">
                    <div className="bubble">
                        <b>Bill Details for {bill.year}-{bill.month}:</b><br />
                        Base Plan: ${bill.base}<br />
                        Data Usage (Extra): ${bill.extra}<br />
                        VAT/Taxes: ${bill.tax}<br />
                        Total Due: ${bill.amount_due}<br />
                        Due Date: {bill.due_date}
                    </div>
                </div>
            );
        }
        if (msg.type === "payment" && msg.data) {
            return (
                <div key={index} className="message bot">
                    <div className="bubble">
                        <span style={{ color: "green" }}>✅ Payment successful!</span><br />
                        <b>Payment Summary:</b><br />
                        Subscriber: {msg.data.subscriber_no}<br />
                        Month: {msg.data.year}-{msg.data.month}<br />
                        Amount: ${msg.data.amount_due}
                    </div>
                </div>
            );
        }
        
        return (
            <div key={index} className={`message ${msg.role === "user" ? "user" : "bot"}`}>
                <div className="bubble">{msg.content}</div>
            </div>
        );
    };

    return (
        <div className="app-container">
            <div className="header">🤖 Agent</div>
            <div className="message-list">
                {messages.map(renderMessage)}
                {loading && (
                    <div className="message bot">
                        <div className="bubble">Bot yazıyor...</div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mesaj yaz..."
                />
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
                    {loading ? "..." : "Gönder"}
                </button>
            </div>
        </div>
    );
}

export default App;