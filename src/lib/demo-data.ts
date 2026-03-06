import { set, startOfDay, subDays } from "date-fns";

export type DemoFoodItem = {
  name: string;
  qty: string;
  kcal: number;
  macros: {
    carbs: number;
    protein: number;
    fat: number;
  };
};

export type DemoMealLog = {
  id: number;
  user_id: number;
  raw_text: string;
  meal_type: string;
  eaten_at: string;
  items_json: DemoFoodItem[];
  total_kcal: number;
  macros: {
    carbs: number;
    protein: number;
    fat: number;
  };
  ai_summary: string;
  created_at: string;
};

const MEAL_TEMPLATES = {
  breakfast: [
    { name: "그릭요거트 볼", qty: "1그릇", kcal: 360, carbs: 42, protein: 24, fat: 9 },
    { name: "에그 샌드위치", qty: "1개", kcal: 410, carbs: 38, protein: 23, fat: 16 },
    { name: "바나나 오트밀", qty: "1그릇", kcal: 340, carbs: 58, protein: 12, fat: 6 },
  ],
  lunch: [
    { name: "닭가슴살 샐러드", qty: "1접시", kcal: 560, carbs: 36, protein: 41, fat: 24 },
    { name: "소불고기 덮밥", qty: "1그릇", kcal: 690, carbs: 78, protein: 31, fat: 23 },
    { name: "두부 비빔밥", qty: "1그릇", kcal: 610, carbs: 82, protein: 22, fat: 20 },
  ],
  dinner: [
    { name: "연어구이 정식", qty: "1접시", kcal: 640, carbs: 52, protein: 38, fat: 30 },
    { name: "치킨 파스타", qty: "1접시", kcal: 700, carbs: 84, protein: 36, fat: 24 },
    { name: "소고기 채소 플레이트", qty: "1접시", kcal: 670, carbs: 34, protein: 44, fat: 32 },
  ],
  snack: [
    { name: "프로틴 쉐이크", qty: "1잔", kcal: 220, carbs: 15, protein: 26, fat: 6 },
    { name: "믹스넛", qty: "30g", kcal: 190, carbs: 8, protein: 6, fat: 16 },
    { name: "과일 컵", qty: "1컵", kcal: 160, carbs: 37, protein: 2, fat: 1 },
  ],
} as const;

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

const MEAL_HOURS: Record<MealType, number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19,
  snack: 16,
};

const getTemplate = (mealType: MealType, dayOffset: number, mealIndex: number) => {
  const list = MEAL_TEMPLATES[mealType];
  const index = (dayOffset * 37 + mealIndex * 17) % list.length;
  return list[index];
};

export const createRecentDemoMeals = (baseDate = new Date()): DemoMealLog[] => {
  const today = startOfDay(baseDate);
  const meals: DemoMealLog[] = [];
  let nextId = -1;

  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const day = subDays(today, dayOffset);
    const dayMealTypes = dayOffset % 2 === 0
      ? ["breakfast", "lunch", "dinner", "snack"]
      : ["breakfast", "lunch", "dinner"];

    dayMealTypes.forEach((mealType, mealIndex) => {
      const template = getTemplate(mealType, dayOffset, mealIndex);
      const variance = ((dayOffset + mealIndex) % 3) * 20;

      const eatenAt = set(day, {
        hours: MEAL_HOURS[mealType],
        minutes: 10 + mealIndex * 7,
        seconds: 0,
        milliseconds: 0,
      });

      const totalKcal = template.kcal + variance;
      const carbs = template.carbs + Math.floor(variance * 0.2);
      const protein = template.protein + Math.floor(variance * 0.1);
      const fat = template.fat + Math.floor(variance * 0.05);

      meals.push({
        id: nextId,
        user_id: 0,
        raw_text: `${template.name} (${template.qty})`,
        meal_type: MEAL_TYPE_LABELS[mealType],
        eaten_at: eatenAt.toISOString(),
        items_json: [
          {
            name: template.name,
            qty: template.qty,
            kcal: totalKcal,
            macros: { carbs, protein, fat },
          },
        ],
        total_kcal: totalKcal,
        macros: { carbs, protein, fat },
        ai_summary: "비로그인 체험을 위한 데모 데이터입니다.",
        created_at: eatenAt.toISOString(),
      });

      nextId -= 1;
    });
  }

  return meals.sort((a, b) => b.eaten_at.localeCompare(a.eaten_at));
};
