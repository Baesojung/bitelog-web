"use client";

import Link from 'next/link';
import { Lock } from "lucide-react";

export default function CollectionPage() {
    // Mock Data
    const collections = [
        { id: 1, name: 'Vegan Salad', date: '2023-10-01', unlocked: true },
        { id: 2, name: 'Chicken Breast', date: '2023-10-05', unlocked: true },
        { id: 3, name: 'Tofu Stake', date: '2023-10-12', unlocked: true },
        { id: 4, name: '???', date: '-', unlocked: false },
        { id: 5, name: '???', date: '-', unlocked: false },
        { id: 6, name: '???', date: '-', unlocked: false },
    ];

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
                        <h1 className="text-xl font-bold uppercase tracking-widest text-center">Receipt Book</h1>
                        <div className="w-8" />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-0 border-2 border-black mb-8">
                        <div className="p-3 text-center border-r-2 border-black">
                            <div className="text-[10px] uppercase text-black/50 font-bold">Total</div>
                            <div className="text-lg font-bold">12</div>
                        </div>
                        <div className="p-3 text-center border-r-2 border-black bg-black text-white">
                            <div className="text-[10px] uppercase text-white/50 font-bold">Collected</div>
                            <div className="text-lg font-bold">3</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-[10px] uppercase text-black/50 font-bold">Rate</div>
                            <div className="text-lg font-bold">25%</div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {collections.map((item) => (
                            <div
                                key={item.id}
                                className={`
                    aspect-[3/4] border-2 border-black p-3 flex flex-col justify-between relative
                    transition-all hover:-translate-y-1 hover:shadow-lg
                    ${item.unlocked ? 'bg-white' : 'bg-black/5 border-dashed'}
                  `}
                            >
                                {item.unlocked ? (
                                    <>
                                        <div className="border-b border-black pb-1 mb-2 text-right">
                                            <span className="text-[10px] font-bold block">NO. {String(item.id).padStart(3, '0')}</span>
                                        </div>
                                        <div className="flex-1 flex items-center justify-center text-center">
                                            <h3 className="font-bold uppercase text-sm leading-tight">{item.name}</h3>
                                        </div>
                                        <div className="text-[10px] text-black/40 text-center pt-2 border-t border-dashed border-black/20">
                                            {item.date}
                                        </div>
                                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/10 rounded-full" />
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                                        <Lock size={24} className="mb-2" />
                                        <span className="text-xs font-bold uppercase">Locked</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                </div>

                <div className="receipt-zigzag-bottom" />
            </div>
        </main>
    );
}
