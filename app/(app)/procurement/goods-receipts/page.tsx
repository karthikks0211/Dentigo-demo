"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCollection } from "@/lib/firestore-hooks";
import type { GoodsReceipt, Supplier } from "@/lib/types";
import PillLoader from "@/components/PillLoader";

export default function GoodsReceiptsPage() {
    const { data: grns, loading: l1 } = useCollection<GoodsReceipt>("goodsReceipts");
    const { data: suppliers, loading: l2 } = useCollection<Supplier>("suppliers");
    const [query, setQuery] = useState("");

    const supplierFor = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown supplier";

    const sorted = useMemo(() => [...grns].sort((a, b) => b.createdAt - a.createdAt), [grns]);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return sorted.filter((g) =>
            g.grnNo.toLowerCase().includes(q) || g.poNumber.toLowerCase().includes(q) || supplierFor(g.supplierId).toLowerCase().includes(q)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, query, suppliers]);

    if (l1 || l2) return <PillLoader label="Loading goods receipts…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Goods Receipts</h1>
                    <p>Every confirmed delivery against a purchase order — the only events that create or top up batches.</p>
                </div>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search goods receipts…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>GRN #</th>
                                <th>PO #</th>
                                <th>Supplier</th>
                                <th>Lines Received</th>
                                <th>Received By</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No goods receipts found</strong></div></td></tr>
                            ) : (
                                filtered.map((g) => (
                                    <tr key={g.id}>
                                        <td><b>{g.grnNo}</b></td>
                                        <td>{g.poNumber}</td>
                                        <td>{supplierFor(g.supplierId)}</td>
                                        <td>
                                            <span className="linesCell" title={g.lines.map((l) => `${l.name} +${l.receivedQtyNow} (${l.batchNo})`).join(", ")}>
                                                {g.lines.map((l) => `${l.name} +${l.receivedQtyNow}`).join(", ")}
                                            </span>
                                        </td>
                                        <td>{g.receivedBy}</td>
                                        <td>{g.date}</td>
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
