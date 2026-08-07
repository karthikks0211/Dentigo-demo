"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { Batch, Medicine, StockTransaction } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import PillLoader from "@/components/PillLoader";

export default function StockTransactionsPage() {
    const { data: transactions, loading } = useCollection<StockTransaction>("stockTransactions");
    const { data: medicines } = useCollection<Medicine>("medicines");
    const { data: batches } = useCollection<Batch>("batches");
    const [query, setQuery] = useState("");

    const medicineFor = (id: string) => medicines.find((m) => m.id === id)?.name || "Unknown medicine";
    const batchNoFor = (id: string) => batches.find((b) => b.id === id)?.batchNo || "—";

    const sorted = useMemo(
        () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt - a.createdAt))),
        [transactions]
    );

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return sorted.filter((t) => medicineFor(t.medicineId).toLowerCase().includes(q) || t.type.toLowerCase().includes(q));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, query, medicines]);

    if (loading) return <PillLoader label="Loading stock transactions…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Stock Transactions</h1>
                    <p>Full audit log of every stock movement — receipts, dispenses, returns, and write-offs.</p>
                </div>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search transactions…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Medicine</th>
                                <th>Batch</th>
                                <th>Type</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty">⌕<br /><strong>No stock transactions found</strong></div></td></tr>
                            ) : (
                                filtered.map((t) => (
                                    <tr key={t.id}>
                                        <td>{t.date}</td>
                                        <td><b>{medicineFor(t.medicineId)}</b></td>
                                        <td>{batchNoFor(t.batchId)}</td>
                                        <td><Badge status={t.type} /></td>
                                        <td>
                                            <b style={{ color: t.qty >= 0 ? "#28936e" : "#d75554" }}>
                                                {t.qty >= 0 ? "+" : ""}{t.qty}
                                            </b>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
