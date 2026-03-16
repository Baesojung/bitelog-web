"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Search, BookOpen, ChevronLeft, ChevronRight, Plus, BarChart3, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { getAuthHeaders, getToken, removeToken } from "@/lib/auth";
import { createRecentDemoMeals } from "@/lib/demo-data";

// Types
type FoodItem = {
  name: string;
  qty: string;
  kcal: number;
  macros?: {
    carbs: number;
    protein: number;
    fat: number;
    // ...
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

type MealEditForm = {
  raw_text: string;
  meal_type: string;
  eaten_at: string;
  total_kcal: string;
  carbs: string;
  protein: string;
  fat: string;
  ai_summary: string;
  items: FoodItem[];
};

type UserProfile = {
  daily_goal_kcal: number;
};

const MEAL_TYPE_OPTIONS = ["아침", "점심", "저녁", "간식"] as const;
const MEAL_TYPE_MAP: Record<string, (typeof MEAL_TYPE_OPTIONS)[number]> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
  아침: "아침",
  점심: "점심",
  저녁: "저녁",
  간식: "간식",
};

const normalizeMealType = (value?: string | null) => MEAL_TYPE_MAP[value || ""] || "간식";
const toInputDateTime = (value: string) => format(parseISO(value), "yyyy-MM-dd'T'HH:mm");

const buildEditForm = (meal: MealLog): MealEditForm => ({
  raw_text: meal.raw_text || "",
  meal_type: normalizeMealType(meal.meal_type),
  eaten_at: toInputDateTime(meal.eaten_at),
  total_kcal: String(meal.total_kcal ?? 0),
  carbs: String(meal.macros?.carbs ?? 0),
  protein: String(meal.macros?.protein ?? 0),
  fat: String(meal.macros?.fat ?? 0),
  ai_summary: meal.ai_summary || "",
  items: (meal.items_json || []).map((item) => ({
    name: item.name || "",
    qty: item.qty || "",
    kcal: item.kcal || 0,
    macros: {
      carbs: item.macros?.carbs || 0,
      protein: item.macros?.protein || 0,
      fat: item.macros?.fat || 0,
    },
  })),
});

export default function Home() {
  const router = useRouter();
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [dailyGoalKcal, setDailyGoalKcal] = useState(2000);
  const [showDemoTutorial, setShowDemoTutorial] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingActionLabel, setPendingActionLabel] = useState("이 기능");

  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper State
  const [mealToDelete, setMealToDelete] = useState<number | null>(null);
  const [mealToDuplicate, setMealToDuplicate] = useState<MealLog | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);
  const [isEditingMeal, setIsEditingMeal] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [mealEditError, setMealEditError] = useState("");
  const [mealEditForm, setMealEditForm] = useState<MealEditForm | null>(null);

  const DEMO_TUTORIAL_SEEN_KEY = "bitelog_demo_tutorial_seen";

  const openDemoTutorialIfNeeded = () => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(DEMO_TUTORIAL_SEEN_KEY);
    if (!seen) {
      setShowDemoTutorial(true);
    }
  };

  const closeDemoTutorial = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DEMO_TUTORIAL_SEEN_KEY, "1");
    }
    setShowDemoTutorial(false);
  };

  const openLoginPrompt = (actionLabel: string) => {
    setPendingActionLabel(actionLabel);
    setShowLoginPrompt(true);
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const token = getToken();
      if (!token) {
        setIsDemoMode(true);
        setMeals(createRecentDemoMeals());
        setDailyGoalKcal(2000);
        openDemoTutorialIfNeeded();
        return;
      }

      const headers = getAuthHeaders();
      const [mealsResponse, profileResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/meals?limit=1000`, { headers }),
        fetch(`${API_BASE_URL}/v1/users/me`, { headers }),
      ]);
      if (mealsResponse.status === 401 || profileResponse.status === 401) {
        removeToken();
        setIsDemoMode(true);
        setMeals(createRecentDemoMeals());
        setDailyGoalKcal(2000);
        openDemoTutorialIfNeeded();
        return;
      }
      if (!mealsResponse.ok) throw new Error('Failed to fetch meals');
      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      const data = await mealsResponse.json();
      const profile: UserProfile = await profileResponse.json();
      setIsDemoMode(false);
      setMeals(data);
      setDailyGoalKcal(profile.daily_goal_kcal ?? 2000);
    } catch (error) {
      console.error(error);
      setIsDemoMode(true);
      setMeals(createRecentDemoMeals());
      setDailyGoalKcal(2000);
      openDemoTutorialIfNeeded();
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!meals.length) return { list: [], totalKcal: 0, totalCarbs: 0, totalProtein: 0, totalFat: 0 };
    const list = meals.filter(m => isSameDay(parseISO(m.eaten_at), currentDate));
    const totalKcal = list.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);
    const totalCarbs = list.reduce((acc, curr) => acc + (curr.macros?.carbs || 0), 0);
    const totalProtein = list.reduce((acc, curr) => acc + (curr.macros?.protein || 0), 0);
    const totalFat = list.reduce((acc, curr) => acc + (curr.macros?.fat || 0), 0);
    return { list, totalKcal, totalCarbs, totalProtein, totalFat };
  }, [meals, currentDate]);

  const goalProgress = dailyGoalKcal > 0
    ? Math.round((filteredData.totalKcal / dailyGoalKcal) * 100)
    : 0;

  const handlePrev = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNext = () => setCurrentDate(prev => addDays(prev, 1));
  const handleProfileClick = () => {
    if (isDemoMode) {
      openLoginPrompt("프로필 보기");
      return;
    }
    router.push("/profile");
  };

  const handleDeleteMeal = async () => {
    if (isDemoMode || !mealToDelete) return;
    try {
      await fetch(`${API_BASE_URL}/v1/meals/${mealToDelete}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setMeals(prev => prev.filter(m => m.id !== mealToDelete));
      setMealToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Initial Click on Copy
  const openDuplicateModal = (meal: MealLog) => {
    if (isDemoMode) {
      openLoginPrompt("식단 복제");
      return;
    }
    setMealToDuplicate(meal);
  };

  const confirmDuplicate = async (targetDateStr: string) => {
    if (isDemoMode || !mealToDuplicate) return;

    try {
      // Create new date object from selected date string (YYYY-MM-DD)
      // and use current time for the time part, or keep original time?
      // Usually "I ate this now" -> Current Time.
      // But if user picks a date, maybe they mean "I ate this at that date's lunch/dinner time"?
      // Simplest: Use selected date + Current Time components
      const targetDate = new Date(targetDateStr);
      const now = new Date();
      targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const newMeal = {
        ...mealToDuplicate,
        eaten_at: targetDate.toISOString(),
      };

      const res = await fetch(`${API_BASE_URL}/v1/meals/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          user_id: 1,
          raw_text: newMeal.raw_text,
          meal_type: newMeal.meal_type,
          eaten_at: newMeal.eaten_at,
          total_kcal: newMeal.total_kcal,
          macros: newMeal.macros,
          ai_summary: newMeal.ai_summary,
          items: (newMeal.items_json || []).map(item => ({
            name: item.name,
            qty: item.qty,
            kcal: item.kcal,
            macros: item.macros
          }))
        }),
      });

      if (!res.ok) throw new Error("Failed to duplicate meal");

      fetchMeals(); // Refresh
      setMealToDuplicate(null); // Close modal

    } catch (error) {
      console.error("Duplicate failed", error);
    }
  };

  const openMealDetail = (meal: MealLog) => {
    setSelectedMeal(meal);
    setIsEditingMeal(false);
    setIsSavingMeal(false);
    setMealEditError("");
    setMealEditForm(buildEditForm(meal));
  };

  const closeMealDetail = () => {
    setSelectedMeal(null);
    setIsEditingMeal(false);
    setIsSavingMeal(false);
    setMealEditError("");
    setMealEditForm(null);
  };

  const updateMealItemField = (index: number, field: keyof FoodItem, value: string) => {
    setMealEditForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      const target = { ...items[index] };
      if (field === "kcal") {
        target.kcal = Number(value) || 0;
      } else {
        target[field] = value as never;
      }
      items[index] = target;
      return { ...prev, items };
    });
  };

  const addMealItem = () => {
    setMealEditForm((prev) => prev ? {
      ...prev,
      items: [...prev.items, { name: "", qty: "", kcal: 0, macros: { carbs: 0, protein: 0, fat: 0 } }],
    } : prev);
  };

  const removeMealItem = (index: number) => {
    setMealEditForm((prev) => prev ? {
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    } : prev);
  };

  const handleSaveMeal = async () => {
    if (!selectedMeal || !mealEditForm || isDemoMode) return;

    const sanitizedItems = mealEditForm.items
      .map((item) => ({
        name: item.name.trim(),
        qty: item.qty.trim() || "1 serving",
        kcal: Number(item.kcal) || 0,
        macros: {
          carbs: item.macros?.carbs || 0,
          protein: item.macros?.protein || 0,
          fat: item.macros?.fat || 0,
        },
      }))
      .filter((item) => item.name);

    if (!sanitizedItems.length) {
      setMealEditError("음식 항목을 1개 이상 입력해 주세요.");
      return;
    }

    const payload = {
      raw_text: mealEditForm.raw_text.trim() || sanitizedItems.map((item) => item.name).join(", "),
      meal_type: normalizeMealType(mealEditForm.meal_type.trim()),
      eaten_at: new Date(mealEditForm.eaten_at).toISOString(),
      items: sanitizedItems,
      total_kcal: Number(mealEditForm.total_kcal) || 0,
      macros: {
        carbs: Number(mealEditForm.carbs) || 0,
        protein: Number(mealEditForm.protein) || 0,
        fat: Number(mealEditForm.fat) || 0,
      },
      ai_summary: mealEditForm.ai_summary.trim(),
      confidence: 1,
    };

    try {
      setIsSavingMeal(true);
      setMealEditError("");
      const res = await fetch(`${API_BASE_URL}/v1/meals/${selectedMeal.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Failed to update meal (${res.status})`);
      }

      const updatedMeal: MealLog = await res.json();
      setMeals((prev) => prev.map((meal) => meal.id === updatedMeal.id ? updatedMeal : meal));
      setSelectedMeal(updatedMeal);
      setMealEditForm(buildEditForm(updatedMeal));
      setIsEditingMeal(false);
    } catch (error) {
      console.error("Update failed", error);
      setMealEditError(error instanceof Error ? error.message : "수정 내용을 저장하지 못했습니다.");
    } finally {
      setIsSavingMeal(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">

      {/* Receipt Container */}
      <div className="w-full max-w-md bg-white receipt-shadow relative pb-2">
        <div className="receipt-zigzag-top" />

        <div className="p-6 space-y-6">

          {/* Receipt Header */}
          <div className="relative text-center space-y-2">
            <button
              type="button"
              onClick={handleProfileClick}
              className="absolute top-0 right-0 z-20 p-1 opacity-50 hover:opacity-100 transition-opacity border-2 border-transparent hover:border-black cursor-pointer"
              aria-label="프로필 열기"
            >
              <User size={18} />
            </button>
            <div className="flex justify-center mb-1">
              <img src="/logo.png" alt="BITELOG" className="h-[46px] object-contain mix-blend-multiply" style={{ imageRendering: "pixelated" }} />
            </div>
            <div className="flex flex-col text-[10px] font-bold text-black/60 uppercase tracking-widest border-b-2 border-dashed border-black/20 pb-4">
              <span>Healthy Life Store</span>
              <span>Order #{format(currentDate, 'yyMMdd')}</span>
              <span>{format(currentDate, 'yyyy-MM-dd HH:mm')}</span>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex justify-between items-center py-2 border-b-2 border-dashed border-black/20">
            <button onClick={handlePrev} className="h-8 w-8 flex items-center justify-center hover:bg-black/5">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center uppercase">
              <div className="text-[10px] font-bold text-black/50 tracking-widest">Date</div>
              <div className="text-sm font-bold text-black">{format(currentDate, 'MM.dd EEE', { locale: ko })}</div>
            </div>
            <button onClick={handleNext} className="h-8 w-8 flex items-center justify-center hover:bg-black/5">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Stamp Calendar (Loyalty Card) */}
          <div className="border-2 border-gray-300 p-3 bg-white relative overflow-hidden rounded-sm">
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-100" />
            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Loyalty Card</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="hover:text-black text-gray-400">
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[10px] font-bold text-gray-400 min-w-[60px] text-center">{format(currentDate, 'MMMM', { locale: ko }).toUpperCase()}</span>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="hover:text-black text-gray-400">
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-[8px] font-bold text-gray-300">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const monthStart = startOfMonth(currentDate);
                const monthEnd = endOfMonth(currentDate);
                const startDay = getDay(monthStart);
                const daysInMonth = monthEnd.getDate();
                const calendarDays = [];

                // Empty slots for start padding
                for (let i = 0; i < startDay; i++) {
                  calendarDays.push(<div key={`empty-${i}`} className="aspect-square" />);
                }

                // Days
                for (let i = 1; i <= daysInMonth; i++) {
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);

                  // Calculate daily stats
                  const dayMeals = meals.filter(m => isSameDay(parseISO(m.eaten_at), date));
                  const hasLog = dayMeals.length > 0;
                  const dayKcal = dayMeals.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);
                  const achievementRate = dailyGoalKcal > 0 ? dayKcal / dailyGoalKcal : 0;

                  const isToday = isSameDay(date, new Date());
                  const isSelected = isSameDay(date, currentDate);

                  // Determine intensity by goal achievement rate.
                  let intensityClass = 'border-2 border-dashed border-gray-200 text-gray-300 group-hover:border-gray-400';
                  if (hasLog) {
                    const base = "shadow-[inset_0_0_4px_rgba(0,0,0,0.08)] transition-all";
                    if (achievementRate >= 1) intensityClass = `bg-zinc-800 text-white shadow-[inset_0_0_6px_rgba(0,0,0,0.18)] transition-all`;
                    else if (achievementRate >= 0.75) intensityClass = `bg-zinc-600 text-white ${base}`;
                    else if (achievementRate >= 0.5) intensityClass = `bg-zinc-400 text-black ${base}`;
                    else intensityClass = `bg-zinc-200 text-black ${base}`;
                  }

                  calendarDays.push(
                    <div
                      key={i}
                      onClick={() => setCurrentDate(date)}
                      className={`
                        aspect-square flex items-center justify-center relative cursor-pointer group rounded-full transition-colors
                        ${isSelected ? 'bg-gray-100' : ''}
                      `}
                    >
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                        ${intensityClass}
                      `}>
                        {i}
                      </div>
                      {isToday && <div className="absolute -bottom-1 w-1 h-1 bg-red-400 rounded-full" />}
                    </div>
                  );
                }
                return calendarDays;
              })()}
            </div>
            <div className="mt-2 text-[8px] text-center text-gray-300 uppercase tracking-widest">
              Collect stamps daily!
            </div>

            {/* Stamp decoration */}
            <div className="absolute -right-4 -bottom-4 w-12 h-12 border-4 border-gray-100 rounded-full" />
          </div>

          {/* Menu Actions */}
          <div className="space-y-2 pt-2">
            <div className="text-[10px] font-bold uppercase mb-1 tracking-widest text-black/40">Select Menu</div>
            <div className="grid grid-cols-3 border-2 border-black/10">
              <Link href="/recipe" className="flex items-center justify-center gap-2 border-r-2 border-black/10 p-2 hover:bg-black/5 transition-colors group">
                <Search size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Recipe</span>
              </Link>
              <Link href="/collection" className="flex items-center justify-center gap-2 border-r-2 border-black/10 p-2 hover:bg-black/5 transition-colors group">
                <BookOpen size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Book</span>
              </Link>
              <Link href="/statistics" className="flex items-center justify-center gap-2 p-2 hover:bg-black/5 transition-colors group">
                <BarChart3 size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Report</span>
              </Link>
            </div>
          </div>

          {/* Order Items (Meals) */}
          <div className="pt-2">
            <div className="flex justify-between text-[10px] font-bold border-b-2 border-black mb-2 pb-1 uppercase tracking-widest">
              <span>Item</span>
              <span>Kcal</span>
            </div>

            <div className="space-y-4 min-h-[120px]">
              {loading ? (
                <div className="text-center py-8 text-black/20 text-xs animate-pulse">Printing...</div>
              ) : filteredData.list.length === 0 ? (
                <div className="text-center py-8 text-black/20 text-xs italic">
                  ( 아직 기록된 식사가 없어요 )
                </div>
              ) : (
                (filteredData.list as MealLog[]).map((meal) => (
                  <div key={meal.id} className="group cursor-pointer select-none" onClick={() => openMealDetail(meal)}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-baseline">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase leading-none mb-1">
                            {(meal.items_json && meal.items_json[0]) ? meal.items_json[0].name : (meal.raw_text || 'Meal Log')}
                          </span>
                          <span className="text-[10px] text-black/40 font-mono tracking-tighter">
                            <span className="font-bold mr-1">[{normalizeMealType(meal.meal_type)}]</span>
                            {format(parseISO(meal.eaten_at), 'aa h:mm')}
                            {meal.items_json && meal.items_json.length > 1 && ` (+${meal.items_json.length - 1})`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums">{meal.total_kcal}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-[10px] text-blue-400 hover:text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDuplicateModal(meal);
                            }}
                          >
                            [COPY]
                          </button>
                          <button
                            className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDemoMode) {
                                openLoginPrompt("식단 삭제");
                                return;
                              }
                              setMealToDelete(meal.id);
                            }}
                          >
                            [DEL]
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-dashed border-black/20 pt-4 mt-6">
            <div className="flex justify-between items-end">
              <span className="text-xl font-bold uppercase tracking-tight">Total</span>
              <span className="text-xl font-bold tabular-nums">{filteredData.totalKcal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-[10px] text-black/50 mt-1 uppercase tracking-widest border-b border-dashed border-black/20 pb-2 mb-2">
              <span>오늘 목표</span>
              <span>{dailyGoalKcal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[10px] text-black/50 mb-2 border-b border-dashed border-black/20 pb-2">
              <span>달성률</span>
              <span>{goalProgress}%</span>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50">탄수화물</span>
                <span className="font-bold">{filteredData.totalCarbs}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50">단백질</span>
                <span className="font-bold">{filteredData.totalProtein}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50">지방</span>
                <span className="font-bold">{filteredData.totalFat}g</span>
              </div>
            </div>
          </div>

          {/* QR Footer */}
          <div className="text-center mt-3">
            <div className="flex items-center justify-center gap-4 opacity-80 mix-blend-multiply border-t-2 border-dashed border-black/20 pt-[35px] pb-[10px]">
              <div className="flex flex-col items-center gap-0">
                <img src="/qr_code.png" alt="QR Code" className="h-[76px] w-[76px] object-contain" style={{ imageRendering: "pixelated" }} />
                <span className="text-[7px] font-bold text-black uppercase tracking-[0.2em]">
                  Scan Here
                </span>
              </div>
              <div className="text-left flex-1 max-w-[140px]">
                <p className="text-[10px] font-bold uppercase tracking-widest leading-tight text-black">
                  Your Nutrition Journey
                </p>
                <p className="text-[8px] text-black/60 mt-1.5 leading-relaxed tracking-wide">
                  Every bite tells a story. Keep logging your meals to discover patterns and build a healthier lifestyle.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="receipt-zigzag-bottom" />
      </div>

      {/* Floating Action Button */}
      {isDemoMode ? (
        <Button
          onClick={() => openLoginPrompt("식단 추가")}
          className="fixed bottom-6 right-6 safe-area-bottom h-14 w-14 rounded-full shadow-xl bg-black hover:bg-gray-800 text-white border-2 border-white flex items-center justify-center"
        >
          <Plus size={24} />
        </Button>
      ) : (
        <Link href="/chat" className="fixed bottom-6 right-6 safe-area-bottom">
          <Button className="h-14 w-14 rounded-full shadow-xl bg-black hover:bg-gray-800 text-white border-2 border-white flex items-center justify-center">
            <Plus size={24} />
          </Button>
        </Link>
      )}

      {/* Meal Detail Modal (Simple Receipt Overlay) */}
      {
        selectedMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeMealDetail}>
            <div className="bg-white w-full max-w-xs receipt-shadow relative" onClick={e => e.stopPropagation()}>
              <div className="receipt-zigzag-top" />
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4 border-b-2 border-black pb-2">
                  <h2 className="text-xl font-bold uppercase">Detail</h2>
                  {!isDemoMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMeal((prev) => !prev);
                        setMealEditError("");
                        setMealEditForm(buildEditForm(selectedMeal));
                      }}
                      className="text-[10px] font-bold uppercase text-blue-600 hover:underline"
                    >
                      {isEditingMeal ? "[CANCEL EDIT]" : "[EDIT]"}
                    </button>
                  )}
                </div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-black/50">Type</span>
                    {isEditingMeal && mealEditForm ? (
                      <select
                        value={mealEditForm.meal_type}
                        onChange={(e) => setMealEditForm({ ...mealEditForm, meal_type: e.target.value })}
                        className="w-36 border-b border-black/30 bg-transparent px-1 py-0.5 text-right font-bold"
                      >
                        {MEAL_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold">{normalizeMealType(selectedMeal.meal_type)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-black/50">Time</span>
                    {isEditingMeal && mealEditForm ? (
                      <input
                        type="datetime-local"
                        value={mealEditForm.eaten_at}
                        onChange={(e) => setMealEditForm({ ...mealEditForm, eaten_at: e.target.value })}
                        className="w-44 border-b border-black/30 px-1 py-0.5 text-right"
                      />
                    ) : (
                      <span className="font-bold">{format(parseISO(selectedMeal.eaten_at), 'aa h:mm')}</span>
                    )}
                  </div>
                  <div className="border-b border-dashed border-black/20 my-2" />
                  <div className="space-y-1">
                    {isEditingMeal && mealEditForm ? (
                      <>
                        {mealEditForm.items.map((item, idx) => (
                          <div key={idx} className="border-b border-dashed border-black/10 pb-2 last:border-b-0">
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={item.name}
                                onChange={(e) => updateMealItemField(idx, "name", e.target.value)}
                                placeholder="음식명"
                                className="border-b border-black/30 px-1 py-0.5"
                              />
                              <input
                                type="number"
                                min="0"
                                value={item.kcal}
                                onChange={(e) => updateMealItemField(idx, "kcal", e.target.value)}
                                placeholder="kcal"
                                className="w-20 border-b border-black/30 px-1 py-0.5 text-right font-bold"
                              />
                            </div>
                            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={item.qty}
                                onChange={(e) => updateMealItemField(idx, "qty", e.target.value)}
                                placeholder="수량"
                                className="border-b border-black/20 px-1 py-0.5 text-[12px]"
                              />
                              <button
                                type="button"
                                onClick={() => removeMealItem(idx)}
                                className="text-[10px] font-bold uppercase text-red-500 hover:underline"
                              >
                                [DEL]
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addMealItem}
                          className="text-[10px] font-bold uppercase text-blue-600 hover:underline"
                        >
                          [ADD ITEM]
                        </button>
                      </>
                    ) : (
                      selectedMeal.items_json?.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.name}</span>
                          <span className="font-bold">{item.kcal} kcal</span>
                        </div>
                      ))
                    )}
                  </div>
                  {isEditingMeal && mealEditForm ? (
                    <div className="border-t-2 border-black mt-4 pt-2 space-y-3">
                      <div className="flex items-center justify-between text-lg font-bold">
                        <span>Total</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={mealEditForm.total_kcal}
                            onChange={(e) => setMealEditForm({ ...mealEditForm, total_kcal: e.target.value })}
                            className="w-20 border-b border-black/30 px-1 py-0.5 text-right"
                          />
                          <span>kcal</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 col-span-2">
                        <label className="space-y-1">
                          <span className="text-[10px] font-bold text-black/50">탄수화물</span>
                          <input
                            type="number"
                            min="0"
                            value={mealEditForm.carbs}
                            onChange={(e) => setMealEditForm({ ...mealEditForm, carbs: e.target.value })}
                            className="w-full border-b border-black/30 px-1 py-0.5"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-bold text-black/50">단백질</span>
                          <input
                            type="number"
                            min="0"
                            value={mealEditForm.protein}
                            onChange={(e) => setMealEditForm({ ...mealEditForm, protein: e.target.value })}
                            className="w-full border-b border-black/30 px-1 py-0.5"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-bold text-black/50">지방</span>
                          <input
                            type="number"
                            min="0"
                            value={mealEditForm.fat}
                            onChange={(e) => setMealEditForm({ ...mealEditForm, fat: e.target.value })}
                            className="w-full border-b border-black/30 px-1 py-0.5"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t-2 border-black mt-4 pt-2 flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{selectedMeal.total_kcal} kcal</span>
                    </div>
                  )}

                  {!isEditingMeal && selectedMeal.macros && (
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-dashed border-black/20 text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50">탄수화물</span>
                        <span className="font-bold">{selectedMeal.macros.carbs}g</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50">단백질</span>
                        <span className="font-bold">{selectedMeal.macros.protein}g</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50">지방</span>
                        <span className="font-bold">{selectedMeal.macros.fat}g</span>
                      </div>
                    </div>
                  )}
                  {isEditingMeal && mealEditForm ? (
                    <label className="block mt-4 pt-4 border-t border-dashed border-black/20 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-black/50">Summary</span>
                      <textarea
                        value={mealEditForm.ai_summary}
                        onChange={(e) => setMealEditForm({ ...mealEditForm, ai_summary: e.target.value })}
                        className="w-full min-h-20 border border-black/20 px-2 py-2 text-sm"
                      />
                    </label>
                  ) : (
                    selectedMeal.ai_summary && (
                      <p className="text-xs text-black/60 mt-4 pt-4 border-t border-dashed border-black/20 italic">
                        &quot;{selectedMeal.ai_summary}&quot;
                      </p>
                    )
                  )}
                  {isEditingMeal && mealEditForm && (
                    <label className="block mt-2 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-black/50">Raw Text</span>
                      <textarea
                        value={mealEditForm.raw_text}
                        onChange={(e) => setMealEditForm({ ...mealEditForm, raw_text: e.target.value })}
                        className="w-full min-h-16 border border-black/20 px-2 py-2 text-sm"
                      />
                    </label>
                  )}
                  {mealEditError && (
                    <p className="text-[11px] text-red-600 pt-2">{mealEditError}</p>
                  )}
                </div>
                {isEditingMeal ? (
                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <button
                      onClick={() => {
                        setIsEditingMeal(false);
                        setMealEditError("");
                        setMealEditForm(buildEditForm(selectedMeal));
                      }}
                      className="w-full border border-black py-2 text-xs font-bold uppercase hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMeal}
                      disabled={isSavingMeal}
                      className="w-full bg-blue-600 text-white py-2 text-xs font-bold uppercase hover:bg-blue-700 disabled:opacity-60"
                    >
                      {isSavingMeal ? "Saving..." : "Save Edit"}
                    </button>
                  </div>
                ) : (
                  <button onClick={closeMealDetail} className="w-full mt-6 bg-black text-white py-2 text-xs font-bold uppercase hover:bg-gray-800">
                    Close Ticket
                  </button>
                )}
              </div>
              <div className="receipt-zigzag-bottom" />
            </div>
          </div>
        )
      }

      {/* Duplicate Confirmation Modal */}
      {
        mealToDuplicate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setMealToDuplicate(null)}>
            <div className="bg-white p-6 max-w-xs w-full text-center shadow-xl border-2 border-black" onClick={e => e.stopPropagation()}>
              <p className="font-bold mb-2">DUPLICATE ITEM</p>
              <p className="text-xs text-black/60 mb-4">Select the date to copy this meal to.</p>

              <div className="mb-4">
                <input
                  type="date"
                  className="border-2 border-black p-2 w-full font-mono text-sm uppercase"
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  id="duplicate-date-input"
                />
              </div>

              <div className="flex gap-2 justify-center">
                <button onClick={() => setMealToDuplicate(null)} className="flex-1 px-4 py-2 border border-black text-xs font-bold hover:bg-gray-100 uppercase">Cancel</button>
                <button
                  onClick={() => {
                    const dateInput = document.getElementById('duplicate-date-input') as HTMLInputElement;
                    confirmDuplicate(dateInput.value);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 uppercase"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation */}
      {
        mealToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setMealToDelete(null)}>
            <div className="bg-white p-6 max-w-xs w-full text-center shadow-xl border-2 border-black" onClick={e => e.stopPropagation()}>
              <p className="font-bold mb-4">DELETE This Item?</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setMealToDelete(null)} className="px-4 py-2 border border-black text-xs font-bold hover:bg-gray-100">CANCEL</button>
                <button onClick={handleDeleteMeal} className="px-4 py-2 bg-red-600 text-white text-xs font-bold hover:bg-red-700">DELETE</button>
              </div>
            </div>
          </div>
        )
      }

      {showDemoTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border-2 border-black shadow-xl p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-black/50">Quick Tour</p>
              <h2 className="text-lg font-bold">비로그인 데모 둘러보기</h2>
              <p className="text-sm text-black/70">최근 한달 샘플 데이터를 자유롭게 탐색할 수 있어요.</p>
            </div>

            <div className="space-y-2 text-xs text-black/80 leading-relaxed border-y border-dashed border-black/20 py-3">
              <p>1. 날짜를 이동하며 일자별 식단을 확인하세요.</p>
              <p>2. 아이템을 눌러 상세 영양정보를 볼 수 있어요.</p>
              <p>3. 추가/복제/삭제는 로그인 후 바로 사용할 수 있습니다.</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeDemoTutorial}
                className="flex-1 border border-black py-2 text-xs font-bold hover:bg-gray-100"
              >
                둘러보기 시작
              </button>
              <button
                type="button"
                onClick={() => {
                  closeDemoTutorial();
                  router.push("/login");
                }}
                className="flex-1 bg-black text-white py-2 text-xs font-bold hover:bg-gray-800"
              >
                로그인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowLoginPrompt(false)}>
          <div className="w-full max-w-xs bg-white border-2 border-black shadow-xl p-5 text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">{pendingActionLabel}은(는) 로그인 후 사용할 수 있어요</p>
            <p className="text-xs text-black/60">데모에서는 조회만 제공됩니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 border border-black py-2 text-xs font-bold hover:bg-gray-100"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="flex-1 bg-black text-white py-2 text-xs font-bold hover:bg-gray-800"
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      )}

    </main >
  );
}
