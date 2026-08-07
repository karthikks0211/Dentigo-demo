export default function Badge({ status }: { status: string }) {
    const cls = status ? status.toLowerCase().replace(/[\s-]+/g, "") : "default";
    return (
        <span className={`badge ${cls}`}>
            <i />
            {status}
        </span>
    );
}
