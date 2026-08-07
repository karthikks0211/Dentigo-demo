/** Visual (non-scannable) barcode rendering for printable labels — bar widths are deterministically derived from the code so the same code always renders the same pattern. */
export default function BarcodeSvg({ code, width = 180, height = 50 }: { code: string; width?: number; height?: number }) {
    const digits = code.split("");
    const bars: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of digits) {
        const n = ch.charCodeAt(0);
        const barWidth = 1 + (n % 3);
        if (n % 2 === 0) bars.push({ x, w: barWidth });
        x += barWidth + 1;
    }
    const scale = width / Math.max(x, 1);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
            <rect x={0} y={0} width={width} height={height} fill="#fff" />
            {bars.map((b, i) => (
                <rect key={i} x={b.x * scale} y={4} width={Math.max(1, b.w * scale)} height={height - 16} fill="#111" />
            ))}
            <text x={width / 2} y={height - 3} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#111">{code}</text>
        </svg>
    );
}
