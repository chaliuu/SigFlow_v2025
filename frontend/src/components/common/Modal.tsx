import { useRef, useEffect, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    width?: string;
}

export default function Modal({ open, onClose, title, children, width }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className={styles.overlay}
            ref={overlayRef}
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div
                className={`${styles.modal} animate-fade-in`}
                style={width ? { maxWidth: width } : undefined}
            >
                <div className={styles.header}>
                    {title && <h3 className={styles.title}>{title}</h3>}
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>
                <div className={styles.body}>{children}</div>
            </div>
        </div>
    );
}
