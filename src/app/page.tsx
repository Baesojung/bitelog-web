"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect } from "react";
import { PixelMeal } from "@/components/pixel-icons";

export default function Home() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-blue-50/50 pixel:bg-none pixel:bg-background transition-colors duration-300">
      <ThemeToggle />
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent pb-2 pixel:text-foreground pixel:bg-none">
            Bitelog
          </h1>
          <p className="text-xl text-muted-foreground">
            Every bite counts. <br />
            건강한 식습관의 시작.
          </p>
        </div>

        <Card className="border-2 shadow-lg backdrop-blur-sm bg-card/80 pixel:shadow-none pixel:backdrop-blur-none transition-all">
          <CardHeader>
            <CardTitle className="text-lg">오늘 무엇을 드셨나요?</CardTitle>
            <CardDescription>
              간단하게 기록하고 AI 분석을 받아보세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/chat" className="w-full">
              <Button size="lg" className="w-full text-lg h-14 rounded-full shadow-md transition-all hover:scale-105 active:scale-95 group pixel:h-16 pixel:hover:scale-100 pixel:active:translate-y-1">
                {mounted && theme === 'pixel' ? (
                  <PixelMeal className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                ) : (
                  <Utensils className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                )}
                {mounted && theme === 'pixel' ? 'START' : '식사 기록하기'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
