import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const data = await req.formData()

  const file = data.get("comprovante") as File | null

  let fileBuffer = null
  if (file) {
    const arrayBuffer = await file.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  }

  const fieldOrder = [
    "email", "nomeCompleto", "idade", "dataNascimento", "estado", "cidade",
    "nick", "faceitLink", "gamersClubLink", "steamLink", "cpf", "telefone", "aceitaTermos"
  ]

  const fieldLabels: Record<string, string> = {
    email: "Email",
    nomeCompleto: "Nome Completo",
    idade: "Idade",
    dataNascimento: "Data de Nascimento",
    estado: "Estado",
    cidade: "Cidade",
    nick: "Nick",
    faceitLink: "Link do Faceit",
    gamersClubLink: "Link da Gamers Club",
    steamLink: "Link da Steam",
    cpf: "CPF",
    telefone: "Telefone",
    aceitaTermos: "Aceitou os Termos",
  }

  const embedFields = fieldOrder.map((key) => {
    let value = String(data.get(key))
    if (key === "dataNascimento" && value) {
      const [year, month, day] = value.split("-")
      value = `${day}/${month}/${year}`
    }
    return {
      name: fieldLabels[key] || key,
      value: value,
      inline: false,
    }
  })

  const form = new FormData()

  if (fileBuffer) {
    form.append(
      "files[0]",
      new Blob([fileBuffer], { type: file.type }),
      file.name
    )
  }

  form.append(
    "payload_json",
    JSON.stringify({
      embeds: [
        {
          title: "Nova inscrição",
          color: 0x00ff99,
          fields: embedFields,
          image: file ? { url: "attachment://" + file.name } : undefined,
          timestamp: new Date().toISOString()
        }
      ]
    })
  )

  try {
    const response = await fetch("https://discord.com/api/webhooks/1447677740298932265/iKskHoGWMysbUXCxWTeZaxrj9VGPh_cJdtYZ3GsA6mB_XbnOe1SRix9wOWGQAqokAnkO", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }
  } catch (error) {
    const email = data.get("email");
    const telefone = data.get("telefone");
    console.warn(
      "Falha ao enviar webhook de inscrição. A inscrição foi recebida, mas não notificada no Discord.",
      {
        email: email,
        telefone: telefone,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }

  return NextResponse.json({ ok: true })
}
