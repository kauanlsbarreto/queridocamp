import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      methods: [
        {
          id: "PIX",
          label: "PIX",
          image: "/images/payments/pix.svg",
          opensExternalPage: false,
        },
        {
          id: "CREDIT_CARD",
          label: "Credito",
          image: "/images/payments/credit-card.svg",
          opensExternalPage: true,
        },
        {
          id: "DEBIT_CARD",
          label: "Debito",
          image: "/images/payments/debit-card.svg",
          opensExternalPage: true,
        },
        {
          id: "BOLETO",
          label: "Boleto",
          image: "/images/payments/boleto.svg",
          opensExternalPage: true,
        },
      ],
    },
    { status: 200 },
  );
}
