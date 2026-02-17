import styles from './Toggle.module.css';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    id?: string;
    disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, id, disabled }: ToggleProps) {
    const toggleId = id || `toggle-${label?.replace(/\s/g, '-') || 'default'}`;

    return (
        <label className={styles.wrapper} htmlFor={toggleId}>
            <div className={`${styles.track} ${checked ? styles.trackActive : ''} ${disabled ? styles.disabled : ''}`}>
                <input
                    type="checkbox"
                    id={toggleId}
                    className={styles.input}
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                />
                <div className={styles.thumb} />
            </div>
            {label && <span className={styles.label}>{label}</span>}
        </label>
    );
}
