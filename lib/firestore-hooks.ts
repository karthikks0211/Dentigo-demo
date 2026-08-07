"use client";

import { useEffect, useState } from "react";
import {
    collection,
    onSnapshot,
    query,
    QueryConstraint,
    DocumentData
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Live-subscribes to a Firestore collection. `constraints` is re-evaluated on every
 * render (build it inline), but the subscription itself only restarts when `path`
 * or an entry in `deps` changes — pass the actual values your constraints depend on
 * (e.g. [medicineId]) so the listener doesn't get torn down/rebuilt every render.
 */
export function useCollection<T extends DocumentData>(
    path: string,
    constraints: QueryConstraint[] = [],
    deps: unknown[] = []
): { data: T[]; loading: boolean; error: string | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, path), ...constraints);
        const unsub = onSnapshot(
            q,
            (snap) => {
                setData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T)));
                setLoading(false);
                setError(null);
            },
            (err) => {
                setError(err.message);
                setLoading(false);
            }
        );
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, ...deps]);

    return { data, loading, error };
}
