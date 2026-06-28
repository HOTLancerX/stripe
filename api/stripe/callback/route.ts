import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/callback?session_id=xxx
 *
 * Handles the return from Stripe Checkout.
 * Verifies the session and updates the order payment status.
 */
export async function GET(req: NextRequest) {
    try {
        const sessionId = req.nextUrl.searchParams.get('session_id');
        if (!sessionId) {
            return NextResponse.redirect(new URL('/checkout?error=no_session', req.url));
        }

        const stripeSecretKey = await getSetting('stripe_secret_key');
        if (!stripeSecretKey) {
            return NextResponse.redirect(new URL('/checkout?error=stripe_not_configured', req.url));
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeSecretKey as string);

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const orderNumber = session.metadata?.orderNumber;
            if (orderNumber) {
                await initializeOrdersCollection();
                const orders = await getOrdersCollection();

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
                                note: `Stripe payment confirmed (Session: ${sessionId})`,
                                createdBy: 'system',
                                createdByName: 'Stripe',
                                createdAt: new Date(),
                            },
                        },
                    }
                );

                return NextResponse.redirect(new URL(`/order-confirmation/${orderNumber}`, req.url));
            }
        }

        return NextResponse.redirect(new URL('/checkout?error=payment_incomplete', req.url));
    } catch (error: any) {
        console.error('Stripe callback error:', error);
        return NextResponse.redirect(new URL('/checkout?error=stripe_callback_failed', req.url));
    }
}
