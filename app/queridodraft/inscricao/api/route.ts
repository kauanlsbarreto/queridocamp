import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("comprovante") as File | null;
  let fileBuffer = null;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  }

  const nomeCompleto = String(data.get("nomeCompleto") || "");
  const faceitLink = String(data.get("faceitLink") || "");
  const gcLink = String(data.get("gcLink") || "");
  const steamLink = String(data.get("steamLink") || "");
  const telefone = String(data.get("telefone") || "");
  const jogouOutrosDrafts = String(data.get("jogouOutrosDrafts") || "false");

  let faceitGuid = null;
  const match = faceitLink.match(/faceit.com\/(?:[a-z]{2}\/)?players\/([^/?#]+)/i);
  if (match && match[1]) {
    faceitGuid = match[1];
    try {
      const apiKey = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
      const res = await fetch(`https://open.faceit.com/data/v4/players/${faceitGuid}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
    }
  }

  const embedFields = [
    { name: "Nome Completo", value: nomeCompleto, inline: false },
    { name: "Link do Faceit", value: faceitLink, inline: false },
    { name: "Link do perfil Gc", value: gcLink, inline: false },
    { name: "Link da Steam", value: steamLink, inline: false },
    { name: "Telefone", value: telefone, inline: false },
    { name: "Já jogou outros drafts?", value: jogouOutrosDrafts === "true" ? "Sim" : "Não", inline: false },
    faceitGuid !== null ? { name: "faceit_guid", value: faceitGuid, inline: false } : null,
  ].filter(Boolean);

  if (file && file.type === "application/pdf") {
    embedFields.push({
      name: "Comprovante",
      value: `Clique para abrir o PDF`,
      inline: false,
    });
  }

  const form = new FormData();
  if (fileBuffer) {
    if (file) {
      form.append(
        "files[0]",
        new Blob([fileBuffer], { type: file.type }),
        file.name
      );
    }
  }

  form.append(
    "payload_json",
    JSON.stringify({
      embeds: [
        {
          title: "Nova inscrição Querido Draft",
          color: 0x2e8bff, // azul
          fields: embedFields,
          image: file && !file.type.includes("pdf") ? { url: "attachment://" + file.name } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    })
  );

  try {
    const response = await fetch("https://discord.com/api/webhooks/1447677740298932265/iKskHoGWMysbUXCxWTeZaxrj9VGPh_cJdtYZ3GsA6mB_XbnOe1SRix9wOWGQAqokAnkO", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }
  } catch (error) {
    console.warn("Falha ao enviar webhook de inscrição.", error);
  }

  return NextResponse.json({ ok: true });
}
