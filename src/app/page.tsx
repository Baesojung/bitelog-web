"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Search, BookOpen, ChevronLeft, ChevronRight, Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function Home() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper State
  const [mealToDelete, setMealToDelete] = useState<number | null>(null);
  const [mealToDuplicate, setMealToDuplicate] = useState<MealLog | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);

  useEffect(() => {
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

  const filteredData = useMemo(() => {
    if (!meals.length) return { list: [], totalKcal: 0, totalCarbs: 0, totalProtein: 0, totalFat: 0 };
    const list = meals.filter(m => isSameDay(parseISO(m.eaten_at), currentDate));
    const totalKcal = list.reduce((acc, curr) => acc + (curr.total_kcal || 0), 0);
    const totalCarbs = list.reduce((acc, curr) => acc + (curr.macros?.carbs || 0), 0);
    const totalProtein = list.reduce((acc, curr) => acc + (curr.macros?.protein || 0), 0);
    const totalFat = list.reduce((acc, curr) => acc + (curr.macros?.fat || 0), 0);
    return { list, totalKcal, totalCarbs, totalProtein, totalFat };
  }, [meals, currentDate]);

  const handlePrev = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNext = () => setCurrentDate(prev => addDays(prev, 1));

  const handleDeleteMeal = async () => {
    if (!mealToDelete) return;
    try {
      await fetch(`http://localhost:8000/v1/meals/${mealToDelete}`, { method: 'DELETE' });
      setMeals(prev => prev.filter(m => m.id !== mealToDelete));
      setMealToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Initial Click on Copy
  const openDuplicateModal = (meal: MealLog) => {
    setMealToDuplicate(meal);
  };

  const confirmDuplicate = async (targetDateStr: string) => {
    if (!mealToDuplicate) return;

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

      // Remove ID and created_at
      // @ts-ignore
      delete newMeal.id;
      // @ts-ignore
      delete newMeal.created_at;

      const res = await fetch("http://localhost:8000/v1/meals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">

      {/* Receipt Container */}
      <div className="w-full max-w-md bg-white receipt-shadow relative pb-2">
        <div className="receipt-zigzag-top" />

        <div className="p-6 space-y-6">

          {/* Receipt Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-black transform scale-y-110">
              BITELOG
            </h1>
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

                  const isToday = isSameDay(date, new Date());
                  const isSelected = isSameDay(date, currentDate);

                  // Determine intensity
                  let intensityClass = 'border-2 border-dashed border-gray-200 text-gray-300 group-hover:border-gray-400';
                  if (hasLog) {
                    // Base style for logged days
                    const base = "text-white shadow-[inset_0_0_4px_rgba(0,0,0,0.2)] transition-all";
                    if (dayKcal >= 2000) intensityClass = `bg-slate-900 ${base}`;
                    else if (dayKcal >= 1200) intensityClass = `bg-slate-800/90 ${base}`;
                    else if (dayKcal >= 600) intensityClass = `bg-slate-800/70 ${base}`;
                    else intensityClass = `bg-slate-800/40 ${base}`;
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
                  ( No orders yet )
                </div>
              ) : (
                (filteredData.list as MealLog[]).map((meal) => (
                  <div key={meal.id} className="group cursor-pointer select-none" onClick={() => setSelectedMeal(meal)}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-baseline">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase leading-none mb-1">
                            {(meal.items_json && meal.items_json[0]) ? meal.items_json[0].name : (meal.raw_text || 'Meal Log')}
                          </span>
                          <span className="text-[10px] text-black/40 font-mono tracking-tighter">
                            <span className="font-bold mr-1">[{meal.meal_type || 'MEAL'}]</span>
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
                            onClick={(e) => { e.stopPropagation(); setMealToDelete(meal.id); }}
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
              <span>Daily Goal</span>
              <span>2,000</span>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50 uppercase">Carbs</span>
                <span className="font-bold">{filteredData.totalCarbs}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50 uppercase">Protein</span>
                <span className="font-bold">{filteredData.totalProtein}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-black/50 uppercase">Fat</span>
                <span className="font-bold">{filteredData.totalFat}g</span>
              </div>
            </div>
          </div>

          {/* Barcode Footer */}
          <div className="pt-8 text-center space-y-4">
            <div className="barcode opacity-80" />
            <p className="text-[10px] uppercase font-bold text-black/40 tracking-[0.3em]">
              Thank you
            </p>
          </div>
        </div>

        <div className="receipt-zigzag-bottom" />
      </div>

      {/* Floating Action Button */}
      <Link href="/chat" className="fixed bottom-6 right-6 safe-area-bottom">
        <Button className="h-14 w-14 rounded-full shadow-xl bg-black hover:bg-gray-800 text-white border-2 border-white flex items-center justify-center">
          <Plus size={24} />
        </Button>
      </Link>

      {/* Meal Detail Modal (Simple Receipt Overlay) */}
      {
        selectedMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedMeal(null)}>
            <div className="bg-white w-full max-w-xs receipt-shadow relative" onClick={e => e.stopPropagation()}>
              <div className="receipt-zigzag-top" />
              <div className="p-6">
                <h2 className="text-xl font-bold uppercase text-center mb-4 border-b-2 border-black pb-2">Detail</h2>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-black/50">Type</span>
                    <span className="font-bold uppercase">{selectedMeal.meal_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black/50">Time</span>
                    <span className="font-bold">{format(parseISO(selectedMeal.eaten_at), 'aa h:mm')}</span>
                  </div>
                  <div className="border-b border-dashed border-black/20 my-2" />
                  <div className="space-y-1">
                    {selectedMeal.items_json?.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="font-bold">{item.kcal}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-2 border-black mt-4 pt-2 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{selectedMeal.total_kcal}</span>
                  </div>

                  {selectedMeal.macros && (
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-dashed border-black/20 text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50 uppercase">Carbs</span>
                        <span className="font-bold">{selectedMeal.macros.carbs}g</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50 uppercase">Protein</span>
                        <span className="font-bold">{selectedMeal.macros.protein}g</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-black/50 uppercase">Fat</span>
                        <span className="font-bold">{selectedMeal.macros.fat}g</span>
                      </div>
                    </div>
                  )}
                  {selectedMeal.ai_summary && (
                    <p className="text-xs text-black/60 mt-4 pt-4 border-t border-dashed border-black/20 italic">
                      "{selectedMeal.ai_summary}"
                    </p>
                  )}
                </div>
                <button onClick={() => setSelectedMeal(null)} className="w-full mt-6 bg-black text-white py-2 text-xs font-bold uppercase hover:bg-gray-800">
                  Close Ticket
                </button>
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

    </main >
  );
}
