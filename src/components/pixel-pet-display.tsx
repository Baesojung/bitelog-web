"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PixelMeal } from "@/components/pixel-icons";

// Simple custom pixel art sprites using 16x16 grid paths
// Scaled up for display
const BUNNY_IDLE = "M5 3h2v4h-2v-4z M9 3h2v4h-2v-4z M4 7h2v1h-2v-1z M10 7h2v1h-2v-1z M3 8h10v5h-1v2h-2v-1h-4v1h-2v-2h-1v-5z M5 10h1v1h-1v-1z M10 10h1v1h-1v-1z M7 11h2v1h-2v-1z";
const BUNNY_EATING = "M5 4h2v4h-2v-4z M9 4h2v4h-2v-4z M4 8h2v1h-2v-1z M10 8h2v1h-2v-1z M3 9h10v5h-1v2h-2v-1h-4v1h-2v-2h-1v-5z M5 11h1v1h-1v-1z M10 11h1v1h-1v-1z M7 12h2v1h-2v-1z";
const BUNNY_HAPPY = "M5 2h2v4h-2v-4z M9 2h2v4h-2v-4z M4 6h2v1h-2v-1z M10 6h2v1h-2v-1z M3 7h10v5h-1v2h-2v-1h-4v1h-2v-2h-1v-5z M5 9h1v1h-1v-1z M10 9h1v1h-1v-1z M6 11h1v1h2v-1h1v2h-4v-2z";

type Props = {
    totalKcal: number;
    goalKcal?: number;
};

export function PixelPetDisplay({ totalKcal, goalKcal = 2000 }: Props) {
    const [mood, setMood] = useState<'idle' | 'happy' | 'eating' | 'full'>('idle');
    const [dialogue, setDialogue] = useState("");

    // Determine state based on calories
    useEffect(() => {
        if (totalKcal === 0) {
            setMood('idle');
            setDialogue("배고파요... 밥 주세요!");
        } else if (totalKcal < goalKcal * 0.3) {
            setMood('eating');
            setDialogue("냠냠! 더 먹을 수 있어요.");
        } else if (totalKcal < goalKcal * 0.8) {
            setMood('happy');
            setDialogue("기분 좋아요! 건강해지는 느낌!");
        } else {
            setMood('full');
            setDialogue("배불러요... 이제 그만!");
        }
    }, [totalKcal, goalKcal]);

    // Path selection
    const getPath = () => {
        switch (mood) {
            case 'happy': return BUNNY_HAPPY;
            case 'eating': return BUNNY_EATING;
            case 'full': return BUNNY_IDLE; // Sleeping pose maybe?
            default: return BUNNY_IDLE;
        }
    };

    // Color selection
    const getColor = () => {
        switch (mood) {
            case 'happy': return "text-pink-400";
            case 'eating': return "text-orange-400";
            case 'full': return "text-blue-400";
            default: return "text-gray-400"; // Hungry/Idle
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />

            {/* Dialogue Bubble */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={dialogue}
                className="mb-4 bg-background border border-border px-3 py-1.5 rounded-lg shadow-sm text-sm font-medium relative"
            >
                {dialogue}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-b border-r border-border rotate-45" />
            </motion.div>

            {/* Pet Sprite */}
            <motion.div
                animate={{
                    y: [0, -3, 0],
                    scale: mood === 'eating' ? [1, 1.05, 1] : 1
                }}
                transition={{
                    repeat: Infinity,
                    duration: mood === 'happy' ? 0.5 : 2,
                    ease: "easeInOut"
                }}
                className={`relative w-32 h-32 flex items-center justify-center ${getColor()}`}
            >
                <svg viewBox="0 0 16 16" className="w-full h-full drop-shadow-md pixelated">
                    <path d={getPath()} fill="currentColor" />
                </svg>
            </motion.div>

            {/* Status Bar */}
            <div className="w-full max-w-[200px] mt-4 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Exp</span>
                    <span>{Math.min(100, Math.round((totalKcal / goalKcal) * 100))}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (totalKcal / goalKcal) * 100)}%` }}
                        transition={{ duration: 1 }}
                        className={`h-full ${mood === 'full' ? 'bg-red-400' : 'bg-primary'}`}
                    />
                </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 font-mono">
                LV. {Math.floor(totalKcal / 500) + 1} Bun
            </p>
        </div>
    );
}
