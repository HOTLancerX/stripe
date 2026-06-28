"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";

interface StripeConfig {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    mode: "test" | "live";
    enabled: boolean;
}

const BLANK_CONFIG: StripeConfig = {
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    mode: "test",
    enabled: true,
};

export default function StripeSettings() {
    const [config, setConfig] = useState<StripeConfig>(BLANK_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [showSecrets, setShowSecrets] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await xFetch("/settings", { cache: "no-store" });
            const data = await res.json();
            setConfig({
                publishableKey: data.stripe_publishable_key || "",
                secretKey: data.stripe_secret_key || "",
                webhookSecret: data.stripe_webhook_secret || "",
                mode: data.stripe_mode || "test",
                enabled: data.stripe_enabled !== "false",
            });
        } catch {
            setConfig(BLANK_CONFIG);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res = await xFetch("/settings", {
                method: "PUT",
                body: JSON.stringify({
                    stripe_publishable_key: config.publishableKey,
                    stripe_secret_key: config.secretKey,
                    stripe_webhook_secret: config.webhookSecret,
                    stripe_mode: config.mode,
                    stripe_enabled: String(config.enabled),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error ?? "Failed to save"}`);
            } else {
                setMessage("Stripe configuration saved!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch {
            setMessage("Network error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Stripe Payment Gateway</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure Stripe for secure online card payments. Customers will be redirected to Stripe&apos;s
                    hosted checkout page and returned here after payment.
                </p>
            </div>

            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                    message.startsWith("Error")
                        ? "bg-red-400/10 text-red-400 border-red-400/25"
                        : "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                }`}>
                    {message}
                </div>
            )}

            {/* Status indicator */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                config.enabled && config.publishableKey && config.secretKey
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
            }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    config.enabled && config.publishableKey && config.secretKey
                        ? "bg-emerald-100"
                        : "bg-amber-100"
                }`}>
                    <Icon
                        icon={config.enabled && config.publishableKey && config.secretKey ? "mdi:check-circle" : "mdi:alert"}
                        width={20}
                        className={config.enabled && config.publishableKey && config.secretKey ? "text-emerald-600" : "text-amber-600"}
                    />
                </div>
                <div>
                    <p className={`text-sm font-semibold ${
                        config.enabled && config.publishableKey && config.secretKey ? "text-emerald-800" : "text-amber-800"
                    }`}>
                        {config.enabled
                            ? (config.publishableKey && config.secretKey ? "Stripe is Active" : "Stripe is Enabled but not configured")
                            : "Stripe is Disabled"
                        }
                    </p>
                    <p className="text-xs text-gray-500">
                        {config.mode === "live" ? "Live mode — real charges" : "Test mode — no real charges"}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Enable Stripe</p>
                        <p className="text-xs text-gray-500">Show Stripe as a payment option at checkout</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${config.enabled ? "bg-emerald-500" : "bg-gray-200"}`}
                    >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                </div>

                {/* Mode toggle */}
                <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Payment Mode</p>
                        <p className="text-xs text-gray-500">
                            {config.mode === "live"
                                ? "Live mode — real payments will be processed"
                                : "Test mode — use Stripe test cards for development"
                            }
                        </p>
                    </div>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, mode: "test" }))}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                config.mode === "test" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                            }`}
                        >
                            Test
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, mode: "live" }))}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                config.mode === "live" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                            }`}
                        >
                            Live
                        </button>
                    </div>
                </div>

                {/* API Keys */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">API Keys</h3>
                        <button
                            type="button"
                            onClick={() => setShowSecrets(!showSecrets)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                            <Icon icon={showSecrets ? "mdi:eye-off" : "mdi:eye"} width={14} />
                            {showSecrets ? "Hide" : "Show"} keys
                        </button>
                    </div>

                    <Field
                        label="Publishable Key"
                        value={config.publishableKey}
                        onChange={(v) => setConfig(prev => ({ ...prev, publishableKey: v }))}
                        placeholder="pk_test_..."
                        type={showSecrets ? "text" : "password"}
                    />
                    <Field
                        label="Secret Key"
                        value={config.secretKey}
                        onChange={(v) => setConfig(prev => ({ ...prev, secretKey: v }))}
                        placeholder="sk_test_..."
                        type={showSecrets ? "text" : "password"}
                    />
                    <Field
                        label="Webhook Signing Secret"
                        value={config.webhookSecret}
                        onChange={(v) => setConfig(prev => ({ ...prev, webhookSecret: v }))}
                        placeholder="whsec_..."
                        type={showSecrets ? "text" : "password"}
                    />
                </div>

                {/* Info card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                    <p className="font-semibold flex items-center gap-2">
                        <Icon icon="mdi:information-outline" width={16} />
                        How Stripe works here
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
                        <li>Customer selects Stripe at checkout and clicks &quot;Place Order&quot;</li>
                        <li>A Stripe Checkout Session is created server-side via <code>/api/stripe/checkout</code></li>
                        <li>Customer is redirected to Stripe&apos;s hosted payment page</li>
                        <li>After payment, Stripe redirects back to your order confirmation page</li>
                        <li>The order is automatically marked as paid</li>
                    </ul>
                    <p className="text-xs text-blue-600 mt-2">
                        Get your API keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">dashboard.stripe.com/apikeys</a>
                    </p>
                </div>

                {/* Webhook info */}
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                    <p className="font-semibold text-gray-700">Webhook Endpoint</p>
                    <p className="font-mono bg-gray-100 px-2 py-1 rounded">POST /api/stripe/webhook</p>
                    <p>Configure this URL in your Stripe Dashboard under Webhooks to receive payment event notifications.</p>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-55 disabled:cursor-not-allowed"
                >
                    {saving
                        ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving...</>
                        : <><Icon icon="solar:check-circle-bold" width={16} /> Save Configuration</>
                    }
                </button>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
        </div>
    );
}
