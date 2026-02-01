'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Bot, User, Utensils } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PixelArrowLeft, PixelBot, PixelSend } from "@/components/pixel-icons";

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

export default function ChatPage() {
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '안녕하세요! 오늘 어떤 음식을 드셨나요? 편하게 말씀해 주세요.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
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

    const handleSend = () => {
        if (!input.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInput('');

        // TODO: Connect to backend API later
        // Simulate AI response for now
        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `"${input}" 기록이 완료되었습니다! (백엔드 연동 전 데모)`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
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
            </header>

            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isPixel ? 'bg-background' : 'bg-slate-50/50'}`}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
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
                            </div>
                        </div>
                    </div>
                ))}
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
