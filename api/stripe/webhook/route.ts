import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for payment confirmation.
 * Backup mechanism if customer doesn't return to callback URL.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const sig = req.headers.get('stripe-signature');
        const webhookSecret = await getSetting('stripe_webhook_secret');

        if (!webhookSecret || !sig) {
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
        }

        const stripeSecretKey = await getSetting('stripe_secret_key');
        if (!stripeSecretKey) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 });
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeSecretKey as string);

        let event;
        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret as string);
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err.message);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderNumber = session.metadata?.orderNumber;

            if (orderNumber && session.payment_status === 'paid') {
                await initializeOrdersCollection();
                const orders = await getOrdersCollection();

                const existingOrder = await orders.findOne({ orderNumber });
                if (existingOrder && existingOrder.paymentStatus !== 'paid') {
                    await orders.updateOne(
                        { orderNumber },
                        {
                            $set: {
                                paymentStatus: 'paid',
                                updatedAt: new Date(),
                            },
                            $push: {
                                timeline: {
                                    status: 'processing',
                                    note: `Stripe webhook: payment confirmed (${session.id})`,
                                    createdBy: 'system',
                                    createdByName: 'Stripe Webhook',
                                    createdAt: new Date(),
                                },
                            },
                        }
                    );
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Stripe webhook error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
