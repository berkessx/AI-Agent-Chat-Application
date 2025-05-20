const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();


const GEMINI_API_KEY = 'AIzaSyC2h-SSPDIEgXg5k7vvBmZ82slzs-d4yeA'; 


function extractBillInfo(message) {
    const subMatch = message.match(/(\d{6,})/);
    const monthMatch = message.match(/(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})/i);
    const yearMatch = message.match(/20\d{2}/);
    let month = null;
    if (monthMatch) {
        if (isNaN(monthMatch[0])) {
            
            month = ("0" + (new Date(Date.parse(monthMatch[0] + " 1, 2012")).getMonth() + 1)).slice(-2);
        } else {
            
            month = ("0" + monthMatch[0]).slice(-2);
        }
    }
    return {
        subscriber_no: subMatch ? subMatch[1] : null,
        month,
        year: yearMatch ? yearMatch[0] : null
    };
}


function parseIntent(messages) {
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    if (lastMsg.includes('detailed bill') || lastMsg.includes('detaylı fatura')) return 'bill_detail';
    if (lastMsg.includes('pay') || lastMsg.includes('öde')) return 'pay_bill';
    if (lastMsg.match(/bill.*\d{6,}/) || lastMsg.match(/fatura.*\d{6,}/)) return 'bill_summary';
    return 'chat';
}

exports.chatAI = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== 'POST') {
                return res.status(405).send({ error: 'Method Not Allowed' });
            }
            const { messages } = req.body;
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).send({ error: 'Messages array is required' });
            }

            const userMsg = messages[messages.length - 1].content;
            const intent = parseIntent(messages);
            const billInfo = extractBillInfo(userMsg);

            const docId = billInfo.subscriber_no && billInfo.year && billInfo.month
                ? `${billInfo.subscriber_no}_${billInfo.year}_${billInfo.month}`
                : null;
            console.log("docId:", docId);

            // Fatura özeti
            if (intent === 'bill_summary' && docId) {
                const billDoc = await db.collection('bills').doc(docId).get();
                if (!billDoc.exists) {
                    return res.status(200).send({
                        reply: "No bill found for that subscriber and month.",
                        type: "text"
                    });
                }
                const bill = billDoc.data();
                return res.status(200).send({
                    reply: `Bill summary for subscriber ${bill.subscriber_no}, ${bill.year}-${bill.month}: $${bill.amount_due} due on ${bill.due_date}`,
                    type: "summary",
                    data: bill
                });
            }

            // Fatura detayı
            if (intent === 'bill_detail' && docId) {
                const billDoc = await db.collection('bills').doc(docId).get();
                if (!billDoc.exists) {
                    return res.status(200).send({
                        reply: "No bill found for that subscriber and month.",
                        type: "text"
                    });
                }
                const bill = billDoc.data();
                return res.status(200).send({
                    reply: `Bill details for subscriber ${bill.subscriber_no}, ${bill.year}-${bill.month}`,
                    type: "detail",
                    data: bill
                });
            }

            // Fatura ödeme
            if (intent === 'pay_bill' && docId) {
                const billRef = db.collection('bills').doc(docId);
                const billDoc = await billRef.get();
                if (!billDoc.exists) {
                    return res.status(200).send({
                        reply: "No bill found for that subscriber and month.",
                        type: "text"
                    });
                }
                const bill = billDoc.data();
                if (bill.is_paid) {
                    return res.status(200).send({
                        reply: "This bill is already paid.",
                        type: "payment",
                        data: bill
                    });
                }
                await billRef.update({ is_paid: true });
                return res.status(200).send({
                    reply: "Payment successful!",
                    type: "payment",
                    data: { ...bill, is_paid: true }
                });
            }

            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${AIzaSyC2h-SSPDIEgXg5k7vvBmZ82slzs-d4yeA}`;
            const payload = {
                contents: [
                    {
                        parts: messages.map(m => ({ text: `${m.role}: ${m.content}` }))
                    }
                ]
            };
            const geminiRes = await axios.post(geminiUrl, payload);
            const aiReply = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
            return res.status(200).send({
                reply: aiReply,
                type: "text"
            });

        } catch (error) {
            console.error("Function error:", error);
            return res.status(500).send({ error: "Internal Server Error" });
        }
    });
});