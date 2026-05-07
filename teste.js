const playerId = "98f79799-bea9-4b08-806b-1c1398feb166";
const apiKey = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

async function getNickname() {

  // 👇 espera antes de bater na API
  await new Promise(r => setTimeout(r, 1000));

  const url = `https://open.faceit.com/data/v4/players/${playerId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Erro: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  console.log("Nickname:", data.nickname);
}

getNickname().catch(console.error);