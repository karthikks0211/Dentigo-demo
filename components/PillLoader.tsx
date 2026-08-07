export default function PillLoader({ label, inline = false }: { label?: string; inline?: boolean }) {
    return (
        <div className={inline ? "pillLoaderInline" : "pillLoaderWrap"}>
            <div className="pillLoader" role="status" aria-label={label || "Loading"}>
                <span className="pillLoaderCapsule">
                    <i />
                    <i />
                </span>
            </div>
            {label && <p className="pillLoaderLabel">{label}</p>}
        </div>
    );
}
