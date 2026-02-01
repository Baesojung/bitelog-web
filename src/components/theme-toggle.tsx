"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Ghost, Monitor } from "lucide-react";
import { PixelGhost, PixelMonitor } from "@/components/pixel-icons";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <Button
            variant="outline"
            size="icon"
            className={`fixed top-4 right-4 z-50 transition-all ${theme === 'pixel'
                    ? 'rounded-none border-2 border-border shadow-none bg-primary text-primary-foreground hover:translate-y-0.5 active:translate-y-1'
                    : 'rounded-full shadow-md bg-white/80 backdrop-blur'
                }`}
            onClick={() => setTheme(theme === "pixel" ? "light" : "pixel")}
        >
            {theme === "pixel" ? (
                <PixelMonitor className="h-[1.2rem] w-[1.2rem] transition-all" />
            ) : (
                <PixelGhost className="h-[1.2rem] w-[1.2rem] transition-all" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
