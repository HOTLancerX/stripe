import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { getOrdersCollection, generateOrderNumber, initializeOrdersCollection } from '@/plugin/product/models/Order';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session and returns the URL for redirect.
 * Also creates a pending order in the database.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            items, shippingAddress, shippingMethod, shippingCost,
            subtotal, total, paymentMethod, notes,
        } = body;

        const stripeSecretKey = await getSetting('stripe_secret_key');
        if (!stripeSecretKey) {
            return NextResponse.json({ error: 'Stripe is not configured' }, { status: 400 });
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeSecretKey as string);

        await initializeOrdersCollection();
        const orders = await getOrdersCollection();
        const orderNumber = generateOrderNumber();

        const order = {
            orderNumber,
            userEmail: shippingAddress.email || '',
            items: items.map((item: any) => ({
                productId: item.productId,
                productSlug: item.productSlug,
                productTitle: item.productTitle,
                productImage: item.productImage || '',
                variantId: item.variantId,
                variantOptions: item.variantOptions,
                sku: item.sku,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.subtotal,
                orderNote: item.orderNote || '',
            })),
            shippingAddress: {
                name: shippingAddress.name,
                phone: shippingAddress.phone,
                email: shippingAddress.email || '',
                address: shippingAddress.address || '',
                state: shippingAddress.state || '',
                city: shippingAddress.city || '',
                zipCode: shippingAddress.zipCode || '',
            },
            shippingMethod: shippingMethod || 'inside',
            shippingCost: shippingCost || 0,
            subtotal,
            total,
            status: 'pending' as const,
            paymentStatus: 'pending' as const,
            paymentMethod: 'stripe',
            paymentGatewayType: 'stripe',
            notes: notes || '',
            inventoryUpdated: false,
            timeline: [{
                status: 'pending',
                note: 'Order created, awaiting Stripe payment',
                createdBy: 'system',
                createdByName: 'System',
                createdAt: new Date(),
            }],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await orders.insertOne(order);

        const origin = req.headers.get('origin') || new URL(req.url).origin;
        const currency = ((await getSetting('product_currency') as string) || 'usd').toLowerCase();

        const lineItems = items.map((item: any) => ({
            price_data: {
                currency,
                product_data: {
                    name: item.productTitle,
                    ...(item.productImage ? { images: [item.productImage] } : {}),
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        if (shippingCost && shippingCost > 0) {
            lineItems.push({
                price_data: {
                    currency,
                    product_data: {
                        name: `Shipping (${shippingMethod === 'inside' ? 'Inside' : 'Outside'})`,
                    },
                    unit_amount: Math.round(shippingCost * 100),
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: shippingAddress.email || undefined,
            line_items: lineItems,
            success_url: `${origin}/order-confirmation/${orderNumber}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/checkout?canceled=true`,
            metadata: { orderNumber },
        });

        await orders.updateOne(
            { orderNumber },
            { $set: { 'metadata.stripeSessionId': session.id } }
        );

        return NextResponse.json({
            url: session.url,
            sessionId: session.id,
            orderNumber,
        });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create Stripe checkout session' },
            { status: 500 }
        );
    }
}
