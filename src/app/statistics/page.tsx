"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, getDay, isSameMonth, parseISO, getWeekOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Types
type FoodItem = {
    name: string;
    qty: string;
    kcal: number;
};

type MealLog = {
    id: number;
    user_id: number;
    eaten_at: string;
    total_kcal: number;
    macros?: {
        carbs: number;
        protein: number;
        fat: number;
    };
};

export default function StatisticsPage() {
    const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [meals, setMeals] = useState<MealLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Date Navigation Handlers
    const handlePrev = () => {
        if (view === 'weekly') setCurrentDate(prev => subWeeks(prev, 1));
        else setCurrentDate(prev => subMonths(prev, 1));
    };

    const handleNext = () => {
        if (view === 'weekly') setCurrentDate(prev => addWeeks(prev, 1));
        else setCurrentDate(prev => addMonths(prev, 1));
    };

    // Fetch Data (Always fetch full month view + padding)
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // Fetch range: Start of first week of month to End of last week of month
                // Use 'startOfMonth' as anchor for currentDate
                const monthStart = startOfMonth(currentDate);
                const monthEnd = endOfMonth(currentDate);

                const fetchStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const fetchEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

                const res = await fetch(`http://localhost:8000/v1/meals?start_date=${format(fetchStart, 'yyyy-MM-dd')}&end_date=${format(fetchEnd, 'yyyy-MM-dd')}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setMeals(data);
            } catch (error) {
                console.error("Error fetching stats:", error);
                setMeals([]);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [currentDate]); // Refetch when month changes (currentDate changes significantly)

    // Chart Data Processing
    const chartData = useMemo(() => {
        if (view === 'weekly') {
            const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

            return days.map((dayName, index) => {
                const targetDate = new Date(weekStart);
                targetDate.setDate(weekStart.getDate() + index);

                // Filter from loaded meals
                const dailyMeals = meals.filter(m => isSameDay(parseISO(m.eaten_at), targetDate));
                const total = dailyMeals.reduce((sum, m) => sum + m.total_kcal, 0);
                const carbs = dailyMeals.reduce((sum, m) => sum + (m.macros?.carbs || 0), 0);
                const protein = dailyMeals.reduce((sum, m) => sum + (m.macros?.protein || 0), 0);
                const fat = dailyMeals.reduce((sum, m) => sum + (m.macros?.fat || 0), 0);

                return { name: dayName, kcal: total, carbs, protein, fat };
            });
        } else {
            // Monthly View
            // Show W1..W5 based on currentDate's month
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);

            // Calculate data for each week in this month
            // We can iterate weeks.
            const weeksData = [];
            let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });

            let weekIndex = 1;
            while (currentWeekStart <= monthEnd) {
                const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

                // Filter meals in this week AND in this month (optional, usually week)
                // Let's filter meals in this week range.
                const weeklyMeals = meals.filter(m => {
                    const d = parseISO(m.eaten_at);
                    return d >= currentWeekStart && d <= currentWeekEnd;
                });

                const total = weeklyMeals.reduce((sum, m) => sum + m.total_kcal, 0);
                const carbs = weeklyMeals.reduce((sum, m) => sum + (m.macros?.carbs || 0), 0);
                const protein = weeklyMeals.reduce((sum, m) => sum + (m.macros?.protein || 0), 0);
                const fat = weeklyMeals.reduce((sum, m) => sum + (m.macros?.fat || 0), 0);

                weeksData.push({ name: `W${weekIndex}`, kcal: total, carbs, protein, fat });

                currentWeekStart = addWeeks(currentWeekStart, 1);
                weekIndex++;
            }
            return weeksData;
        }
    }, [meals, view, currentDate]);

    // Statistics Calculation (same as before)
    const stats = useMemo(() => {
        // ... (existing logic)
        const total = chartData.reduce((acc, curr) => acc + curr.kcal, 0);
        const totalCarbs = chartData.reduce((acc, curr) => acc + (curr.carbs || 0), 0);
        const totalProtein = chartData.reduce((acc, curr) => acc + (curr.protein || 0), 0);
        const totalFat = chartData.reduce((acc, curr) => acc + (curr.fat || 0), 0);

        let dailyAvg = 0;
        let dailyCarbs = 0;
        let dailyProtein = 0;
        let dailyFat = 0;

        if (view === 'weekly') {
            dailyAvg = Math.round(total / 7);
            dailyCarbs = Math.round(totalCarbs / 7);
            dailyProtein = Math.round(totalProtein / 7);
            dailyFat = Math.round(totalFat / 7);
        } else {
            const days = endOfMonth(currentDate).getDate();
            dailyAvg = Math.round(total / days);
            dailyCarbs = Math.round(totalCarbs / days);
            dailyProtein = Math.round(totalProtein / days);
            dailyFat = Math.round(totalFat / days);
        }
        const maxItem = chartData.length > 0
            ? chartData.reduce((prev, current) => (prev.kcal > current.kcal) ? prev : current)
            : { name: '-', kcal: 0 };

        return {
            total, dailyAvg, maxLabel: maxItem.name, maxVal: maxItem.kcal,
            dailyCarbs, dailyProtein, dailyFat
        };
    }, [chartData, view, currentDate]);

    // Date Label & Calendar Popover Trigger
    const dateLabel = useMemo(() => {
        if (view === 'weekly') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return `${format(start, 'MM.dd')} - ${format(end, 'MM.dd')}`;
        } else {
            return format(currentDate, 'MMMM yyyy');
        }
    }, [currentDate, view]);

    // Coach Note (existing)
    const coachNote = useMemo(() => {
        if (stats.dailyAvg === 0) return "No data recorded for this period.";
        if (stats.dailyAvg > 2300) return "Intake is on the higher side. Focus on nutrient-dense foods.";
        if (stats.dailyAvg < 1200) return "Intake is quite low. Make sure to fuel your body enough.";
        return "You are maintaining a balanced intake. Keep it up!";
    }, [stats.dailyAvg]);

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[80vh]">
                <div className="receipt-zigzag-top" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b-2 border-dashed border-black/20 pb-4 mb-6">
                        <Link href="/" className="text-xs font-bold uppercase hover:bg-black/5 p-2 -ml-2 rounded">
                            &lt; Back
                        </Link>
                        <h1 className="text-xl font-bold uppercase tracking-widest text-center">Health Report</h1>
                        <div className="w-8" />
                    </div>

                    {/* Tab Switcher */}
                    <div className="grid grid-cols-2 border-2 border-black mb-6">
                        <button
                            onClick={() => setView('weekly')}
                            className={`py-2 text-xs font-bold uppercase transition-colors ${view === 'weekly' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setView('monthly')}
                            className={`py-2 text-xs font-bold uppercase transition-colors ${view === 'monthly' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                        >
                            Monthly
                        </button>
                    </div>

                    {/* Date Navigation with Popover Calendar */}
                    <div className="flex justify-between items-center mb-6 px-4 py-2 border-b-2 border-dashed border-black/20">
                        <button onClick={handlePrev} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                            <ChevronLeft size={16} />
                        </button>

                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="h-auto p-1 font-bold uppercase tracking-widest hover:bg-black/5">
                                    {dateLabel} <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <Calendar
                                    mode="single"
                                    selected={currentDate}
                                    onSelect={(date) => {
                                        if (date) {
                                            setCurrentDate(date);
                                            setIsCalendarOpen(false);
                                        }
                                    }}
                                    initialFocus
                                    modifiers={{
                                        hasLog: (date) => meals.some(m => isSameDay(parseISO(m.eaten_at), date))
                                    }}
                                    modifiersClassNames={{
                                        hasLog: "bg-black text-white font-bold rounded-full hover:bg-black/80 hover:text-white"
                                    }}
                                    className="rounded-md border shadow"
                                />
                            </PopoverContent>
                        </Popover>

                        <button onClick={handleNext} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Content (Chart, Stats, Note) ... same as before */}
                    <div className="space-y-6">
                        {/* Chart Section */}
                        <div className={`border border-black p-4 bg-white relative transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
                            {/* ... existing chart code ... */}
                            <div className="absolute top-0 left-0 bg-black text-white text-[10px] font-bold px-2 py-1 uppercase">
                                {view === 'weekly' ? 'Daily Trend' : 'Weekly Summary'}
                            </div>
                            {loading && <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase animate-pulse">Loading...</div>}
                            <div className="mt-6 h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 10, fontFamily: 'monospace' }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: '#fff', border: '1px solid #000', fontSize: '10px' }}
                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                        />
                                        <Bar dataKey="kcal" fill="#000" radius={[2, 2, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.kcal > (view === 'weekly' ? 2200 : 15000) ? '#ef4444' : '#000'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Statement Text */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Total Intake</span>
                                <span className="font-bold tabular-nums">{stats.total.toLocaleString()} kcal</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Daily Average</span>
                                <span className="font-bold tabular-nums">{stats.dailyAvg.toLocaleString()} kcal</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Total Carbs (Avg)</span>
                                <span className="font-bold tabular-nums">{stats.dailyCarbs.toLocaleString()}g</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Total Protein (Avg)</span>
                                <span className="font-bold tabular-nums">{stats.dailyProtein.toLocaleString()}g</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Total Fat (Avg)</span>
                                <span className="font-bold tabular-nums">{stats.dailyFat.toLocaleString()}g</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-black/20 pb-1">
                                <span className="text-black/50 uppercase text-xs">Highest</span>
                                <span className="font-bold text-red-500 tabular-nums">{stats.maxLabel} ({stats.maxVal.toLocaleString()})</span>
                            </div>
                        </div>

                        {/* Analysis Box */}
                        <div className="bg-black/5 p-3 text-xs leading-relaxed border-l-4 border-black">
                            <span className="font-bold uppercase block mb-1">Coach Note:</span>
                            {coachNote}
                        </div>

                        <div className="text-center pt-8">
                            <div className="barcode h-8 opacity-40" />
                            <p className="text-[8px] uppercase font-bold text-black/30 mt-2 tracking-widest">Generated by Bitelog AI</p>
                        </div>
                    </div>

                </div>

                <div className="receipt-zigzag-bottom" />
            </div>
        </main >
    );
}
