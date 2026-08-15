import { addHook, type PluginMeta } from "@/hook";
import StripeSettings from "./settings/StripeSettings";

export const PLUGINS: PluginMeta = {
    nx: "stripe",
    name: "stripe",
    version: "1.0.0",
    description: "Stripe payment gateway — secure online card payments with redirect checkout flow.",
    author: "System",
    path: "",
    icon: "mdi:credit-card-outline",
    color: "from-indigo-500 to-blue-600",
};

export function register() {
    addHook("admin.nav", [
        {
            key: "stripe-settings",
            label: "Stripe",
            icon: "mdi:credit-card-outline",
            slug: "stripe/settings",
            parent: "",
            position: 17,
        },
    ], PLUGINS.nx);

    addHook("admin.pages", [
        {
            key: "stripe/settings",
            label: "Stripe Configuration",
            type: "stripe-settings",
            style: "left",
            position: 40,
            path: StripeSettings,
        },
    ], PLUGINS.nx);
}
