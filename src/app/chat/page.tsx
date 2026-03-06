"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { getAuthHeaders, removeToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Macros = {
    carbs: number;
    protein: number;
    fat: number;
};

type FoodItem = {
    name: string;
    qty: string;
    kcal: number;
    macros?: Macros;
};

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    buttons?: { label: string; action: 'save' | 'cancel' }[];
    suggestions?: FoodItem[];
};

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [manualInput, setManualInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [livePrintText, setLivePrintText] = useState("");
    const [pendingMeal, setPendingMeal] = useState<any>(null); // Store analyzed data before saving
    const scrollRef = useRef<HTMLDivElement>(null);
    const nextMessageIdRef = useRef(1);
    const hasBootedRef = useRef(false);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isBotTyping, livePrintText]);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const pushMessage = (role: Message["role"], content: string) => {
        const id = nextMessageIdRef.current;
        nextMessageIdRef.current += 1;
        setMessages((prev) => [...prev, { id, role, content }]);
    };

    const pushBotMessage = async (content: string, delayMs = 220) => {
        setIsBotTyping(true);
        await sleep(delayMs);
        setIsBotTyping(false);

        setLivePrintText("");
        for (let i = 1; i <= content.length; i += 1) {
            setLivePrintText(content.slice(0, i));
            await sleep(22);
        }

        pushMessage("assistant", content);
        setLivePrintText("");
    };

    useEffect(() => {
        if (hasBootedRef.current) return;
        hasBootedRef.current = true;
        void pushBotMessage('무엇을 드셨는지 자세하게 알려주세요.\n\n예시: "오늘 아침으로 닭가슴살 샐러드랑 사과 하나 먹었어."', 120);
    }, []);

    const formatAnalysisText = (meal: any) => {
        let text = `I found:\n`;
        meal.food_items.forEach((item: any) => {
            text += `- ${item.name} (${item.qty}): ${item.kcal}kcal\n`;
        });

        if (meal.macros) {
            text += `\nTotal: ${meal.total_kcal}kcal (C:${meal.macros.carbs}g P:${meal.macros.protein}g F:${meal.macros.fat}g)\n`;
        } else {
            text += `\nTotal: ${meal.total_kcal}kcal\n`;
        }

        text += `\n${meal.ai_summary || meal.message}`;
        return text;
    };

    const handleAddSuggestion = (item: FoodItem) => {
        if (!pendingMeal) return;

        const updatedMeal = { ...pendingMeal };
        updatedMeal.food_items = [...updatedMeal.food_items, item];
        updatedMeal.total_kcal += item.kcal;

        if (item.macros && updatedMeal.macros) {
            updatedMeal.macros = {
                carbs: updatedMeal.macros.carbs + item.macros.carbs,
                protein: updatedMeal.macros.protein + item.macros.protein,
                fat: updatedMeal.macros.fat + item.macros.fat
            };
        }

        setPendingMeal(updatedMeal);

        // Update the last message
        setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
                lastMsg.content = formatAnalysisText(updatedMeal);
                // Remove the added suggestion from the list
                if (lastMsg.suggestions) {
                    lastMsg.suggestions = lastMsg.suggestions.filter(s => s.name !== item.name);
                }
            }
            return newMsgs;
        });
    };

    const handleConfirm = async () => {
        if (!pendingMeal || loading) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/v1/meals/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    ...pendingMeal,
                    total_kcal: pendingMeal.total_kcal,
                    items: pendingMeal.food_items.map((item: any) => ({
                        name: item.name,
                        qty: item.qty,
                        kcal: item.kcal,
                        macros: item.macros
                    }))
                }),
            });

            if (res.status === 401) {
                removeToken();
                router.push("/login");
                return;
            }
            if (!res.ok) throw new Error("Failed to save meal");
            const data = await res.json();

            await pushBotMessage(formatAnalysisText(pendingMeal) + `\n\n저장되었습니다! 주문번호 #${data.id}`);
            setPendingMeal(null);
        } catch (error) {
            console.error(error);
            await pushBotMessage("저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        await pushBotMessage("취소했습니다. 다시 말씀해주세요.");
        setPendingMeal(null);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        if (pendingMeal) setPendingMeal(null);

        const userMsg: Message = { id: nextMessageIdRef.current, role: 'user', content: input };
        nextMessageIdRef.current += 1;
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/v1/meals/analyze`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    text: userMsg.content,
                    client_local_time: new Date().toISOString(),
                    meal_type_hint: "snack",
                    persona: "friendly"
                }),
            });

            if (res.status === 401) {
                removeToken();
                router.push("/login");
                return;
            }
            if (!res.ok) throw new Error("Failed to analyze meal");
            const data = await res.json();

            const newMealData = {
                user_id: 1,
                raw_text: userMsg.content,
                meal_type: data.meal_type,
                eaten_at: data.eaten_at || new Date().toISOString(),
                macros: data.macros,
                total_kcal: data.total_kcal,
                ai_summary: data.message,
                food_items: data.food_items
            };

            // Do not add message yet, just show the review UI
            const mealWithSuggestions = {
                ...newMealData,
                suggestions: data.suggestions || []
            };

            setPendingMeal(mealWithSuggestions);

        } catch (error) {
            console.error(error);
            await pushBotMessage("오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveItem = (index: number) => {
        if (!pendingMeal) return;
        const updatedMeal = { ...pendingMeal };
        const removedItem = updatedMeal.food_items[index];

        updatedMeal.food_items = updatedMeal.food_items.filter((_: any, i: number) => i !== index);
        updatedMeal.total_kcal = Math.max(0, updatedMeal.total_kcal - removedItem.kcal);

        if (removedItem.macros && updatedMeal.macros) {
            updatedMeal.macros = {
                carbs: Math.max(0, updatedMeal.macros.carbs - removedItem.macros.carbs),
                protein: Math.max(0, updatedMeal.macros.protein - removedItem.macros.protein),
                fat: Math.max(0, updatedMeal.macros.fat - removedItem.macros.fat)
            };
        }
        setPendingMeal(updatedMeal);
    };

    const handleManualAddItem = () => {
        if (!pendingMeal || !manualInput.trim()) return;

        const newItem: FoodItem = {
            name: manualInput,
            qty: "1 serving",
            kcal: 0,
        };

        const updatedMeal = { ...pendingMeal };
        updatedMeal.food_items = [...updatedMeal.food_items, newItem];
        setPendingMeal(updatedMeal);
        setManualInput("");
    };

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[80vh] flex flex-col">
                <div className="receipt-zigzag-top" />

                {/* Header */}
                <div className="p-4 border-b-2 border-dashed border-black/20 flex items-center justify-between bg-white sticky top-0 z-10">
                    <Link href="/" className="text-xs font-bold uppercase hover:bg-black/5 p-2 -ml-2 rounded">
                        &lt; Back
                    </Link>
                    <h1 className="text-xl font-bold uppercase tracking-widest">LOG CHAT</h1>
                    <div className="w-8" />
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                    <div className="text-center text-[10px] text-black/40 uppercase tracking-widest border-b border-black/10 pb-4 mb-4">
                        --- Start of Log ---
                    </div>

                    {messages.map((msg) => (
                        <div key={msg.id} className="print-line text-[11px] leading-relaxed border-b border-dashed border-black/10 pb-1">
                            <div className={`whitespace-pre-wrap ${msg.role === "assistant" ? "text-black/80" : "text-black font-bold"}`}>
                                {msg.role === "assistant" ? `BITELOG > ${msg.content}` : `> ${msg.content}`}
                            </div>
                            {msg.buttons && (
                                <div className="mt-2 flex gap-2">
                                    {msg.buttons.map((btn, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => btn.action === 'save' ? handleConfirm() : handleCancel()}
                                            disabled={loading}
                                            className={`
                                              px-4 py-1 text-xs font-bold uppercase border-2 border-black
                                              ${btn.action === 'save'
                                                    ? 'bg-black text-white hover:bg-gray-800'
                                                    : 'bg-white text-black hover:bg-gray-100'}
                                            `}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {msg.suggestions && msg.suggestions.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[10px] text-black/50 uppercase font-bold mb-1">Did you also have?</p>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.suggestions.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleAddSuggestion(item)}
                                                disabled={loading}
                                                className="bg-white border border-black/20 text-xs px-2 py-1 hover:bg-black hover:text-white transition-colors rounded-full"
                                            >
                                                + {item.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ))}

                    {(loading || isBotTyping) && (
                        <div className="print-line text-[11px] text-black/60 border-b border-dashed border-black/10 pb-1">
                            <div className="typing-wrap">
                                <span className="mr-1">BITELOG &gt;</span>
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    )}
                    {!!livePrintText && (
                        <div className="print-line text-[11px] text-black/80 border-b border-dashed border-black/10 pb-1">
                            <div className="whitespace-pre-wrap">
                                {`BITELOG > ${livePrintText}`}
                                <span className="print-cursor" />
                            </div>
                        </div>
                    )}

                    {pendingMeal && !loading && (
                        <div className="flex flex-col items-start w-full">
                            <span className="text-[10px] font-bold text-black/40 mb-1 uppercase">식사 확인</span>
                            <div className="w-full bg-white border-2 border-black p-3 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                <div className="mb-3 border-b-2 border-black/10 pb-2">
                                    <select
                                        value={pendingMeal.meal_type}
                                        onChange={(e) => setPendingMeal({ ...pendingMeal, meal_type: e.target.value })}
                                        className="font-bold text-lg mb-1 bg-transparent border-b border-black/20 focus:outline-none cursor-pointer"
                                    >
                                        <option value="breakfast">BREAKFAST</option>
                                        <option value="lunch">LUNCH</option>
                                        <option value="dinner">DINNER</option>
                                        <option value="snack">SNACK</option>
                                    </select>
                                    <input
                                        type="datetime-local"
                                        value={new Date(new Date(pendingMeal.eaten_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        onChange={(e) => setPendingMeal({ ...pendingMeal, eaten_at: new Date(e.target.value).toISOString() })}
                                        className="text-xs text-black/50 bg-transparent border-b border-black/20 focus:outline-none w-full font-mono block"
                                    />
                                </div>

                                <div className="space-y-2 mb-4">
                                    {pendingMeal.food_items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-black/5 p-2 rounded">
                                            <div>
                                                <span className="font-bold text-sm block">{item.name}</span>
                                                <span className="text-xs text-black/50">{item.qty} | {item.kcal}kcal</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(idx)}
                                                className="text-red-500 hover:text-red-700 font-bold px-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Manual Add */}
                                <div className="flex gap-2 mb-4 border-t border-black/10 pt-3">
                                    <input
                                        type="text"
                                        value={manualInput}
                                        onChange={(e) => setManualInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                                handleManualAddItem();
                                            }
                                        }}
                                        placeholder="+ 직접 추가하기"
                                        className="flex-1 bg-white border border-black/20 text-xs p-2 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleManualAddItem}
                                        className="bg-black text-white text-xs px-3 py-1 font-bold"
                                    >
                                        추가
                                    </button>
                                </div>

                                <div className="flex justify-between items-center border-t-2 border-dashed border-black/20 pt-3 mb-3">
                                    <span className="font-bold">합계</span>
                                    <span className="font-bold text-xl">{pendingMeal.total_kcal} kcal</span>
                                </div>

                                <p className="text-xs text-black/60 italic mb-4">"{pendingMeal.ai_summary}"</p>

                                {pendingMeal.suggestions && pendingMeal.suggestions.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-[10px] text-black/50 uppercase font-bold mb-1">혹시 이것도 드셨나요?</p>
                                        <div className="flex flex-wrap gap-2">
                                            {pendingMeal.suggestions.map((item: any, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAddSuggestion(item)}
                                                    className="bg-white border border-black/20 text-xs px-2 py-1 hover:bg-black hover:text-white transition-colors rounded-full"
                                                >
                                                    + {item.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading}
                                        className="flex-1 bg-black text-white py-2 text-sm font-bold uppercase hover:bg-gray-800 border-2 border-black"
                                    >
                                        저장하기
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={loading}
                                        className="flex-1 bg-white text-black py-2 text-sm font-bold uppercase hover:bg-gray-100 border-2 border-black"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t-2 border-dashed border-black/20 bg-white sticky bottom-0 z-10">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    handleSend();
                                }
                            }}
                            placeholder="오늘 먹은 음식을 입력하세요..."
                            className="flex-1 bg-white border-2 border-black p-3 text-sm font-mono focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow placeholder:text-black/20"
                        />
                        <button
                            onClick={handleSend}
                            className="bg-black text-white px-4 border-2 border-black hover:bg-gray-800 transition-colors flex items-center justify-center"
                            disabled={loading}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                    {/* Barcode removed */}
                </div>

                <div className="receipt-zigzag-bottom" />
            </div>
            <style jsx>{`
                .typing-wrap {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .typing-dot {
                    width: 4px;
                    height: 4px;
                    border-radius: 9999px;
                    background: rgba(0, 0, 0, 0.7);
                    animation: pulse 1s infinite ease-in-out;
                }
                .typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }
                .typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }
                .print-cursor {
                    display: inline-block;
                    width: 6px;
                    height: 1em;
                    background: rgba(0, 0, 0, 0.8);
                    margin-left: 3px;
                    vertical-align: text-bottom;
                    animation: blink 1s steps(1, end) infinite;
                }
                @keyframes pulse {
                    0%,
                    80%,
                    100% {
                        opacity: 0.2;
                    }
                    40% {
                        opacity: 1;
                    }
                }
                @keyframes blink {
                    0%,
                    49% {
                        opacity: 1;
                    }
                    50%,
                    100% {
                        opacity: 0;
                    }
                }
            `}</style>
        </main>
    );
}
