"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore-hooks";
import { useToast } from "@/lib/toast-context";
import type { Employee, EmployeeRole } from "@/lib/types";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PillLoader from "@/components/PillLoader";

const ROLES: EmployeeRole[] = ["Manager", "Cashier", "Dental Assistant", "Front Desk", "Cleaner", "Other"];

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export default function EmployeesPage() {
    const { data: employees, loading } = useCollection<Employee>("employees");
    const showToast = useToast();

    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [deleting, setDeleting] = useState<Employee | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return [...employees]
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter((e) => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
    }, [employees, query]);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const role = String(f.get("role") || "Other") as EmployeeRole;
        const phone = String(f.get("phone") || "").trim();
        const email = String(f.get("email") || "").trim();
        const monthlySalary = Number(f.get("monthlySalary") || 0);
        const joinDate = String(f.get("joinDate") || todayIso());
        const active = f.get("active") === "on";

        if (!name) {
            showToast("Please enter the employee's name", "error");
            return;
        }
        if (monthlySalary <= 0) {
            showToast("Monthly salary must be greater than zero", "error");
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                await updateDoc(doc(db, "employees", editing.id), { name, role, phone, email, monthlySalary, joinDate, active });
                showToast("Employee updated");
            } else {
                await addDoc(collection(db, "employees"), { name, role, phone, email, monthlySalary, joinDate, active, createdAt: Date.now() });
                showToast("Employee added");
            }
            setDrawerOpen(false);
            setEditing(null);
        } catch {
            showToast("Something went wrong saving the employee", "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, "employees", deleting.id));
            showToast("Employee removed");
            setDeleting(null);
        } catch {
            showToast("Couldn't delete employee", "error");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <PillLoader label="Loading employees…" />;

    return (
        <>
            <div className="pageHead">
                <div>
                    <h1>Employees</h1>
                    <p>Staff directory — feeds Attendance and Payroll.</p>
                </div>
                <button className="primary" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
                    <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />New Employee
                </button>
            </div>

            <div className="card tableCard">
                <div className="tableTools">
                    <div className="search">
                        <Search size={15} className="searchIcon" />
                        <input placeholder="Search employees…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Phone &amp; Email</th>
                                <th>Monthly Salary</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty">⌕<br /><strong>No employees found</strong></div></td></tr>
                            ) : (
                                filtered.map((e) => (
                                    <tr key={e.id}>
                                        <td><b>{e.name}</b><small>Joined {e.joinDate}</small></td>
                                        <td>{e.role}</td>
                                        <td><b>{e.phone}</b><small>{e.email}</small></td>
                                        <td>₹{e.monthlySalary.toLocaleString()}</td>
                                        <td>
                                            {e.active
                                                ? <span className="badge completed"><i />Active</span>
                                                : <span className="badge pending"><i />Inactive</span>}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button className="more" onClick={() => { setEditing(e); setDrawerOpen(true); }}><Pencil size={14} /></button>
                                                <button className="more" style={{ color: "#dc2626" }} onClick={() => setDeleting(e)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerOpen && (
                <Drawer
                    title={editing ? "Edit Employee" : "New Employee"}
                    subtitle={editing ? editing.name : "Add a staff member"}
                    onClose={() => { setDrawerOpen(false); setEditing(null); }}
                    footer={<>
                        <button type="button" onClick={() => { setDrawerOpen(false); setEditing(null); }}>Cancel</button>
                        <button type="submit" form="employee-form" className="primary" disabled={submitting}>
                            {submitting ? "Saving…" : "Save Employee"}
                        </button>
                    </>}
                >
                    <form id="employee-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
                        <label>Name
                            <input name="name" defaultValue={editing?.name} placeholder="Rahul Verma" required />
                        </label>
                        <div className="two">
                            <label>Role
                                <select name="role" defaultValue={editing?.role || "Front Desk"}>
                                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </label>
                            <label>Monthly Salary (₹)
                                <input name="monthlySalary" type="number" min={1} defaultValue={editing?.monthlySalary} required />
                            </label>
                        </div>
                        <div className="two">
                            <label>Phone
                                <input name="phone" defaultValue={editing?.phone} placeholder="+91 90000 00000" />
                            </label>
                            <label>Email
                                <input name="email" type="email" defaultValue={editing?.email} placeholder="name@business.com" />
                            </label>
                        </div>
                        <label>Join Date
                            <input name="joinDate" type="date" defaultValue={editing?.joinDate || todayIso()} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row" }}>
                            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} style={{ width: "auto" }} />
                            Active (included in attendance &amp; payroll)
                        </label>
                    </form>
                </Drawer>
            )}

            {deleting && (
                <ConfirmModal
                    title="Remove employee?"
                    message={`This removes ${deleting.name}. Past attendance and payroll records referencing them are kept as-is.`}
                    confirmLabel="Remove"
                    danger
                    loading={submitting}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </>
    );
}
