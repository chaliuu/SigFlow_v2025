import styles from './EdgeInfoTooltip.module.css';

interface EdgeInfoTooltipProps {
    data: Record<string, unknown> | null;
    x: number;
    y: number;
}

export default function EdgeInfoTooltip({ data, x, y }: EdgeInfoTooltipProps) {
    if (!data) return null;

    return (
        <div
            className={styles.tooltip}
            style={{ left: x + 14, top: y - 10 }}
        >
            <div className={styles.row}>
                <span className={styles.key}>Source:</span>
                <span className={styles.val}>{String(data.source)}</span>
            </div>
            <div className={styles.row}>
                <span className={styles.key}>Target:</span>
                <span className={styles.val}>{String(data.target)}</span>
            </div>
            <div className={styles.row}>
                <span className={styles.key}>Symbolic:</span>
                <span className={styles.val}>{String(data.symbolic || data.label || '—')}</span>
            </div>
            <div className={styles.row}>
                <span className={styles.key}>Magnitude:</span>
                <span className={styles.val}>
                    {data.magnitude !== undefined ? Number(data.magnitude).toExponential(3) : '—'}
                </span>
            </div>
        </div>
    );
}
