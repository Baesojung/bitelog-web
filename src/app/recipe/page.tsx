"use client";

import { useState } from "react";
import Link from 'next/link';

const ingredientsList = [
    '닭가슴살', '계란', '두부', '고구마', '양파',
    '파', '마늘', '김치', '돼지고기', '소고기',
    '참치캔', '스팸', '감자', '버섯', '콩나물',
    '시금치', '오이', '당근', '양배추', '브로콜리',
    '토마토', '치즈', '우유', '요거트', '아몬드'
];

export default function RecipePage() {
    const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [recipe, setRecipe] = useState<string | null>(null);

    const toggleIngredient = (ing: string) => {
        setSelectedIngredients(prev =>
            prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]
        );
    };

    const generateRecipe = async () => {
        if (selectedIngredients.length === 0) return;
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setRecipe(`
        [RECIPE TICKET #992]
        
        MENU: Special ${selectedIngredients[0]} Stir-fry
        
        INGREDIENTS:
        - ${selectedIngredients.join('\n- ')}
        
        INSTRUCTIONS:
        1. Prep ingredients.
        2. Fry pan.
        3. Cook until done.
        4. Serve warm.
      `);
            setLoading(false);
        }, 2000);
    };

    return (
        <main className="min-h-screen bg-[#e0e0e0] py-8 px-4 flex justify-center items-start font-mono">
            <div className="w-full max-w-md bg-white receipt-shadow relative pb-2 min-h-[600px]">
                <div className="receipt-zigzag-top" />

                <div className="p-6 relative">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b-2 border-dashed border-black/20 pb-4 mb-6">
                        <Link href="/" className="text-xs font-bold uppercase hover:bg-black/5 p-2 -ml-2 rounded">
                            &lt; Back
                        </Link>
                        <h1 className="text-xl font-bold uppercase tracking-widest">Order Sheet</h1>
                        <div className="w-8" />
                    </div>

                    {/* Ingredient Selection */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                                1. Select Ingredients
                            </h2>
                            <div className="grid grid-cols-3 gap-2">
                                {ingredientsList.map((ing) => (
                                    <button
                                        key={ing}
                                        onClick={() => toggleIngredient(ing)}
                                        className={`
                      text-xs py-2 px-1 border-2 transition-all font-bold uppercase
                      ${selectedIngredients.includes(ing)
                                                ? 'border-black bg-black text-white italic'
                                                : 'border-black/10 text-black/60 hover:border-black/30 bg-white'}
                    `}
                                    >
                                        {selectedIngredients.includes(ing) ? '[x] ' : '[ ] '}{ing}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Diet Type Selection */}
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                                2. Preference
                            </h2>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {['Balanced', 'Low Carb', 'High Protein', 'Vegan'].map(type => (
                                    <button key={type} className="border border-black px-3 py-1 text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors whitespace-nowrap">
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateRecipe}
                            disabled={loading || selectedIngredients.length === 0}
                            className={`
                w-full py-4 border-2 border-black font-bold uppercase tracking-widest text-sm
                transition-all relative top-0 hover:-top-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                ${loading ? 'bg-black/10 cursor-wait' : 'bg-white active:top-0 active:shadow-none'}
              `}
                        >
                            {loading ? 'Printing Recipe...' : 'Print Recipe Ticket'}
                        </button>
                    </div>

                    {/* Recipe Result */}
                    {recipe && (
                        <div className="mt-8 pt-8 border-t-2 border-dashed border-black">
                            <div className="bg-white border border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] rotate-1">
                                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                                    {recipe}
                                </pre>
                                <div className="barcode h-8 mt-4 opacity-50" />
                            </div>
                        </div>
                    )}

                </div>

                <div className="receipt-zigzag-bottom" />
            </div>
        </main>
    );
}
