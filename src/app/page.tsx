"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Utensils, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Flame, Trash2, Copy, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, useMemo } from "react";
import { PixelMeal, PixelPlus } from "@/components/pixel-icons";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, subMonths, addMonths, subWeeks, addWeeks, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from "recharts";
import { PixelPetDisplay } from "@/components/pixel-pet-display";

type FoodItem = {
  name: string;
  qty: string;
  kcal: number;
  macros?: {
    carbs: number;
    protein: number;
    fat: number;
  };
};

type MealLog = {
  id: number;
  user_id: number;
  raw_text: string;
  meal_type: string;
  eaten_at: string;
  items_json: FoodItem[];
  total_kcal: number;
  macros?: {
    carbs: number;
    protein: number;
    fat: number;
  };
  ai_summary: string;
  created_at: string;
};



type ViewMode = 'day' | 'week' | 'month';

export default function Home() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showCalendar, setShowCalendar] = useState(false);

  // Helper State for Actions
  const [mealToDelete, setMealToDelete] = useState<number | null>(null);
  const [mealToDuplicate, setMealToDuplicate] = useState<MealLog | null>(null);
  const [duplicateDate, setDuplicateDate] = useState<Date>(new Date());

  // Details Modal State
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/meals/?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch meals');
      const data = await response.json();
      setMeals(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeal = async () => {
    if (!mealToDelete) return;
    try {
      const response = await fetch(`http://localhost:8000/v1/meals/${mealToDelete}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete meal');

      setMeals(prev => prev.filter(m => m.id !== mealToDelete));
      setMealToDelete(null);
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDuplicateMeal = async () => {
    if (!mealToDuplicate) return;
    try {
      const response = await fetch(`http://localhost:8000/v1/meals/${mealToDuplicate.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_eaten_at: duplicateDate.toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to duplicate meal');

      const newMeal = await response.json();
      setMeals(prev => [newMeal, ...prev]);
      setMealToDuplicate(null);
      alert("기록이 복제되었습니다.");
    } catch (error) {
      console.error(error);
      alert("복제 중 오류가 발생했습니다.");
    }
  };

  // --- Data Processing ---

  const filteredData = useMemo(() => {
    if (!meals.length) return { list: [], totalKcal: 0, chartData: [] };

    let list: MealLog[] | any[] = [];
    let totalKcal = 0;
    let chartData: any[] = [];

    if (viewMode === 'day') {
      list = meals.filter(m => isSameDay(parseISO(m.eaten_at), currentDate));
      totalKcal = list.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);

      // Chart: Calories by Meal Type
      const typeData = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
      list.forEach(m => {
        const type = m.meal_type?.toLowerCase() || 'snack';
        if (typeData[type as keyof typeof typeData] !== undefined) {
          typeData[type as keyof typeof typeData] += m.total_kcal || 0;
        }
      });
      chartData = [
        { name: '아침', kcal: typeData.breakfast },
        { name: '점심', kcal: typeData.lunch },
        { name: '저녁', kcal: typeData.dinner },
        { name: '간식', kcal: typeData.snack },
      ];
    }
    else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });

      const weekMeals = meals.filter(m => {
        const d = parseISO(m.eaten_at);
        return d >= start && d <= end;
      });

      // Group by day
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const dailyMeals = weekMeals.filter(m => isSameDay(parseISO(m.eaten_at), d));
        const dailyKcal = dailyMeals.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);
        days.push({
          date: d,
          name: format(d, 'EEE', { locale: ko }),
          kcal: dailyKcal,
          meals: dailyMeals
        });
        totalKcal += dailyKcal;
      }
      chartData = days;
      list = days.slice().reverse(); // Show recent days first
    }
    else if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const monthMeals = meals.filter(m => {
        const d = parseISO(m.eaten_at);
        return d >= start && d <= end;
      });

      // Group by day (simplified for chart)
      const daysInMonth = end.getDate();
      const days = [];
      for (let i = 1; i <= daysInMonth; i++) {
        // Construct date correctly handling month rollover if needed, generally start + i-1 days
        const d = new Date(start.getFullYear(), start.getMonth(), i);
        const dailyMeals = monthMeals.filter(m => isSameDay(parseISO(m.eaten_at), d));
        const dailyKcal = dailyMeals.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);
        days.push({
          name: i.toString(),
          kcal: dailyKcal,
          date: d,
          meals: dailyMeals
        });
        totalKcal += dailyKcal;
      }
      chartData = days;
      // Filter out days with 0 kcal for the list view to avoid clutter
      list = days.filter(d => d.kcal > 0).reverse();
    }

    return { list, totalKcal, chartData };
  }, [meals, currentDate, viewMode]);

  // --- Handlers ---

  const handlePrev = () => {
    if (viewMode === 'day') setCurrentDate(prev => subDays(prev, 1));
    if (viewMode === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    if (viewMode === 'month') setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (viewMode === 'day') setCurrentDate(prev => addDays(prev, 1));
    if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1));
  };

  const isPixel = mounted && theme === 'pixel';

  // --- Render Helpers ---

  const renderDateTitle = () => {
    if (viewMode === 'day') return format(currentDate, 'yyyy년 M월 d일 (EEE)', { locale: ko });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'M월 d일')} - ${format(end, 'M월 d일')}`;
    }
    if (viewMode === 'month') return format(currentDate, 'yyyy년 M월', { locale: ko });
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pb-24 bg-gradient-to-br from-background to-blue-50/50 pixel:bg-none pixel:bg-background transition-colors duration-300 relative text-foreground">

      {/* Header & Controls */}
      <div className="w-full max-w-md sticky top-0 z-20 bg-background/80 backdrop-blur-md rounded-b-xl pixel:bg-background pixel:border-b-2 pixel:border-border pixel:rounded-none px-2 pb-2">
        <div className="flex justify-between items-center py-3">
          <h1 className="text-xl font-bold tracking-tight pixel:text-lg">Dashboard</h1>
          <ThemeToggle />
        </div>

        {/* View Toggles */}
        <div className="flex bg-muted/50 p-1 rounded-lg mb-4 pixel:rounded-none pixel:border pixel:border-border">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${viewMode === mode ? 'bg-background shadow-sm text-primary pixel:bg-primary pixel:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {mode === 'day' ? '일간' : mode === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>

        {/* Date Navigator */}
        <div className="flex justify-between items-center mb-2">
          <Button variant="ghost" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowCalendar(!showCalendar)}>
            <span className="text-lg font-bold">{renderDateTitle()}</span>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </div>

          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Mini Calendar Dropdown */}
        {showCalendar && (
          <div className="absolute top-full left-0 right-0 p-4 bg-background border border-border mt-1 shadow-lg rounded-xl z-30 pixel:rounded-none pixel:border-2">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(d) => { if (d) { setCurrentDate(d); setShowCalendar(false); } }}
              className="rounded-md border mx-auto w-fit"
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md space-y-6 mt-4">

        {/* Pixel Pet Display */}
        <PixelPetDisplay totalKcal={filteredData.totalKcal} goalKcal={2000} />

        {/* Statistics Card (Chart) */}
        <Card className="border-none shadow-md bg-card overflow-hidden pixel:border-2 pixel:border-border pixel:shadow-none pixel:rounded-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                {viewMode === 'day' ? '오늘 섭취' : viewMode === 'week' ? '주간 섭취' : '월간 섭취'}
              </span>
              <span className="text-lg font-bold text-foreground">
                {filteredData.totalKcal.toLocaleString()} kcal
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="name"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  hide={viewMode === 'month' && filteredData.chartData.length > 10} // Hide labels if too crowded
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} hide />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="kcal" radius={[4, 4, 0, 0]} className="fill-primary" maxBarSize={40}>
                  {filteredData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} className={entry.kcal > 2500 ? 'fill-red-400' : 'fill-primary'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* List Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3 px-1">
            {viewMode === 'day' ? '식사 기록' : '일별 기록'}
          </h2>

          {loading ? (
            <div className="space-y-4">
              <div className="h-24 w-full bg-muted/50 animate-pulse rounded-xl" />
            </div>
          ) : filteredData.list.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {viewMode === 'day' ? (
                // Daily Meal List
                (filteredData.list as MealLog[]).map(meal => (
                  <Card
                    key={meal.id}
                    className="overflow-hidden hover:bg-muted/10 transition-colors cursor-pointer pixel:rounded-none pixel:border-2 pixel:border-border pixel:shadow-none"
                    onClick={() => setSelectedMeal(meal)}
                  >
                    <CardHeader className="p-4 py-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full pixel:rounded-none pixel:border pixel:border-border">
                          {isPixel ? <PixelMeal className="w-4 h-4" /> : <Utensils className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm capitalize">{meal.meal_type || '식사'}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(meal.eaten_at), 'aa h:mm', { locale: ko })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm mr-2">{meal.total_kcal} kcal</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setMealToDuplicate(meal); setDuplicateDate(new Date(meal.eaten_at)); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setMealToDelete(meal.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    {meal.items_json && (
                      <CardContent className="p-4 pt-0 pb-3 pl-14">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {meal.items_json.map(i => i.name).join(', ')}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))
              ) : (
                // Weekly/Monthly Day List
                (filteredData.list as any[]).map((day, idx) => (
                  <Card key={idx} className="overflow-hidden pixel:rounded-none pixel:border-2 pixel:border-border pixel:shadow-none" onClick={() => { setCurrentDate(day.date); setViewMode('day'); }}>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg font-bold text-sm pixel:rounded-none">
                          {format(day.date, 'd', { locale: ko })}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{format(day.date, 'M월 d일 EEEE', { locale: ko })}</p>
                          <p className="text-xs text-muted-foreground">식사 {day.meals.length}회</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{day.kcal.toLocaleString()} kcal</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 safe-area-bottom z-50">
        <Link href="/chat">
          <Button
            size="lg"
            className={`h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 bg-primary text-primary-foreground pixel:rounded-none pixel:h-16 pixel:border-2 pixel:border-border pixel:hover:scale-100 pixel:active:translate-y-1 gap-2 px-6`}
          >
            {isPixel ? <PixelPlus className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            <span className="font-bold text-base">기록하기</span>
          </Button>
        </Link>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedMeal} onOpenChange={(open) => !open && setSelectedMeal(null)}>
        <DialogContent className="sm:max-w-md pixel:border-2 pixel:border-border pixel:rounded-none max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="capitalize">{selectedMeal?.meal_type || '식사'}</span>
              <span className="text-muted-foreground font-normal text-sm">
                {selectedMeal && format(parseISO(selectedMeal.eaten_at), 'yyyy.MM.dd aa h:mm', { locale: ko })}
              </span>
            </DialogTitle>
            <DialogDescription>
              {selectedMeal?.raw_text}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nutritional Info */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border pixel:rounded-none pixel:border-2">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <Flame className="h-4 w-4" /> 영양 정보
              </h4>
              {selectedMeal?.macros ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-background p-2 rounded-lg border pixel:rounded-none">
                    <div className="text-xs text-muted-foreground">탄수화물</div>
                    <div className="font-bold text-lg">{selectedMeal.macros.carbs}<span className="text-xs font-normal">g</span></div>
                  </div>
                  <div className="bg-background p-2 rounded-lg border pixel:rounded-none">
                    <div className="text-xs text-muted-foreground">단백질</div>
                    <div className="font-bold text-lg">{selectedMeal.macros.protein}<span className="text-xs font-normal">g</span></div>
                  </div>
                  <div className="bg-background p-2 rounded-lg border pixel:rounded-none">
                    <div className="text-xs text-muted-foreground">지방</div>
                    <div className="font-bold text-lg">{selectedMeal.macros.fat}<span className="text-xs font-normal">g</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center">상세 영양 정보가 없습니다.</div>
              )}
            </div>

            {/* Food Items List */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <Utensils className="h-4 w-4" /> 상세 메뉴
              </h4>
              <ul className="space-y-2">
                {selectedMeal?.items_json?.map((item, idx) => (
                  <li key={idx} className="bg-muted/30 p-3 rounded-md pixel:rounded-none pixel:border pixel:border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.qty})</span></span>
                      <span className="text-sm font-bold">{item.kcal} kcal</span>
                    </div>
                    {item.macros && (
                      <div className="flex gap-3 text-xs text-muted-foreground border-t border-border/50 pt-1 mt-1">
                        <span>탄수화물: {item.macros.carbs}g</span>
                        <span>단백질: {item.macros.protein}g</span>
                        <span>지방: {item.macros.fat}g</span>
                      </div>
                    )}
                  </li>
                ))}
                <li className="flex justify-between items-center pt-2 border-t mt-2 px-2">
                  <span className="font-semibold">총 칼로리</span>
                  <span className="font-bold text-lg text-primary">{selectedMeal?.total_kcal} kcal</span>
                </li>
              </ul>
            </div>

            {/* AI Analysis */}
            {selectedMeal?.ai_summary && (
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 pixel:rounded-none pixel:border-2 pixel:border-primary/20">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1 text-primary">
                  <Flame className="h-4 w-4" /> AI 분석 결과
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {selectedMeal.ai_summary}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedMeal(null)} className="w-full pixel:rounded-none pixel:border-2 pixel:border-border">닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialogs */}
      <Dialog open={!!mealToDelete} onOpenChange={(open) => !open && setMealToDelete(null)}>
        <DialogContent className="sm:max-w-md pixel:border-2 pixel:border-border pixel:rounded-none">
          <DialogHeader>
            <DialogTitle>기록 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 식사 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="secondary" onClick={() => setMealToDelete(null)} className="pixel:rounded-none pixel:border pixel:border-border">취소</Button>
            <Button variant="destructive" onClick={handleDeleteMeal} className="pixel:rounded-none pixel:border pixel:border-border">삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mealToDuplicate} onOpenChange={(open) => !open && setMealToDuplicate(null)}>
        <DialogContent className="sm:max-w-md pixel:border-2 pixel:border-border pixel:rounded-none">
          <DialogHeader>
            <DialogTitle>기록 복제 및 날짜 수정</DialogTitle>
            <DialogDescription>
              선택한 식사를 복제할 날짜를 선택해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={duplicateDate}
              onSelect={(d) => d && setDuplicateDate(d)}
              className="rounded-md border mx-auto"
            />
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="secondary" onClick={() => setMealToDuplicate(null)} className="pixel:rounded-none pixel:border pixel:border-border">취소</Button>
            <Button onClick={handleDuplicateMeal} className="pixel:rounded-none pixel:border-2 pixel:border-border">복제하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
