"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { getToken, removeToken, getAuthHeaders } from "@/lib/auth";

export default function ProfilePage() {
    const [nickname, setNickname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push("/login");
            return;
        }
        // Fetch current user
        fetch(`${API_BASE_URL}/v1/users/me`, {
            headers: getAuthHeaders(),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Unauthorized");
                return res.json();
            })
            .then((data) => {
                setEmail(data.email);
                setNickname(data.nickname || "");
            })
            .catch(() => {
                removeToken();
                router.push("/login");
            });
    }, [router]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");

        const body: any = {};
        if (nickname) body.nickname = nickname;
        if (password) body.password = password;

        try {
            const res = await fetch(`${API_BASE_URL}/v1/users/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders(),
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error("Failed to update profile");
            setMessage("Profile updated successfully");
            setPassword(""); // clear password field
        } catch (err: any) {
            setMessage("Error: " + err.message);
        }
    };

    const handleLogout = () => {
        removeToken();
        router.push("/login");
    };

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[70vh] flex flex-col items-center">
                <div className="receipt-zigzag-top" />

                <div className="p-8 w-full">
                    <div className="border-b-2 border-dashed border-black/20 pb-6 mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <Link href="/" className="text-xs font-bold uppercase hover:bg-black/5 p-2 -ml-2 rounded">
                                &lt; Back
                            </Link>
                            <div className="w-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-1">
                                <img src="/logo.png" alt="BITELOG" className="h-[46px] object-contain mix-blend-multiply" style={{ imageRendering: "pixelated" }} />
                            </div>
                            <div className="text-[10px] font-bold text-black/60 uppercase tracking-widest">
                                Member Info
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-4">
                        {message && (
                            <div className="text-black text-xs font-bold text-center mb-4 uppercase bg-black/5 p-2 border-2 border-black/10">
                                {message}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-black/50 tracking-widest block">Email</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full border-2 border-black/20 bg-black/5 p-2 font-mono text-sm text-black/50"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-black/50 tracking-widest block">Update Nickname</label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full border-2 border-black p-2 font-mono text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-black/50 tracking-widest block">Update Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank to keep unchanged"
                                className="w-full border-2 border-black p-2 font-mono text-sm focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow placeholder:text-black/30"
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 mt-6 hover:bg-black/5 border-2 border-black transition-colors"
                        >
                            Update Profile
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-dashed border-black/20 space-y-4 text-center">
                        <button
                            onClick={handleLogout}
                            className="w-full bg-black text-white font-bold uppercase tracking-widest py-3 hover:bg-gray-800 border-2 border-black transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
                <div className="receipt-zigzag-bottom" />
            </div>
        </main>
    );
}
