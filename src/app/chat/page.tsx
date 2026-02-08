'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Bot, User, Utensils, Plus, X } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PixelArrowLeft, PixelBot, PixelSend } from "@/components/pixel-icons";

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    status: 'local' | 'analyzing' | 'analyzed' | 'saved' | 'failed'; // local = pending user confirmation, saved, failed
    isAnalyzing?: boolean;
    mealTypeHint?: string;
    analysisResult?: any; // Store AI analysis result temporarily
    isAddingItem?: boolean; // UI state for showing manual add input
    isAddingItemLoading?: boolean; // UI state for loading manual item
};

export default function ChatPage() {
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '안녕! 밥은 맛있게 먹었어? 😋 \n오늘은 어떤 맛있는 걸 먹었는지 알려줘!',
            timestamp: new Date(),
            status: 'saved',
        }
    ]);
    const [input, setInput] = useState('');
    const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
    const [selectedPersona, setSelectedPersona] = useState<string>('friendly');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        inputRef.current?.focus();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
            status: 'local', // Wait for confirmation
            mealTypeHint: selectedMealType,
        };

        setMessages(prev => [...prev, newMessage]);
        setInput('');
        setSelectedMealType(undefined); // Reset after send
    };

    const handleAnalyze = async (msg: Message, retryCount = 0) => {
        // Set analyzing state
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: true, status: 'analyzing' } : m));

        try {
            const response = await fetch('http://localhost:8000/v1/meals/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: msg.content,
                    client_local_time: new Date().toISOString(),
                    meal_type_hint: msg.mealTypeHint,
                    persona: selectedPersona
                }),
            });

            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('AI 사용량이 많아 잠시 후 다시 시도해주세요. (15초 대기 필요)');
                }
                throw new Error('Failed to analyze meal');
            }

            const data = await response.json();

            // Update to analyzed state with result
            setMessages(prev => prev.map(m => m.id === msg.id ? {
                ...m,
                status: 'analyzed',
                isAnalyzing: false,
                analysisResult: data
            } : m));

        } catch (error: any) {
            console.error(error);
            // Revert status to local so user can retry
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: false, status: 'local' } : m));

            // Add error message from assistant
            const errorMessage = error.message || "죄송합니다. 분석 중 오류가 발생했습니다.";
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `⚠️ ${errorMessage}`,
                timestamp: new Date(),
                status: 'failed'
            }]);
        }
    };

    const handleSave = async (msg: Message) => {
        if (!msg.analysisResult) return;

        // Set analyzing state for saving
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: true } : m));

        try {
            // Prepare creation payload
            const payload = {
                user_id: 1,
                raw_text: msg.content,
                meal_type: msg.analysisResult.meal_type,
                eaten_at: msg.analysisResult.eaten_at || new Date().toISOString(),
                items: msg.analysisResult.food_items.map((item: any) => ({
                    name: item.name,
                    qty: item.qty,
                    kcal: item.kcal,
                    macros: item.macros
                })),
                total_kcal: msg.analysisResult.total_kcal,
                macros: msg.analysisResult.macros,
                ai_summary: msg.analysisResult.message,
                confidence: msg.analysisResult.confidence
            };

            const response = await fetch('http://localhost:8000/v1/meals/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to save meal');
            const data = await response.json();

            // Mark as saved
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'saved', isAnalyzing: false } : m));

            // Add Assistant Response
            setMessages(prev => [...prev, {
                id: data.id.toString(),
                role: 'assistant',
                content: data.message || "기록되었습니다!",
                timestamp: new Date(data.created_at),
                status: 'saved'
            }]);

        } catch (error) {
            console.error(error);
            alert("저장 중 오류가 발생했습니다.");
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: false } : m));
        }
    };

    const handleRetry = (msg: Message) => {
        // Remove the message and put content back to input
        setMessages(prev => prev.filter(m => m.id !== msg.id));
        setInput(msg.content);
        if (msg.mealTypeHint) setSelectedMealType(msg.mealTypeHint);
    };

    const handleAddSuggestion = (msg: Message, suggestion: any) => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;

            // Deep clone analysisResult to modify
            const newAnalysis = JSON.parse(JSON.stringify(m.analysisResult));

            // Add suggestion to food_items
            newAnalysis.food_items.push(suggestion);

            // Remove from suggestions list
            newAnalysis.suggestions = newAnalysis.suggestions.filter((s: any) => s.name !== suggestion.name);

            // Update totals
            newAnalysis.total_kcal += suggestion.kcal;
            if (newAnalysis.macros && suggestion.macros) {
                newAnalysis.macros.carbs += suggestion.macros.carbs;
                newAnalysis.macros.protein += suggestion.macros.protein;
                newAnalysis.macros.fat += suggestion.macros.fat;

                // Round macros to 1 decimal
                newAnalysis.macros.carbs = Math.round(newAnalysis.macros.carbs * 10) / 10;
                newAnalysis.macros.protein = Math.round(newAnalysis.macros.protein * 10) / 10;
                newAnalysis.macros.fat = Math.round(newAnalysis.macros.fat * 10) / 10;
            }

            return { ...m, analysisResult: newAnalysis };
        }));
    };

    const handleRemoveItem = (msg: Message, index: number) => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;

            const newAnalysis = JSON.parse(JSON.stringify(m.analysisResult));
            const removedItem = newAnalysis.food_items[index];
            newAnalysis.food_items.splice(index, 1);

            // Update totals
            newAnalysis.total_kcal -= removedItem.kcal;
            if (newAnalysis.macros && removedItem.macros) {
                newAnalysis.macros.carbs -= removedItem.macros.carbs;
                newAnalysis.macros.protein -= removedItem.macros.protein;
                newAnalysis.macros.fat -= removedItem.macros.fat;
            }

            return { ...m, analysisResult: newAnalysis };
        }));
    };

    const handleManualAddItem = async (msg: Message, name: string, kcalInput: number) => {
        if (!name) return;

        // set loading
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAddingItemLoading: true } : m));

        let kcal = kcalInput;
        let macros = { carbs: 0, protein: 0, fat: 0 };
        let qty = "1 serving";

        // If kcal is 0, try to auto-analyze
        if (kcal === 0) {
            try {
                const response = await fetch('http://localhost:8000/v1/meals/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: name,
                        client_local_time: new Date().toISOString(),
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.food_items && data.food_items.length > 0) {
                        const item = data.food_items[0];
                        kcal = item.kcal;
                        if (item.macros) macros = item.macros;
                        qty = item.qty;
                    }
                }
            } catch (e) {
                console.error("Auto analyze failed", e);
            }
        }

        setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;

            const newAnalysis = JSON.parse(JSON.stringify(m.analysisResult));
            const newItem = {
                name,
                qty,
                kcal,
                macros
            };
            newAnalysis.food_items.push(newItem);

            // Update totals
            newAnalysis.total_kcal += kcal;
            if (newAnalysis.macros) {
                newAnalysis.macros.carbs += macros.carbs;
                newAnalysis.macros.protein += macros.protein;
                newAnalysis.macros.fat += macros.fat;

                // Round
                newAnalysis.macros.carbs = Math.round(newAnalysis.macros.carbs * 10) / 10;
                newAnalysis.macros.protein = Math.round(newAnalysis.macros.protein * 10) / 10;
                newAnalysis.macros.fat = Math.round(newAnalysis.macros.fat * 10) / 10;
            }

            return { ...m, analysisResult: newAnalysis, isAddingItem: false, isAddingItemLoading: false };
        }));
    };

    const toggleAddingItem = (msg: Message) => {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAddingItem: !m.isAddingItem } : m));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isPixel = mounted && theme === 'pixel';

    return (
        <div className="flex flex-col h-svh bg-background max-w-md mx-auto shadow-2xl overflow-hidden md:border-x pixel:shadow-none pixel:border-x-2 pixel:border-border">
            {/* Header */}
            <header className="flex items-center p-4 border-b bg-white/80 backdrop-blur-md sticky top-0 z-10 pixel:bg-background pixel:backdrop-blur-none pixel:border-b-2 pixel:border-border">
                <Link href="/" passHref>
                    <Button variant="ghost" size="icon" className="-ml-2 hover:bg-transparent pixel:hover:bg-muted">
                        {isPixel ? <PixelArrowLeft className="h-6 w-6 text-foreground" /> : <ArrowLeft className="h-6 w-6 text-primary" />}
                    </Button>
                </Link>
                <div className="flex items-center ml-2">
                    <div className={`p-2 rounded-full mr-3 ${isPixel ? 'bg-muted rounded-none border-2 border-border' : 'bg-primary/10'}`}>
                        {isPixel ? <PixelBot className="h-5 w-5 text-foreground" /> : <Bot className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                        <h1 className="font-bold text-lg pixel:text-sm">Bitelog AI</h1>
                        <p className="text-xs text-muted-foreground pixel:text-[10px]">Online</p>
                    </div>
                </div>
                <div className="ml-auto">
                    <select
                        value={selectedPersona}
                        onChange={(e) => setSelectedPersona(e.target.value)}
                        className={`text-xs border rounded p-1 outline-none cursor-pointer ${isPixel ? 'bg-background border-2 border-border rounded-none' : 'bg-transparent border-gray-200'}`}
                    >
                        <option value="friendly">친근하게</option>
                        <option value="strict">엄격하게</option>
                        <option value="humorous">유머러스하게</option>
                    </select>
                </div>
            </header>

            {/* Meal Type Selection (Optional) */}
            <div className={`px-4 pt-2 -mb-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0 z-10 bg-background/50 backdrop-blur-sm`}>
                {
                    ['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setSelectedMealType(selectedMealType === type ? undefined : type)}
                            className={`text-xs px-3 py-1 rounded-full border transition-all whitespace-nowrap ${selectedMealType === type
                                ? (isPixel ? 'bg-primary text-primary-foreground border-border border-2' : 'bg-primary text-white border-primary')
                                : (isPixel ? 'bg-background border-border border-2 text-muted-foreground' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50')
                                }`}
                        >
                            {type === 'breakfast' ? '아침' : type === 'lunch' ? '점심' : type === 'dinner' ? '저녁' : '간식'}
                        </button>
                    ))
                }
            </div>

            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isPixel ? 'bg-background' : 'bg-slate-50/50'}`}>
                {
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex w-full flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                                    {msg.role === 'assistant' && (
                                        <Avatar className={`h-8 w-8 mb-1 shadow-sm ${isPixel ? 'rounded-none border-2 border-border bg-muted' : 'border-2 border-white'}`}>
                                            <AvatarFallback className={`${isPixel ? 'bg-muted text-foreground rounded-none' : 'bg-primary text-white'}`}>
                                                {isPixel ? <PixelBot size={16} /> : <Bot size={16} />}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div
                                        className={`p-3.5 shadow-sm text-sm leading-relaxed ${isPixel
                                            ? `border-2 border-border text-foreground ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'}`
                                            : `rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`
                                            }`}
                                    >
                                        {msg.content}
                                        {msg.mealTypeHint && (
                                            <div className="text-[10px] opacity-70 mt-1 border-t border-current/20 pt-1">
                                                {msg.mealTypeHint === 'breakfast' ? '아침' : msg.mealTypeHint === 'lunch' ? '점심' : msg.mealTypeHint === 'dinner' ? '저녁' : '간식'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>


                            {/* Analyzing Status UI */}
                            {msg.role === 'user' && msg.status === 'analyzing' && (
                                <div className={`mt-2 p-4 rounded-xl shadow-sm border space-y-3 w-full max-w-[90%] self-end ${isPixel ? 'pixel:rounded-none pixel:border-2 pixel:border-border pixel:shadow-none bg-background' : 'bg-white'}`}>
                                    <div className="flex items-center justify-center gap-3 py-2 text-muted-foreground">
                                        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                        <span className="text-sm font-medium animate-pulse">AI가 식사를 분석하고 있어요... 🤖</span>
                                    </div>
                                </div>
                            )}

                            {/* Confirmation UI for Analyzed Messages */}
                            {msg.role === 'user' && msg.status === 'analyzed' && msg.analysisResult && (
                                <div className={`mt-2 p-4 rounded-xl shadow-sm border space-y-3 w-full max-w-[90%] self-end ${isPixel ? 'pixel:rounded-none pixel:border-2 pixel:border-border pixel:shadow-none bg-background' : 'bg-white'}`}>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm font-semibold">
                                            <span className="capitalize">{msg.analysisResult.meal_type}</span>
                                            <span className="text-primary">{msg.analysisResult.total_kcal} kcal</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {msg.analysisResult.eaten_at ? new Date(msg.analysisResult.eaten_at).toLocaleString() : '현재 시간'}
                                        </div>
                                        <ul className="text-sm space-y-1 pt-1 max-h-40 overflow-y-auto pr-1 scrollbar-hide">
                                            {msg.analysisResult.food_items.map((item: any, idx: number) => (
                                                <li key={idx} className="flex justify-between items-center bg-muted/30 p-1.5 rounded-md text-xs pixel:rounded-none group">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleRemoveItem(msg, idx)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                        <span>{item.name} <span className="opacity-70">({item.qty})</span></span>
                                                    </div>
                                                    <span className="font-medium whitespace-nowrap ml-2">{item.kcal} kcal</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* Manual Add Button/Form */}
                                        <div className="pt-2">
                                            {msg.isAddingItem ? (
                                                <div className="flex gap-2 items-center bg-muted/20 p-2 rounded-md">
                                                    <Input
                                                        placeholder="음식명"
                                                        className="h-7 text-xs px-2 bg-background border-border"
                                                        id={`add-name-${msg.id}`}
                                                    />
                                                    <Input
                                                        placeholder="kcal (자동)"
                                                        type="number"
                                                        className="h-7 text-xs px-2 w-20 bg-background border-border"
                                                        id={`add-kcal-${msg.id}`}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-7 px-2"
                                                        disabled={msg.isAddingItemLoading}
                                                        onClick={() => {
                                                            const nameInput = document.getElementById(`add-name-${msg.id}`) as HTMLInputElement;
                                                            const kcalInput = document.getElementById(`add-kcal-${msg.id}`) as HTMLInputElement;
                                                            handleManualAddItem(msg, nameInput.value, parseInt(kcalInput.value) || 0);
                                                        }}
                                                    >
                                                        {msg.isAddingItemLoading ? "..." : "추가"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2"
                                                        onClick={() => toggleAddingItem(msg)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => toggleAddingItem(msg)}
                                                    className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                                >
                                                    <Plus className="h-3 w-3" /> 직접 추가
                                                </button>
                                            )}
                                        </div>

                                        {/* Suggestions */}
                                        {msg.analysisResult.suggestions && msg.analysisResult.suggestions.length > 0 && (
                                            <div className="pt-2 border-t border-dashed">
                                                <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                                                    <Utensils className="h-3 w-3" /> 함께 드셨나요? (클릭하여 추가)
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.analysisResult.suggestions.map((s: any, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleAddSuggestion(msg, s)}
                                                            className="text-xs px-2 py-1 bg-primary/5 text-primary rounded-full hover:bg-primary/10 transition-colors border border-primary/10 pixel:rounded-none"
                                                        >
                                                            + {s.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 justify-end pt-2 border-t">
                                        <Button size="sm" variant="secondary" onClick={() => handleRetry(msg)} className="h-8 pixel:rounded-none pixel:border pixel:border-border">다시 입력</Button>
                                        <Button size="sm" onClick={() => handleSave(msg)} disabled={msg.isAnalyzing} className="h-8 pixel:rounded-none pixel:border-2 pixel:border-border">
                                            {msg.isAnalyzing ? "저장 중..." : "맞아요, 저장할게요"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Initial Analyze Button for Local User Messages */}
                            {msg.role === 'user' && msg.status === 'local' && (
                                <div className="mt-2 mr-1">
                                    <Button
                                        size="sm"
                                        onClick={() => handleAnalyze(msg)}
                                        disabled={msg.isAnalyzing}
                                        className={`${isPixel ? 'rounded-none border-2 border-border h-8' : 'rounded-full h-8'}`}
                                    >
                                        {msg.isAnalyzing ? "분석 중..." : "분석 시작"}
                                        {!msg.isAnalyzing && (isPixel ? <PixelSend className="ml-2 h-3 w-3" /> : <Send className="ml-2 h-3 w-3" />)}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                }
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={`p-4 border-t safe-area-bottom ${isPixel ? 'bg-background border-border border-t-2' : 'bg-white'}`}>
                <div className={`flex items-center gap-2 p-1.5 transition-all ${isPixel
                    ? 'bg-card border-2 border-border'
                    : 'bg-gray-50 rounded-full border border-gray-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30'
                    }`}>
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="예: 점심에 김치찌개 먹었어"
                        className={`border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3 h-auto text-base ${isPixel ? 'placeholder:text-muted-foreground/70' : ''}`}
                    />
                    <Button
                        onClick={handleSend}
                        size="icon"
                        className={`shrink-0 shadow-sm ${isPixel ? 'rounded-none h-10 w-10 border-2 border-border bg-primary text-primary-foreground hover:translate-y-0.5 active:translate-y-1'
                            : 'rounded-full h-10 w-10'
                            }`}
                        disabled={!input.trim()}
                    >
                        {isPixel ? <PixelSend className="h-4 w-4" /> : <Send className="h-4 w-4 ml-0.5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
