import { useState, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCircuit, importSfg } from '../api/api';
import { readTextFileWithEncoding } from '../utils/fileUtils';
import Modal from '../components/common/Modal';
import styles from './LandingPage.module.css';

interface UploadPayload {
    name: string;
    netlist: string | null;
    schematic: string | null;
    op_point_log: string | null;
}

const TUTORIAL_STEPS = [
    {
        title: 'Step 1: Netlist File (.cir)',
        content: 'Upload your LTSpice netlist file. This is required to create the signal-flow graph.',
    },
    {
        title: 'Step 2: Schematic File (.asc)',
        content: 'Upload your LTSpice schematic file to see the circuit diagram overlaid on the SFG.',
    },
    {
        title: 'Step 3: Operating Point Log (.log)',
        content: 'Upload the operating point log to convert large-signal into small-signal parameters.',
    },
    {
        title: 'Step 4: SFG File (.pkl)',
        content: 'Optionally, upload a previously saved SFG file to restore a session.',
    },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const [payload, setPayload] = useState<UploadPayload>({
        name: 'untitled',
        netlist: null,
        schematic: null,
        op_point_log: null,
    });
    const [sfgFile, setSfgFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [dragActive, setDragActive] = useState<string | null>(null);

    const handleFile = useCallback(
        async (file: File, field: keyof Omit<UploadPayload, 'name'>) => {
            try {
                const text = await readTextFileWithEncoding(file, file.name);
                setPayload((prev) => ({ ...prev, [field]: text }));
            } catch {
                setError(`Failed to read ${file.name}`);
            }
        },
        []
    );

    const handleFileInput = useCallback(
        (field: keyof Omit<UploadPayload, 'name'>) =>
            (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, field);
            },
        [handleFile]
    );

    const handleDrop = useCallback(
        (field: keyof Omit<UploadPayload, 'name'>) =>
            (e: React.DragEvent) => {
                e.preventDefault();
                setDragActive(null);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file, field);
            },
        [handleFile]
    );

    const handleDragOver = useCallback((field: string) => (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(field);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragActive(null);
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!payload.netlist && !sfgFile) {
            setError('Please upload a netlist (.cir) or an SFG (.pkl) file.');
            return;
        }

        setLoading(true);
        try {
            let circuitId: string;

            if (!payload.netlist && sfgFile) {
                // SFG-only import
                const generatedId = crypto.randomUUID?.() || `${Date.now()}`;
                const imported = await importSfg(generatedId, sfgFile);
                circuitId = imported.id || generatedId;
            } else {
                // Create circuit from netlist
                const created = await createCircuit(payload);
                circuitId = created.id;

                // Also import SFG if provided
                if (sfgFile) {
                    await importSfg(circuitId, sfgFile);
                }
            }

            sessionStorage.setItem('circuitId', circuitId);
            navigate(`/editor/${circuitId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const fileInputs: Array<{
        field: keyof Omit<UploadPayload, 'name'>;
        label: string;
        accept: string;
        icon: string;
    }> = [
            { field: 'netlist', label: 'Netlist File (.cir)', accept: '.cir,.net,.sp', icon: '📄' },
            { field: 'schematic', label: 'Schematic File (.asc)', accept: '.asc', icon: '🔧' },
            { field: 'op_point_log', label: 'Operating Point Log (.log)', accept: '.log', icon: '📊' },
        ];

    return (
        <div className={styles.page}>
            {/* Background decoration */}
            <div className={styles.bgGlow} />
            <div className={styles.bgGlow2} />

            <div className={`${styles.card} animate-fade-in`}>
                <div className={styles.logoSection}>
                    <h1 className={styles.logo}>
                        <span className={styles.logoAccent}>Sig</span>Flow
                    </h1>
                    <p className={styles.tagline}>
                        Analyze and visualize analog circuits using signal-flow graphs
                    </p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {fileInputs.map(({ field, label, accept, icon }) => (
                        <div
                            key={field}
                            className={`${styles.dropzone} ${dragActive === field ? styles.dropzoneActive : ''
                                } ${payload[field] ? styles.dropzoneFilled : ''}`}
                            onDrop={handleDrop(field)}
                            onDragOver={handleDragOver(field)}
                            onDragLeave={handleDragLeave}
                        >
                            <div className={styles.dropzoneIcon}>{icon}</div>
                            <div className={styles.dropzoneContent}>
                                <span className={styles.dropzoneLabel}>{label}</span>
                                {payload[field] ? (
                                    <span className={styles.dropzoneStatus}>✓ File loaded</span>
                                ) : (
                                    <span className={styles.dropzoneHint}>
                                        Drag & drop or click to browse
                                    </span>
                                )}
                            </div>
                            <input
                                type="file"
                                accept={accept}
                                onChange={handleFileInput(field)}
                                className={styles.fileInput}
                            />
                        </div>
                    ))}

                    {/* SFG file — separate since it's a File, not text */}
                    <div
                        className={`${styles.dropzone} ${dragActive === 'sfg' ? styles.dropzoneActive : ''
                            } ${sfgFile ? styles.dropzoneFilled : ''}`}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(null);
                            const file = e.dataTransfer.files?.[0];
                            if (file) setSfgFile(file);
                        }}
                        onDragOver={handleDragOver('sfg')}
                        onDragLeave={handleDragLeave}
                    >
                        <div className={styles.dropzoneIcon}>📦</div>
                        <div className={styles.dropzoneContent}>
                            <span className={styles.dropzoneLabel}>Signal Flow Graph (.pkl)</span>
                            {sfgFile ? (
                                <span className={styles.dropzoneStatus}>✓ {sfgFile.name}</span>
                            ) : (
                                <span className={styles.dropzoneHint}>
                                    Drag & drop or click to browse
                                </span>
                            )}
                        </div>
                        <input
                            type="file"
                            accept=".pkl"
                            onChange={(e) => setSfgFile(e.target.files?.[0] || null)}
                            className={styles.fileInput}
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? (
                                <span className={styles.spinner} />
                            ) : (
                                'Launch SigFlow'
                            )}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setTutorialStep(0);
                                setTutorialOpen(true);
                            }}
                        >
                            ℹ️ Tutorial
                        </button>
                    </div>
                </form>
            </div>

            {/* Tutorial Modal */}
            <Modal
                open={tutorialOpen}
                onClose={() => setTutorialOpen(false)}
                title={TUTORIAL_STEPS[tutorialStep]?.title || 'Tutorial'}
            >
                <p className={styles.tutorialText}>
                    {TUTORIAL_STEPS[tutorialStep]?.content}
                </p>
                <div className={styles.tutorialNav}>
                    <div className={styles.stepIndicator}>
                        {TUTORIAL_STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`${styles.stepDot} ${i === tutorialStep ? styles.stepDotActive : ''}`}
                            />
                        ))}
                    </div>
                    <div className={styles.tutorialButtons}>
                        {tutorialStep > 0 && (
                            <button
                                className="btn-secondary"
                                onClick={() => setTutorialStep((s) => s - 1)}
                            >
                                Back
                            </button>
                        )}
                        {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                            <button
                                className="btn-primary"
                                onClick={() => setTutorialStep((s) => s + 1)}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                className="btn-primary"
                                onClick={() => setTutorialOpen(false)}
                            >
                                Done
                            </button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
