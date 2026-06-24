import React, { useRef, useState } from 'react';
import { X, CheckCircle2, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useI18n } from '../i18n';
import { useToast } from "./ui/ToastProvider";

export interface Transaction {
    id: string;
    created_at: string;
    type: string;
    amount: number;
    status: string;
    ref?: string;
    reference?: string;
    request_id?: string;
    user_id?: string;
    description?: string;
    meta?: any;
}

interface ReceiptModalProps {
    tx: Transaction;
    onClose: () => void;
    currency: {
        label: string;
        isCrypto: boolean;
        cryptoVal: number;
        nairaVal: number;
        colorClass: string;
    };
    logoNode: React.ReactNode;
    colorClass: string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ tx, onClose, currency, logoNode, colorClass }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const displayRef = tx.reference || `TRX-${tx.id.substring(0, 8)}`;
    const meta = tx.meta || {};
    const isDeposit = String(tx.type).toLowerCase() === "deposit";

    // Enhanced check for pins, exam cards, or recharge tokens
    const isExam = String(tx.type).toLowerCase() === "exam";
    const isRechargePin = String(tx.type).toLowerCase() === "rechargepin";

    const examCards = Array.isArray(meta?.cards)
        ? meta.cards
            .map((c: any) => ({
                pin: String(c?.pin || "").trim(),
                serialNo: String(c?.serial_no || c?.serialNo || "").trim(),
            }))
            .filter((c: any) => c.pin || c.serialNo)
        : [];

    const singlePin = String(meta?.pin || "").trim();
    const depositFee = Number(meta?.estimated_fee || 0);

    const receiptRef = useRef<HTMLDivElement | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharing, setSharing] = useState(false);
    const WHATSAPP_NUMBER = "2349151618451";

    const getWhatsAppUrl = (message: string) =>
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(`${label} copied!`, "success");
        } catch (err) {
            showToast(`Failed to copy ${label}`, "error");
        }
    };

    const exportCanvas = async () => {
        if (!receiptRef.current) return null;
        document.body.classList.add("capture-mode");
        const canvas = await html2canvas(receiptRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            ignoreElements: (el) => (el as HTMLElement).dataset?.noCapture === "true",
        });
        document.body.classList.remove("capture-mode");
        return canvas;
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const shareFile = async (file: File) => {
        if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
            await navigator.share({ title: "Swifna Receipt", files: [file] });
            return true;
        }
        return false;
    };

    const handleSaveImage = async () => {
        setSharing(true);
        try {
            const canvas = await exportCanvas();
            if (!canvas) return;
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
            if (!blob) return;
            downloadBlob(blob, "swifna-receipt.png");
        } finally { setSharing(false); }
    };

    const handleShareImage = async () => {
        setSharing(true);
        try {
            const canvas = await exportCanvas();
            if (!canvas) return;
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
            if (!blob) return;
            const file = new File([blob], "swifna-receipt.png", { type: "image/png" });
            const ok = await shareFile(file);
            if (!ok) {
                downloadBlob(blob, "swifna-receipt.png");
                showToast("Sharing not supported. Image downloaded instead.", "info");
            }
        } finally { setSharing(false); }
    };

    const handleSavePdf = async () => {
        setSharing(true);
        try {
            const canvas = await exportCanvas();
            if (!canvas) return;
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({ orientation: "p", unit: "px", format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
            pdf.save("swifna-receipt.pdf");
        } finally { setSharing(false); }
    };

    const handleSharePdf = async () => {
        setSharing(true);
        try {
            const canvas = await exportCanvas();
            if (!canvas) return;
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({ orientation: "p", unit: "px", format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
            const blob = pdf.output("blob");
            const file = new File([blob], "swifna-receipt.pdf", { type: "application/pdf" });
            const ok = await shareFile(file);
            if (!ok) {
                downloadBlob(blob, "swifna-receipt.pdf");
                showToast("Sharing not supported. PDF downloaded instead.", "info");
            }
        } finally { setSharing(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-sm relative max-h-[90vh] flex flex-col">
                <button aria-label="Close receipt" onClick={onClose} className="absolute -top-12 right-0 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-colors z-10">
                    <X size={20} />
                </button>

                <div className="overflow-y-auto custom-scrollbar rounded-[30px] shadow-2xl bg-white relative">
                    <div ref={receiptRef} className="bg-white relative">
                        <div
                            className="absolute inset-0 pointer-events-none opacity-[0.08]"
                            style={{
                                backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                                    "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='160' viewBox='0 0 260 160'><g transform='rotate(-18 130 80)'><text x='60' y='86' fill='rgba(15,23,42,0.12)' font-size='20' font-family='Inter, Arial, sans-serif' font-weight='800'>Swifna</text><rect x='24' y='58' width='28' height='28' rx='6' ry='6' fill='rgba(34,197,94,0.18)'/><text x='32' y='79' fill='rgba(245,196,0,0.35)' font-size='22' font-family='Inter, Arial, sans-serif' font-weight='800'>S</text></g></svg>"
                                )}")`,
                                backgroundRepeat: "repeat",
                                backgroundSize: "260px 160px",
                            }}
                        />

                        {/* Header Area */}
                        <div className="h-32 bg-emerald-600 relative">
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '10px 10px' }}></div>
                            <div className="absolute inset-0 flex items-start justify-between px-6 pt-3">
                                <div className="flex items-center gap-2 bg-white/25 px-3 py-1.5 rounded-full">
                                    <span className="text-white font-black text-base">Swifna</span>
                                </div>
                                <span className="text-white text-xs font-black uppercase tracking-widest bg-white/25 px-3 py-1.5 rounded-full">
                                    Receipt
                                </span>
                            </div>
                        </div>

                        <div className="px-6 pb-8 -mt-10 relative">
                            <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-slate-100 relative z-10">
                                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center -mt-14 mb-3 border-4 border-white shadow-md ${colorClass}`}>
                                    <div className="w-10 h-10">{logoNode}</div>
                                </div>

                                <h2 className="text-3xl font-black text-slate-800">
                                    {currency.isCrypto ? 'π' : '₦'}
                                    {(currency.isCrypto ? currency.cryptoVal : currency.nairaVal).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: currency.isCrypto ? 4 : 2
                                    })}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{tx.type}</p>

                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.status.toLowerCase() === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {tx.status.toLowerCase() === 'success' ? <CheckCircle2 size={12} /> : <X size={12} />}
                                    {tx.status}
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                    <span className="text-xs font-bold text-slate-400">Payment Asset</span>
                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-right`}>
                                        {currency.label}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                    <span className="text-xs font-bold text-slate-400">{t("common.date")}</span>
                                    <span className="text-xs font-bold text-slate-700">{new Date(tx.created_at).toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                    <span className="text-xs font-bold text-slate-400">{t("common.ref_id")}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">{displayRef}</span>
                                        <button aria-label="Copy reference" onClick={() => handleCopy(displayRef, "Reference")} className="text-slate-400 hover:text-emerald-600 transition-colors">
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                    <span className="text-xs font-bold text-slate-400">{t("common.desc")}</span>
                                    <span className="text-xs font-bold text-slate-700 text-right max-w-[150px] truncate">{tx.description || tx.type}</span>
                                </div>

                                {/* --- CRYPTO LEDGER BALANCING --- */}
                                {isDeposit && currency.isCrypto && (
                                    <>
                                        <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200 bg-amber-50/40 px-2 rounded-lg mt-2">
                                            <span className="text-xs font-bold text-amber-800">Crypto Sent</span>
                                            <span className="text-xs font-black text-amber-700">π{currency.cryptoVal.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200 bg-emerald-50/40 px-2 rounded-lg mt-1">
                                            <span className="text-xs font-bold text-emerald-800">Naira Balance Credited</span>
                                            <span className="text-xs font-black text-emerald-700">₦{currency.nairaVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                )}

                                {isDeposit && !currency.isCrypto && (
                                    <>
                                        <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                            <span className="text-xs font-bold text-slate-400">Wallet Credit</span>
                                            <span className="text-xs font-bold text-slate-700">₦{Number(currency.nairaVal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                            <span className="text-xs font-bold text-slate-400">Processing Fee</span>
                                            <span className="text-xs font-bold text-slate-700">₦{depositFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                                            <span className="text-xs font-bold text-slate-400">Total Settled</span>
                                            <span className="text-xs font-bold text-slate-700">₦{(currency.nairaVal + depositFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                )}

                                {/* --- ELECTRICITY METADATA --- */}
                                {String(tx.type).toLowerCase() === "electricity" && (
                                    <div className="pt-2 space-y-3">
                                        {meta.provider && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400">Provider</span>
                                                <span className="text-xs font-bold text-slate-700 text-right">{meta.provider}</span>
                                            </div>
                                        )}
                                        {meta.meter_number && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400">Meter Number</span>
                                                <span className="text-xs font-bold text-slate-700 text-right">{meta.meter_number}</span>
                                            </div>
                                        )}
                                        {meta.token && (
                                            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                                <span className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Electricity Token</span>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-black tracking-widest text-slate-800 font-mono">{meta.token}</span>
                                                    <button onClick={() => handleCopy(meta.token, "Token")} className="p-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* --- EXAM / RECHARGE PINS METADATA --- */}
                                {(isExam || isRechargePin) && (
                                    <div className="pt-2">
                                        {singlePin && examCards.length === 0 && (
                                            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                <span className="text-[10px] font-black uppercase text-blue-600 block mb-1">Registration PIN</span>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-black text-slate-800 font-mono">{singlePin}</span>
                                                    <button onClick={() => handleCopy(singlePin, "PIN")} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {examCards.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <span className="text-xs font-bold text-slate-400 block border-b border-dashed border-slate-200 pb-1">Generated PINs ({examCards.length})</span>
                                                <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                                    {examCards.map((card: any, idx: number) => (
                                                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col gap-1.5">
                                                            {card.serialNo && (
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider">Serial:</span>
                                                                    <span className="font-mono font-bold text-slate-600">{card.serialNo}</span>
                                                                </div>
                                                            )}
                                                            {card.pin && (
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider">PIN:</span>
                                                                    <button onClick={() => handleCopy(card.pin, `PIN ${idx + 1}`)} className="font-mono font-black text-emerald-600 flex items-center gap-1 hover:text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded">
                                                                        {card.pin} <Copy size={10} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ACTION BUTTONS (Hidden in Canvas Export) */}
                            <div className="mt-6 border-t border-slate-100 pt-6">
                                <div className="flex items-center gap-3" data-no-capture="true">
                                    <button
                                        onClick={() => setShareOpen((v) => !v)}
                                        className="flex-1 h-12 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                                        disabled={sharing}
                                    >
                                        {sharing ? "Preparing..." : "Share Receipt"}
                                    </button>
                                    <a
                                        href={getWhatsAppUrl(`Hello Swifna Support, please help resolve an issue with transaction ${displayRef}.`)}
                                        className="flex-1 h-12 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center hover:border-emerald-400"
                                    >
                                        Resolve Issue
                                    </a>
                                </div>
                                {shareOpen && (
                                    <div className="mt-3 grid grid-cols-2 gap-2" data-no-capture="true">
                                        <button onClick={handleShareImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors">Share Image</button>
                                        <button onClick={handleSaveImage} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors">Save Image</button>
                                        <button onClick={handleSharePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors">Share PDF</button>
                                        <button onClick={handleSavePdf} className="h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors">Save PDF</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;