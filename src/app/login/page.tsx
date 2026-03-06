"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { setToken } from "@/lib/auth";

type AuthMode = "login" | "register";
type LoginStep = "email" | "nickname" | "password" | "confirm";
type ChatRole = "bot" | "user";

type ChatMessage = {
    id: number;
    role: ChatRole;
    text: string;
};

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nickname, setNickname] = useState("");
    const [input, setInput] = useState("");
    const [step, setStep] = useState<LoginStep>("email");
    const [mode, setMode] = useState<AuthMode | null>(null);
    const [editingField, setEditingField] = useState<"email" | "nickname" | "password" | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [livePrintText, setLivePrintText] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const router = useRouter();
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const nextMessageIdRef = useRef(3);
    const hasBootedRef = useRef(false);

    const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value);
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const passwordCharLength = Array.from(input).length;

    const parseJsonSafe = async <T,>(res: Response): Promise<T | null> => {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/json")) return null;
        try {
            return (await res.json()) as T;
        } catch {
            return null;
        }
    };

    const parseErrorMessage = async (res: Response, fallback: string) => {
        const json = await parseJsonSafe<{ detail?: string; message?: string }>(res);
        if (json?.detail) return json.detail;
        if (json?.message) return json.message;

        try {
            const text = (await res.text()).trim();
            if (!text) return fallback;
            return text.length > 140 ? `${text.slice(0, 140)}...` : text;
        } catch {
            return fallback;
        }
    };

    const pushMessage = (role: ChatRole, text: string) => {
        const id = nextMessageIdRef.current;
        nextMessageIdRef.current += 1;
        setMessages((prev) => [...prev, { id, role, text }]);
    };

    const pushBotMessage = async (text: string, delayMs = 300) => {
        setIsBotTyping(true);
        await sleep(delayMs);
        setIsBotTyping(false);

        setLivePrintText("");
        for (let i = 1; i <= text.length; i += 1) {
            setLivePrintText(text.slice(0, i));
            await sleep(42);
        }

        pushMessage("bot", text);
        setLivePrintText("");
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (hasBootedRef.current) return;
        hasBootedRef.current = true;

        const boot = async () => {
            await pushBotMessage("반가워요. 로그인 혹은 회원가입을 도와드리겠습니다.", 120);
            await sleep(1000);
            await pushBotMessage("당신의 이메일은...?", 160);
        };

        void boot();
    }, []);

    const checkEmailExists = async (targetEmail: string): Promise<boolean | null> => {
        const checkOnce = async () => {
            const res = await fetch(`${API_BASE_URL}/v1/auth/email-exists?email=${encodeURIComponent(targetEmail)}`);
            if (!res.ok) return null;
            const data = await parseJsonSafe<{ exists?: boolean }>(res);
            if (!data || typeof data.exists !== "boolean") return null;
            return data.exists;
        };

        const first = await checkOnce();
        if (first !== null) return first;
        await sleep(200);
        return checkOnce();
    };

    const signIn = async (targetEmail: string, targetPassword: string) => {
        const formData = new URLSearchParams();
        formData.append("username", targetEmail);
        formData.append("password", targetPassword);

        const res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });

        if (!res.ok) {
            throw new Error(await parseErrorMessage(res, "Login failed"));
        }

        const data = await parseJsonSafe<{ access_token?: string }>(res);
        if (!data?.access_token) throw new Error("로그인 응답 형식이 올바르지 않아요.");
        setToken(data.access_token);
    };

    const handleLogin = async (passwordOverride?: string) => {
        setError("");
        setLoading(true);

        try {
            const targetPassword = passwordOverride ?? password;
            await signIn(email, targetPassword);
            await pushBotMessage("로그인 완료. 메인 화면으로 이동할게요.", 250);
            setTimeout(() => router.push("/"), 500);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed";
            setError(message);
            const credentialError =
                /incorrect|password|credential|unauthorized|401/i.test(message);
            if (credentialError) {
                await pushBotMessage("로그인 정보가 잘못 입력되었습니다.", 220);
            } else {
                await pushBotMessage(`로그인에 실패했어요: ${message}`, 250);
            }
            await pushBotMessage("어떤 항목을 다시 입력할까요? 아래에서 선택해주세요.", 200);
            setStep("confirm");
            setEditingField(null);
            setInput("");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterAndLogin = async () => {
        setError("");
        setLoading(true);

        try {
            const registerRes = await fetch(`${API_BASE_URL}/v1/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, nickname }),
            });

            if (!registerRes.ok) {
                throw new Error(await parseErrorMessage(registerRes, "Registration failed"));
            }

            await signIn(email, password);
            await pushBotMessage("회원가입과 로그인까지 완료했어요. 메인 화면으로 이동할게요.", 250);
            setTimeout(() => router.push("/"), 500);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Registration failed";
            if (message.toLowerCase().includes("already exists")) {
                await pushBotMessage("이미 가입된 이메일이에요. 로그인으로 이어서 시도해볼게요.", 220);
                try {
                    await signIn(email, password);
                    await pushBotMessage("로그인 완료. 메인 화면으로 이동할게요.", 220);
                    setTimeout(() => router.push("/"), 500);
                    return;
                } catch {
                    setMode("login");
                    setStep("password");
                    setInput("");
                    setPassword("");
                    await pushBotMessage("비밀번호를 한 번 더 입력해주세요.", 200);
                    return;
                }
            }

            setError(message);
            await pushBotMessage(`진행 중 문제가 발생했어요: ${message}`, 250);
            await pushBotMessage("다시 시도할게요. 이메일부터 다시 확인해볼까요?", 220);
            setStep("email");
            setMode(null);
            setInput(email);
            setPassword("");
        } finally {
            setLoading(false);
        }
    };

    const handleSkipNickname = async () => {
        if (step !== "nickname" || mode !== "register" || loading) return;

        setError("");
        pushMessage("user", "(닉네임 건너뛰기)");
        setNickname("");
        setInput("");
        if (editingField === "nickname") {
            setEditingField(null);
            setStep("confirm");
            await pushBotMessage("닉네임을 비워두었어요. 다른 항목도 수정할 수 있어요.", 180);
        } else {
            setStep("password");
            await pushBotMessage("좋아요. 가입에 사용할 비밀번호를 입력해주세요. (6자 이상)");
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

            try {
                const exists = await checkEmailExists(nextEmail);
                if (exists === true) {
                    setMode("login");
                    setStep("password");
                    setEditingField(null);
                    await pushBotMessage("확인했어요. 가입된 계정입니다. 비밀번호는...?", 260);
                } else if (exists === false) {
                    setMode("register");
                    setStep("nickname");
                    setEditingField(null);
                    await pushBotMessage("아직 계정이 없네요. 이 화면에서 바로 회원가입 도와드릴게요.", 260);
                    await pushBotMessage("사용할 닉네임은...? (건너뛰기 가능)", 200);
                } else {
                    setMode("register");
                    setStep("nickname");
                    setEditingField(null);
                    await pushBotMessage("이메일 확인이 잠시 지연돼요. 우선 회원가입으로 진행할게요.", 220);
                    await pushBotMessage("이미 가입된 이메일이면 자동으로 로그인 흐름으로 전환됩니다.", 180);
                    await pushBotMessage("사용할 닉네임은...? (건너뛰기 가능)", 180);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "이메일 확인 실패";
                setError(message);
                await pushBotMessage(message, 240);
            }
            return;
        }

        if (step === "nickname") {
            const nextNickname = input.trim();
            if (!nextNickname) {
                setError("닉네임을 입력하거나 건너뛰기를 눌러주세요.");
                return;
            }

            pushMessage("user", nextNickname);
            setNickname(nextNickname);
            setInput("");
            if (editingField === "nickname") {
                setEditingField(null);
                setStep("confirm");
                await pushBotMessage("닉네임을 수정했어요. 다른 항목도 수정할 수 있어요.", 220);
            } else {
                setStep("password");
                await pushBotMessage("좋아요. 가입에 사용할 비밀번호를 입력해주세요. (6자 이상)", 260);
            }
            return;
        }

        if (step === "password") {
            const nextPassword = input;
            if (!nextPassword) {
                setError("비밀번호를 입력해주세요.");
                return;
            }
            if (mode === "register" && nextPassword.length < 6) {
                setError("비밀번호는 6자 이상이어야 해요.");
                return;
            }
            if (mode === "register" && new TextEncoder().encode(nextPassword).length > 72) {
                setError("비밀번호가 너무 길어요. 72바이트 이하로 입력해주세요.");
                return;
            }

            pushMessage("user", "*".repeat(nextPassword.length));
            setPassword(nextPassword);
            setInput("");
            setEditingField(null);

            if (mode === "login") {
                await handleLogin(nextPassword);
                return;
            }

            setStep("confirm");

            if (mode === "register") {
                await pushBotMessage(`확인할게요. 이메일: ${email}${nickname ? `, 닉네임: ${nickname}` : ", 닉네임: (미입력)"}`, 220);
                await pushBotMessage("수정이 필요하면 아래 항목을 눌러 바꿔주세요. 맞다면 회원가입하고 시작하기 버튼을 눌러주세요.", 180);
            }
            return;
        }

        if (step === "confirm") {
            if (mode === "register") {
                pushMessage("user", "회원가입하고 시작하기");
                await handleRegisterAndLogin();
            } else if (mode === "login") {
                await pushBotMessage("아래 항목 중 다시 입력할 내용을 선택해주세요.", 120);
            }
        }
    };

    const startEditField = async (field: "email" | "nickname" | "password") => {
        if (loading || isBotTyping || step !== "confirm") return;
        if (field === "nickname" && mode !== "register") return;

        setError("");
        setEditingField(field);

        if (field === "email") {
            setStep("email");
            setMode(null);
            setInput(email);
            pushMessage("user", "[이메일 수정]");
            await pushBotMessage("좋아요. 바꿀 이메일을 입력해주세요.", 180);
            return;
        }

        if (field === "nickname") {
            setStep("nickname");
            setInput(nickname);
            pushMessage("user", "[닉네임 수정]");
            await pushBotMessage("닉네임을 다시 입력해주세요. 건너뛰기도 가능해요.", 180);
            return;
        }

        setStep("password");
        setInput("");
        pushMessage("user", "[비밀번호 재입력]");
        await pushBotMessage("비밀번호를 다시 입력해주세요.", 180);
    };

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[70vh] flex flex-col items-center">
                <div className="receipt-zigzag-top" />

                <div className="p-8 w-full flex-1 flex flex-col">
                    <div className="text-center space-y-2 mb-6 border-b-2 border-dashed border-black/20 pb-6">
                        <div className="flex items-center justify-start mb-2">
                            <Link href="/" className="text-xs font-bold uppercase hover:bg-black/5 p-2 -ml-2 rounded">
                                &lt; Back
                            </Link>
                        </div>
                        <div className="flex justify-center mb-1">
                            <img src="/logo.png" alt="BITELOG" className="h-[46px] object-contain mix-blend-multiply" style={{ imageRendering: "pixelated" }} />
                        </div>
                        <div className="text-[10px] font-bold text-black/60 uppercase tracking-widest">
                            Receipt Login
                        </div>
                    </div>

                    <div className="flex-1 border-2 border-black/20 bg-white p-3 overflow-y-auto min-h-[320px] max-h-[420px] space-y-1">
                        <div className="text-[10px] text-black/40 font-bold tracking-widest border-b border-dashed border-black/20 pb-2 mb-2">
                            PRINT LOG
                        </div>
                        {messages.map((message) => (
                            <div key={message.id} className="print-line text-[11px] leading-relaxed border-b border-dashed border-black/10 pb-1">
                                <div className={`whitespace-pre-wrap ${message.role === "bot" ? "text-black/80" : "text-black font-bold"}`}>
                                    {message.role === "bot" ? `BITELOG > ${message.text}` : `> ${message.text}`}
                                </div>
                            </div>
                        ))}
                        {isBotTyping && (
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
                            autoComplete={step === "email" ? "email" : mode === "register" ? "new-password" : "current-password"}
                            className="w-full border-2 border-black p-2 font-mono text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow mt-3"
                            placeholder={step === "email" ? "you@example.com" : step === "nickname" ? "닉네임 입력" : "비밀번호 입력"}
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
                                    수정하고 싶은 내용이 있다면 항목을 클릭해주세요.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void startEditField("email")}
                                    className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                >
                                    이메일: {email}
                                </button>
                                {mode === "register" && (
                                    <button
                                        type="button"
                                        onClick={() => void startEditField("nickname")}
                                        className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                    >
                                        닉네임: {nickname || "(미입력)"}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void startEditField("password")}
                                    className="w-full border border-black/40 px-2 py-1.5 text-xs text-left hover:bg-gray-100"
                                >
                                    비밀번호: {"*".repeat(password.length)}
                                </button>
                            </div>
                        )}

                        {!(step === "confirm" && mode === "login") && (
                            <button
                                type="button"
                                onClick={() => void handleNext()}
                                disabled={loading || isBotTyping}
                                className="w-full bg-black text-white font-bold uppercase tracking-widest py-3 hover:bg-gray-800 border-2 border-black transition-colors disabled:opacity-60"
                            >
                                {step === "confirm"
                                    ? loading
                                        ? "Creating Account..."
                                        : "Sign Up & Start"
                                    : "Send"}
                            </button>
                        )}

                        {step === "nickname" && mode === "register" && (
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
                        <Link href="/register" className="text-xs font-bold uppercase underline hover:text-gray-600 tracking-widest">
                            Register page directly
                        </Link>
                    </div>
                </div>
                <div className="receipt-zigzag-bottom" />
            </div>
            <style jsx>{`
                .print-line {
                    animation: printIn 180ms ease-out;
                }
                .typing-wrap {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                }
                .typing-dot {
                    width: 4px;
                    height: 4px;
                    border-radius: 9999px;
                    background: rgba(0, 0, 0, 0.75);
                    animation: dotPulse 1s infinite ease-in-out;
                }
                .typing-dot:nth-child(2) {
                    animation-delay: 120ms;
                }
                .typing-dot:nth-child(3) {
                    animation-delay: 240ms;
                }
                .print-cursor {
                    display: inline-block;
                    width: 6px;
                    height: 10px;
                    margin-left: 2px;
                    background: rgba(0, 0, 0, 0.75);
                    animation: cursorBlink 0.8s steps(1, end) infinite;
                    vertical-align: -1px;
                }
                @keyframes printIn {
                    from {
                        opacity: 0;
                        transform: translateY(4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
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
                        transform: translateY(-0.5px);
                    }
                }
                @keyframes cursorBlink {
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
