"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

type RegisterStep = "email" | "nickname" | "password" | "confirm";
type ChatRole = "bot" | "user";

type ChatMessage = {
    id: number;
    role: ChatRole;
    text: string;
};

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nickname, setNickname] = useState("");
    const [input, setInput] = useState("");
    const [step, setStep] = useState<RegisterStep>("email");
    const [editingField, setEditingField] = useState<"email" | "nickname" | "password" | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 1, role: "bot", text: "안녕하세요. Bitelog 회원가입을 도와드릴게요." },
        { id: 2, role: "bot", text: "먼저 이메일을 입력해주세요." },
    ]);

    const router = useRouter();
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const nextMessageIdRef = useRef(3);

    const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value);
    const passwordCharLength = Array.from(input).length;

    const pushMessage = (role: ChatRole, text: string) => {
        const id = nextMessageIdRef.current;
        nextMessageIdRef.current += 1;
        setMessages((prev) => [...prev, { id, role, text }]);
    };

    const pushBotMessage = async (text: string, delayMs = 320) => {
        setIsBotTyping(true);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        pushMessage("bot", text);
        setIsBotTyping(false);
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleRegister = async () => {
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/v1/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, nickname }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Registration failed");
            }

            await pushBotMessage("가입이 완료되었어요. 로그인 화면으로 이동할게요.", 260);
            setTimeout(() => {
                router.push("/login");
            }, 700);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Registration failed";
            setError(message);
            await pushBotMessage(`가입 중 문제가 발생했어요: ${message}`, 260);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (loading) return;
        setError("");

        if (step === "email") {
            const nextEmail = input.trim();
            if (!isEmailValid(nextEmail)) {
                setError("이메일 형식을 확인해주세요.");
                return;
            }

            pushMessage("user", nextEmail);
            setEmail(nextEmail);
            setInput("");
            if (editingField === "email") {
                setEditingField(null);
                setStep("confirm");
                await pushBotMessage("이메일을 수정했어요. 다른 항목도 수정하려면 눌러서 바꿀 수 있어요.", 220);
            } else {
                setStep("nickname");
                await pushBotMessage("닉네임을 입력해주세요. 건너뛰려면 아래 버튼을 눌러도 됩니다.");
            }
            return;
        }

        if (step === "nickname") {
            const nextNickname = input.trim();
            if (!nextNickname && editingField !== "nickname") {
                setError("닉네임을 입력하거나 건너뛰기를 눌러주세요.");
                return;
            }

            pushMessage("user", nextNickname || "(닉네임 미입력)");
            setNickname(nextNickname);
            setInput("");
            if (editingField === "nickname") {
                setEditingField(null);
                setStep("confirm");
                await pushBotMessage("닉네임을 수정했어요. 다른 항목도 클릭해서 바꿀 수 있어요.", 220);
            } else {
                setStep("password");
                await pushBotMessage("비밀번호를 입력해주세요. (6자 이상)");
            }
            return;
        }

        if (step === "password") {
            if (input.length < 6) {
                setError("비밀번호는 6자 이상이어야 해요.");
                return;
            }
            if (new TextEncoder().encode(input).length > 72) {
                setError("비밀번호가 너무 길어요. 72바이트 이하로 입력해주세요.");
                return;
            }

            pushMessage("user", "*".repeat(input.length));
            setPassword(input);
            setInput("");
            setEditingField(null);
            setStep("confirm");
            await pushBotMessage(`확인할게요. 이메일: ${email}${nickname ? `, 닉네임: ${nickname}` : ", 닉네임: (미입력)"}`);
            await pushBotMessage("수정하고 싶은 내용이 있다면 수정할 내용을 클릭해주세요. 모두 맞으면 가입하기를 눌러주세요.", 220);
            return;
        }

        if (step === "confirm") {
            pushMessage("user", "가입하기");
            await handleRegister();
        }
    };

    const handleSkipNickname = async () => {
        if (step !== "nickname" || loading) return;

        setError("");
        pushMessage("user", "(닉네임 건너뛰기)");
        setNickname("");
        setInput("");
        if (editingField === "nickname") {
            setEditingField(null);
            setStep("confirm");
            await pushBotMessage("닉네임을 비워두었어요. 다른 항목도 클릭해서 수정할 수 있어요.", 220);
        } else {
            setStep("password");
            await pushBotMessage("좋아요. 비밀번호를 입력해주세요. (6자 이상)");
        }
    };

    const startEditField = async (field: "email" | "nickname" | "password") => {
        if (loading) return;
        setError("");
        setEditingField(field);
        setStep(field);

        if (field === "email") {
            setInput(email);
            pushMessage("user", "[이메일 수정]");
            await pushBotMessage("새 이메일을 입력해주세요.", 180);
            return;
        }

        if (field === "nickname") {
            setInput(nickname);
            pushMessage("user", "[닉네임 수정]");
            await pushBotMessage("새 닉네임을 입력해주세요. 건너뛰기도 가능합니다.", 180);
            return;
        }

        setInput("");
        pushMessage("user", "[비밀번호 수정]");
        await pushBotMessage("새 비밀번호를 입력해주세요. (6자 이상)", 180);
    };

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[70vh] flex flex-col items-center">
                <div className="receipt-zigzag-top" />

                <div className="p-8 w-full flex-1 flex flex-col">
                    <div className="text-center space-y-2 mb-6 border-b-2 border-dashed border-black/20 pb-6">
                        <div className="flex justify-center mb-1">
                            <img src="/logo.png" alt="BITELOG" className="h-[46px] object-contain mix-blend-multiply" style={{ imageRendering: "pixelated" }} />
                        </div>
                        <div className="text-[10px] font-bold text-black/60 uppercase tracking-widest">
                            Chat Signup
                        </div>
                    </div>

                    <div className="flex-1 border-2 border-black/10 bg-[#fafafa] p-3 overflow-y-auto min-h-[320px] max-h-[420px] space-y-2">
                        {messages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === "bot" ? "justify-start" : "justify-end"}`}>
                                <div
                                    className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap chat-bubble-in ${message.role === "bot"
                                        ? "bg-black text-white"
                                        : "border border-black bg-white text-black"
                                        }`}
                                >
                                    {message.text}
                                </div>
                            </div>
                        ))}
                        {isBotTyping && (
                            <div className="flex justify-start">
                                <div className="bg-black text-white px-3 py-2 text-xs typing-wrap">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs font-bold text-center mt-3">
                            ! {error} !
                        </div>
                    )}

                    {step !== "confirm" && (
                        <input
                            type={step === "password" ? "password" : "text"}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            autoComplete={step === "email" ? "email" : step === "password" ? "new-password" : "nickname"}
                            className="w-full border-2 border-black p-2 font-mono text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow mt-3"
                            placeholder={step === "email" ? "you@example.com" : step === "nickname" ? "예: 식단러버" : "비밀번호 입력"}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleNext();
                                }
                            }}
                        />
                    )}
                    {step === "password" && (
                        <p className="mt-1 text-[10px] text-black/50 uppercase tracking-widest">
                            Password length: {passwordCharLength}
                        </p>
                    )}

                    <div className="space-y-2 mt-3">
                        {step === "confirm" && (
                            <div className="border-2 border-dashed border-black/20 p-3 space-y-2">
                                <p className="text-[11px] font-bold text-black/70">
                                    수정하고 싶은 내용이 있다면 수정할 내용을 클릭해주세요.
                                </p>
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => void startEditField("email")}
                                        className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                    >
                                        이메일: {email}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void startEditField("nickname")}
                                        className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                    >
                                        닉네임: {nickname || "(미입력)"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void startEditField("password")}
                                        className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                    >
                                        비밀번호: {"*".repeat(password.length)}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => void handleNext()}
                            disabled={loading}
                            className="w-full bg-black text-white font-bold uppercase tracking-widest py-3 hover:bg-gray-800 border-2 border-black transition-colors disabled:opacity-60"
                        >
                            {step === "confirm" ? (loading ? "Signing Up..." : "Sign Up") : "Send"}
                        </button>

                        {step === "nickname" && (
                            <button
                                type="button"
                                onClick={() => void handleSkipNickname()}
                                className="w-full border-2 border-black py-2 text-xs font-bold uppercase hover:bg-gray-100"
                            >
                                Skip Nickname
                            </button>
                        )}
                    </div>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-xs font-bold uppercase underline hover:text-gray-600 tracking-widest">
                            Already have an account?
                        </Link>
                    </div>
                </div>
                <div className="receipt-zigzag-bottom" />
            </div>
            <style jsx>{`
                .chat-bubble-in {
                    animation: bubbleIn 220ms ease-out;
                }
                .typing-wrap {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .typing-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 9999px;
                    background: rgba(255, 255, 255, 0.9);
                    animation: dotPulse 1s infinite ease-in-out;
                }
                .typing-dot:nth-child(2) {
                    animation-delay: 120ms;
                }
                .typing-dot:nth-child(3) {
                    animation-delay: 240ms;
                }
                @keyframes bubbleIn {
                    from {
                        opacity: 0;
                        transform: translateY(6px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes dotPulse {
                    0%,
                    80%,
                    100% {
                        opacity: 0.35;
                        transform: translateY(0);
                    }
                    40% {
                        opacity: 1;
                        transform: translateY(-1px);
                    }
                }
            `}</style>
        </main>
    );
}
